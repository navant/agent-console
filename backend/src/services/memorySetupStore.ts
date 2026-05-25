import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import {
  expandHome,
  MEMORY_BRIDGE_TEMPLATE_DIR,
  workspaceClaudeDir,
  CODEGRAPH_SUMMARY_FILENAME,
  CODEGRAPH_SUMMARY_IMPORT,
} from '../config';
import { getConfig, saveConfig } from './fileStore';

const SETUP_TIMEOUT_MS = 600_000;
const CLAUDE_JSON = path.join(os.homedir(), '.claude.json');
const CODEGRAPH_NPX = ['--yes', '@colbymchenry/codegraph'];
const CLAUDE_MEM_PORTS = [37701, 37777];
const MEMORY_IMPORT = '@.claude/MEMORY.md';

/** Install these yourself — the app does not run npm install for them. */
export const MEMORY_DEPENDENCY_INSTALL_STEPS = [
  {
    id: 'codegraph',
    title: 'CodeGraph (global MCP only)',
    commands: ['npx @colbymchenry/codegraph install -y'],
    note: 'One-time on your machine. Per-project index (.codegraph/) is created by **Setup workspace** in this app — no need to run init -i yourself.',
  },
  {
    id: 'claude-mem',
    title: 'claude-mem (session memory)',
    commands: [
      'npx claude-mem install --ide claude-code --provider claude',
      'npx claude-mem start',
    ],
    note: 'Worker usually on http://localhost:37701. Restart Claude Code after install.',
  },
  {
    id: 'jq',
    title: 'jq (hook JSON parsing)',
    commands: ['brew install jq'],
    note: 'Required for .claude/hooks/sync-memory.sh',
  },
] as const;

export const MEMORY_SETUP_PLAN: { id: string; label: string }[] = [
  { id: 'preflight', label: 'Preflight (claude, jq)' },
  { id: 'codegraph-init', label: 'CodeGraph init in workspace' },
  { id: 'bridge', label: 'Memory bridge (hook + settings)' },
  { id: 'claude-md', label: 'CLAUDE.md @-import' },
  { id: 'tier', label: 'Agent Console memory tier' },
];

export const MEMORY_REFRESH_PLAN: { id: string; label: string }[] = [
  { id: 'preflight', label: 'Preflight (bridge, tools)' },
  { id: 'codegraph-sync', label: 'CodeGraph sync index' },
  { id: 'codegraph-summary', label: 'CodeGraph project summary' },
  { id: 'claude-mem-memory', label: 'claude-mem → MEMORY.md' },
];

export type MemorySetupStepStatus = 'pending' | 'running' | 'ok' | 'skipped' | 'failed';

export interface MemorySetupStep {
  id: string;
  label: string;
  status: MemorySetupStepStatus;
  detail?: string;
}

export interface MemoryDependencyStatus {
  claude: boolean;
  jq: boolean;
  codegraphMcp: boolean;
  codegraphProject: boolean;
  claudeMemWorker: boolean;
  claudeMemPort?: number;
  bridgeInstalled: boolean;
}

export interface MemorySetupResult {
  success: boolean;
  workspacePath: string;
  steps: MemorySetupStep[];
  log: string;
  hints: string[];
  memoryTier: 'claude-mem';
}

export type MemorySetupStreamEvent =
  | { type: 'plan'; steps: { id: string; label: string }[] }
  | { type: 'step'; step: MemorySetupStep }
  | { type: 'log'; line: string }
  | { type: 'done'; result: MemorySetupResult };

type ProgressEmit = (event: MemorySetupStreamEvent) => void;

interface SetupCtx {
  resolved: string;
  log: string[];
  steps: MemorySetupStep[];
  emit: ProgressEmit;
}

function appendLog(log: string[], chunk: string, emit?: ProgressEmit): void {
  for (const line of chunk.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    log.push(trimmed);
    emit?.({ type: 'log', line: trimmed });
    while (log.length > 200) log.shift();
  }
}

function commandFailureDetail(stdout: string, stderr: string, fallback: string): string {
  const combined = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
  if (!combined) return fallback;
  const lines = combined.split('\n').filter(l => l.trim() && !/^\[[0-9]+m/.test(l));
  const tail = lines.slice(-8).join('\n');
  return tail.length > 1200 ? `${tail.slice(0, 1200)}…` : tail;
}

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeoutMs?: number;
    log?: string[];
    onLog?: ProgressEmit;
    heartbeatLabel?: string;
  } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        CI: '1',
        FORCE_COLOR: '0',
        npm_config_progress: 'false',
        AGENT_CONSOLE_HEADLESS: '',
        CLAUDE_CODE_SIMPLE: '',
      },
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let lastOutputAt = Date.now();
    const timer = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs ?? SETUP_TIMEOUT_MS);
    const heartbeat = setInterval(() => {
      const silentMs = Date.now() - lastOutputAt;
      if (silentMs < 8000 || !options.onLog) return;
      const label = options.heartbeatLabel ?? `${command} ${args.slice(0, 3).join(' ')}`;
      options.onLog({ type: 'log', line: `… still running (${label})` });
      lastOutputAt = Date.now();
    }, 4000);

    const onChunk = (s: string, target: 'stdout' | 'stderr') => {
      lastOutputAt = Date.now();
      if (target === 'stdout') stdout += s;
      else stderr += s;
      appendLog(options.log ?? [], s, options.onLog);
    };

    child.stdout?.on('data', (d: Buffer) => onChunk(d.toString(), 'stdout'));
    child.stderr?.on('data', (d: Buffer) => onChunk(d.toString(), 'stderr'));
    child.on('close', code => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on('error', err => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      resolve({ code: 1, stdout, stderr: String(err) });
    });
  });
}

function runCodegraph(
  args: string[],
  options: {
    cwd?: string;
    timeoutMs?: number;
    log?: string[];
    onLog?: ProgressEmit;
    heartbeatLabel?: string;
  } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return runCommand('npx', [...CODEGRAPH_NPX, ...args], options);
}

function commandOnPath(bin: string): boolean {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    try {
      if (fs.existsSync(path.join(dir, bin))) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

function httpProbe(url: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    const req = http.get(url, res => {
      res.resume();
      finish(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => finish(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      finish(false);
    });
  });
}

export async function getClaudeMemWorkerStatus(): Promise<{ up: boolean; port?: number }> {
  const checks = await Promise.all(
    CLAUDE_MEM_PORTS.map(async port => ({
      port,
      up: await httpProbe(`http://127.0.0.1:${port}/`, 2000),
    }))
  );
  const hit = checks.find(c => c.up);
  return hit ? { up: true, port: hit.port } : { up: false };
}

export async function probeClaudeMemAvailable(): Promise<boolean> {
  return (await getClaudeMemWorkerStatus()).up;
}

function isCodegraphMcpRegistered(): boolean {
  if (!fs.existsSync(CLAUDE_JSON)) return false;
  try {
    const raw = fs.readFileSync(CLAUDE_JSON, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const servers = data.mcpServers as Record<string, unknown> | undefined;
    if (servers && ('codegraph' in servers || 'code-graph' in servers)) return true;
    return /codegraph/i.test(raw);
  } catch {
    return false;
  }
}

function isBridgeInstalled(workspacePath: string): boolean {
  return fs.existsSync(path.join(workspaceClaudeDir(workspacePath), 'hooks', 'sync-memory.sh'));
}

function isCodegraphProjectReady(workspacePath: string): boolean {
  const cgDir = path.join(workspacePath, '.codegraph');
  if (fs.existsSync(path.join(cgDir, 'codegraph.db'))) return true;
  if (!fs.existsSync(cgDir)) return false;
  try {
    return fs.readdirSync(cgDir).some(n => n.endsWith('.db') || n === 'config.json');
  } catch {
    return false;
  }
}

export async function getMemoryDependencyStatus(workspacePath: string): Promise<MemoryDependencyStatus> {
  const resolved = expandHome(workspacePath);
  const worker = await getClaudeMemWorkerStatus();
  return {
    claude: commandOnPath('claude'),
    jq: commandOnPath('jq'),
    codegraphMcp: isCodegraphMcpRegistered(),
    codegraphProject: isCodegraphProjectReady(resolved),
    claudeMemWorker: worker.up,
    claudeMemPort: worker.port,
    bridgeInstalled: isBridgeInstalled(resolved),
  };
}

function readJsonFile(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mergeSessionEndHooks(
  existing: Record<string, unknown>,
  template: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...existing };
  const templateHooks = template.hooks as Record<string, unknown> | undefined;
  const existingHooks = (out.hooks as Record<string, unknown> | undefined) ?? {};
  const sessionEnd = templateHooks?.SessionEnd;
  if (!sessionEnd) return out;

  const mergedHooks = { ...existingHooks };
  const current = mergedHooks.SessionEnd;
  const currentArr = Array.isArray(current) ? [...current] : current ? [current] : [];
  const templateArr = Array.isArray(sessionEnd) ? sessionEnd : [sessionEnd];
  if (!JSON.stringify(currentArr).includes('sync-memory.sh')) {
    mergedHooks.SessionEnd = [...currentArr, ...templateArr];
  }
  out.hooks = mergedHooks;
  return out;
}

function installBridgeFiles(workspacePath: string): string[] {
  const claudeDir = workspaceClaudeDir(workspacePath);
  const hookSrc = path.join(MEMORY_BRIDGE_TEMPLATE_DIR, '.claude', 'hooks', 'sync-memory.sh');
  const hookDest = path.join(claudeDir, 'hooks', 'sync-memory.sh');
  if (!fs.existsSync(hookSrc)) throw new Error(`Memory bridge template missing: ${hookSrc}`);

  fs.mkdirSync(path.join(claudeDir, 'hooks'), { recursive: true });
  fs.copyFileSync(hookSrc, hookDest);
  fs.chmodSync(hookDest, 0o755);

  const settingsDest = path.join(claudeDir, 'settings.json');
  const merged = mergeSessionEndHooks(
    readJsonFile(settingsDest),
    readJsonFile(path.join(MEMORY_BRIDGE_TEMPLATE_DIR, '.claude', 'settings.json'))
  );
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(settingsDest, `${JSON.stringify(merged, null, 2)}\n`, 'utf-8');

  return ['.claude/hooks/sync-memory.sh', '.claude/settings.json'];
}

function appendClaudeMdBlock(
  workspacePath: string,
  marker: string,
  block: string
): 'created' | 'appended' | 'skipped' {
  const claudeMd = path.join(expandHome(workspacePath), 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) {
    const content = fs.readFileSync(claudeMd, 'utf-8');
    if (content.includes(marker)) return 'skipped';
    fs.appendFileSync(claudeMd, `\n\n${block}\n`);
    return 'appended';
  }
  fs.writeFileSync(claudeMd, `${block}\n`, 'utf-8');
  return 'created';
}

function appendClaudeMdSnippet(workspacePath: string): string {
  const snippetPath = path.join(MEMORY_BRIDGE_TEMPLATE_DIR, 'CLAUDE.md.snippet');
  const snippetBody = fs.existsSync(snippetPath)
    ? fs.readFileSync(snippetPath, 'utf-8')
    : `## Lessons from past sessions\n\n${MEMORY_IMPORT}\n`;
  const block = snippetBody.replace(/^<!--[\s\S]*?-->\s*/m, '').trim();
  const mem = appendClaudeMdBlock(workspacePath, MEMORY_IMPORT, block);
  return `memory: ${mem}`;
}

function appendCodegraphClaudeMdImport(workspacePath: string): 'appended' | 'skipped' {
  const summaryPath = path.join(workspaceClaudeDir(expandHome(workspacePath)), CODEGRAPH_SUMMARY_FILENAME);
  if (!fs.existsSync(summaryPath)) return 'skipped';
  const block = `## Codebase (CodeGraph)\n\n${CODEGRAPH_SUMMARY_IMPORT}`;
  const action = appendClaudeMdBlock(workspacePath, CODEGRAPH_SUMMARY_IMPORT, block);
  return action === 'skipped' ? 'skipped' : 'appended';
}

function emitStep(ctx: SetupCtx, step: MemorySetupStep): void {
  const idx = ctx.steps.findIndex(s => s.id === step.id);
  if (idx >= 0) ctx.steps[idx] = step;
  else ctx.steps.push(step);
  ctx.emit({ type: 'step', step });
}

function emitRunning(ctx: SetupCtx, id: string, label: string, detail?: string): void {
  emitStep(ctx, { id, label, status: 'running', detail });
}

function buildResult(ctx: SetupCtx, success: boolean, hints: string[]): MemorySetupResult {
  return {
    success,
    workspacePath: ctx.resolved,
    steps: ctx.steps,
    log: ctx.log.join('\n'),
    hints,
    memoryTier: 'claude-mem',
  };
}

function startPlan(ctx: SetupCtx, plan: { id: string; label: string }[]): void {
  ctx.emit({ type: 'plan', steps: plan });
  for (const p of plan) {
    emitStep(ctx, { id: p.id, label: p.label, status: 'pending' });
  }
}

function fail(ctx: SetupCtx, id: string, label: string, detail: string, hints: string[]): MemorySetupResult {
  emitStep(ctx, { id, label, status: 'failed', detail });
  const result = buildResult(ctx, false, hints);
  ctx.emit({ type: 'done', result });
  return result;
}

/** Workspace-only: init CodeGraph + install memory bridge. Does not npm-install global tools. */
export async function runSetupMemory(workspacePath: string, emit: ProgressEmit): Promise<MemorySetupResult> {
  const resolved = expandHome(workspacePath);
  const ctx: SetupCtx = { resolved, log: [], steps: [], emit };
  startPlan(ctx, MEMORY_SETUP_PLAN);

  const hintsOk = [
    'Restart Claude Code so hooks load.',
    'Use **Refresh summaries** to regenerate CodeGraph + claude-mem memory files.',
  ];

  emitRunning(ctx, 'preflight', 'Preflight (claude, jq)');
  if (!commandOnPath('claude')) {
    return fail(ctx, 'preflight', 'Preflight (claude, jq)', '`claude` not on PATH.', [
      'Install Claude Code CLI first.',
      ...hintsOk,
    ]);
  }
  if (!commandOnPath('jq')) {
    return fail(ctx, 'preflight', 'Preflight (claude, jq)', '`jq` not on PATH (see Prerequisites).', hintsOk);
  }
  emitStep(ctx, { id: 'preflight', label: 'Preflight (claude, jq)', status: 'ok' });

  if (!isCodegraphMcpRegistered()) {
    appendLog(ctx.log, 'Note: CodeGraph MCP not in ~/.claude.json — run global install from Prerequisites.', emit);
  }

  if (isCodegraphProjectReady(resolved)) {
    emitStep(ctx, {
      id: 'codegraph-init',
      label: 'CodeGraph init in workspace',
      status: 'skipped',
      detail: '.codegraph/ already indexed',
    });
  } else {
    emitRunning(
      ctx,
      'codegraph-init',
      'CodeGraph init in workspace',
      'First index can take 1–3 min with little log output…'
    );
    appendLog(ctx.log, 'Running: npx @colbymchenry/codegraph init -i', emit);
    const init = await runCodegraph(['init', '-i'], {
      cwd: resolved,
      timeoutMs: SETUP_TIMEOUT_MS,
      log: ctx.log,
      onLog: emit,
      heartbeatLabel: 'codegraph init -i',
    });
    if (init.code !== 0) {
      return fail(
        ctx,
        'codegraph-init',
        'CodeGraph init in workspace',
        commandFailureDetail(init.stdout, init.stderr, 'init failed — install CodeGraph globally first (see Prerequisites)'),
        hintsOk
      );
    }
    emitStep(ctx, { id: 'codegraph-init', label: 'CodeGraph init in workspace', status: 'ok' });
  }

  emitRunning(ctx, 'bridge', 'Memory bridge (hook + settings)');
  try {
    const copied = installBridgeFiles(resolved);
    emitStep(ctx, {
      id: 'bridge',
      label: 'Memory bridge (hook + settings)',
      status: 'ok',
      detail: copied.join(', '),
    });
  } catch (err) {
    return fail(ctx, 'bridge', 'Memory bridge (hook + settings)', err instanceof Error ? err.message : String(err), hintsOk);
  }

  emitRunning(ctx, 'claude-md', 'CLAUDE.md @-import');
  const mdAction = appendClaudeMdSnippet(resolved);
  emitStep(ctx, {
    id: 'claude-md',
    label: 'CLAUDE.md @-import',
    status: mdAction.endsWith('skipped') ? 'skipped' : 'ok',
    detail: mdAction,
  });

  emitRunning(ctx, 'tier', 'Agent Console memory tier');
  const config = getConfig();
  config.memoryTier = 'claude-mem';
  saveConfig(config);
  emitStep(ctx, { id: 'tier', label: 'Agent Console memory tier', status: 'ok', detail: 'claude-mem' });

  const result = buildResult(ctx, true, hintsOk);
  ctx.emit({ type: 'done', result });
  return result;
}

async function runSyncMemoryHook(
  workspacePath: string,
  log: string[],
  emit: ProgressEmit
): Promise<{ ok: boolean; detail: string }> {
  const hook = path.join(workspaceClaudeDir(workspacePath), 'hooks', 'sync-memory.sh');
  if (!fs.existsSync(hook)) {
    return { ok: false, detail: 'Run **Setup workspace memory** first (missing sync-memory.sh)' };
  }

  const payload = JSON.stringify({ cwd: workspacePath });
  appendLog(log, `Running: .claude/hooks/sync-memory.sh`, emit);
  const piped = await runCommand('bash', ['-c', `echo '${payload.replace(/'/g, "'\\''")}' | '${hook}'`], {
    cwd: workspacePath,
    timeoutMs: SETUP_TIMEOUT_MS,
    log,
    onLog: emit,
    heartbeatLabel: 'sync-memory.sh',
  });

  const memoryPath = path.join(workspaceClaudeDir(workspacePath), 'MEMORY.md');
  if (piped.code !== 0) {
    return {
      ok: false,
      detail: commandFailureDetail(piped.stdout, piped.stderr, 'sync-memory.sh failed'),
    };
  }
  if (!fs.existsSync(memoryPath)) {
    return { ok: true, detail: 'Hook finished (MEMORY.md may be empty until claude-mem has observations)' };
  }
  const body = fs.readFileSync(memoryPath, 'utf-8');
  const hasCliIndex = body.includes('## claude-mem index');
  const hasSessionTable = /\| #S\d+ \|/.test(body);
  const hasObservations = /\*\*Type:\*\* (decision|lesson|gotcha|pattern)/.test(body);
  const onlyPlaceholder =
    body.includes('No durable lessons captured yet') &&
    !hasCliIndex &&
    !hasSessionTable &&
    !hasObservations;
  if (onlyPlaceholder) {
    return {
      ok: true,
      detail:
        'MEMORY.md unchanged (placeholder). claude-mem has sessions but few observations — work in interactive `claude` in this repo, then refresh. Check worker: npx claude-mem status',
    };
  }
  return { ok: true, detail: `Updated ${memoryPath}` };
}

/** Regenerate CodeGraph summary + claude-mem MEMORY.md for this workspace. */
export async function runRefreshMemory(workspacePath: string, emit: ProgressEmit): Promise<MemorySetupResult> {
  const resolved = expandHome(workspacePath);
  const ctx: SetupCtx = { resolved, log: [], steps: [], emit };
  startPlan(ctx, MEMORY_REFRESH_PLAN);

  const hints = [
    'Open `.claude/MEMORY.md` and `codegraph-summary.md` in the tree.',
    'Session-end hook will also refresh MEMORY.md automatically.',
  ];

  emitRunning(ctx, 'preflight', 'Preflight (bridge, tools)');
  if (!commandOnPath('claude')) {
    return fail(ctx, 'preflight', 'Preflight (bridge, tools)', '`claude` not on PATH', hints);
  }
  if (!isBridgeInstalled(resolved)) {
    return fail(ctx, 'preflight', 'Preflight (bridge, tools)', 'Memory bridge not installed — run **Setup workspace memory** first', hints);
  }
  emitStep(ctx, { id: 'preflight', label: 'Preflight (bridge, tools)', status: 'ok' });

  emitRunning(ctx, 'codegraph-sync', 'CodeGraph sync index');
  appendLog(ctx.log, 'Running: npx @colbymchenry/codegraph sync', emit);
  const sync = await runCodegraph(['sync'], {
    cwd: resolved,
    timeoutMs: SETUP_TIMEOUT_MS,
    log: ctx.log,
    onLog: emit,
  });
  if (sync.code !== 0) {
    return fail(
      ctx,
      'codegraph-sync',
      'CodeGraph sync index',
      commandFailureDetail(sync.stdout, sync.stderr, 'sync failed — run `npx @colbymchenry/codegraph init -i` in this workspace'),
      hints
    );
  }
  emitStep(ctx, { id: 'codegraph-sync', label: 'CodeGraph sync index', status: 'ok' });

  emitRunning(ctx, 'codegraph-summary', 'CodeGraph project summary');
  const task =
    'Agent Console app: full-stack TypeScript repo with backend Express API, frontend React/Vite, ' +
    'memory setup, kanban tasks, PRD/goals, Claude task runner. Summarize architecture, main modules, and conventions.';
  appendLog(ctx.log, `Running: npx @colbymchenry/codegraph context "${task}"`, emit);
  const cgCtx = await runCodegraph(['context', task], {
    cwd: resolved,
    timeoutMs: SETUP_TIMEOUT_MS,
    log: ctx.log,
    onLog: emit,
    heartbeatLabel: 'codegraph context',
  });
  if (cgCtx.code !== 0) {
    return fail(
      ctx,
      'codegraph-summary',
      'CodeGraph project summary',
      commandFailureDetail(cgCtx.stdout, cgCtx.stderr, 'context failed'),
      hints
    );
  }
  const summaryPath = path.join(workspaceClaudeDir(resolved), CODEGRAPH_SUMMARY_FILENAME);
  const header = `# CodeGraph — project summary\n\n_Auto-generated by Agent Console refresh. Regenerate with **Refresh summaries**._\n\n`;
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, header + (cgCtx.stdout.trim() || '_No summary output._') + '\n', 'utf-8');
  const cgImport = appendCodegraphClaudeMdImport(resolved);
  emitStep(ctx, {
    id: 'codegraph-summary',
    label: 'CodeGraph project summary',
    status: 'ok',
    detail: `${CODEGRAPH_SUMMARY_FILENAME}${cgImport === 'appended' ? ' + CLAUDE.md import' : ''}`,
  });

  const worker = await getClaudeMemWorkerStatus();
  if (!worker.up) {
    emitStep(ctx, {
      id: 'claude-mem-memory',
      label: 'claude-mem → MEMORY.md',
      status: 'skipped',
      detail: 'claude-mem worker not running — run `npx claude-mem start`',
    });
  } else {
    emitRunning(ctx, 'claude-mem-memory', 'claude-mem → MEMORY.md', `Worker :${worker.port}`);
    const hookResult = await runSyncMemoryHook(resolved, ctx.log, emit);
    if (!hookResult.ok) {
      return fail(ctx, 'claude-mem-memory', 'claude-mem → MEMORY.md', hookResult.detail, hints);
    }
    emitStep(ctx, {
      id: 'claude-mem-memory',
      label: 'claude-mem → MEMORY.md',
      status: 'ok',
      detail: hookResult.detail,
    });
  }

  const result = buildResult(ctx, true, hints);
  ctx.emit({ type: 'done', result });
  return result;
}

export async function setupMemory(workspacePath: string): Promise<MemorySetupResult> {
  return runSetupMemory(workspacePath, () => {});
}

export function writeStreamEvent(res: import('express').Response, event: MemorySetupStreamEvent): void {
  res.write(`${JSON.stringify(event)}\n`);
  const r = res as import('express').Response & { flush?: () => void };
  if (typeof r.flush === 'function') r.flush();
}
