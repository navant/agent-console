import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  expandHome,
  RALPH_SCRIPTS_REL,
  RALPH_TEMPLATE_DIR,
  RALPH_WORKFLOW_TEMPLATE_DIR,
} from '../config';
import { listArchonWorkflows, probeArchon, runArchon } from './archonStore';

export const ARCHON_CLI_REFERENCE = 'https://archon.diy/reference/cli/';
export const RALPH_REPO = 'https://github.com/snarktank/ralph';

/** Ralph copy + optional Archon project setup */
export const WORKSPACE_SETUP_PLAN: { id: string; label: string }[] = [
  { id: 'preflight', label: 'Preflight (claude, jq, git)' },
  { id: 'ralph-scripts', label: 'Copy Ralph scripts (scripts/ralph/)' },
  { id: 'ralph-workflow', label: 'Ralph loop workflow (.claude/workflows/)' },
  { id: 'archon-scaffold', label: 'Archon .archon/ layout' },
  { id: 'archon-project-setup', label: 'Archon project setup (--scope project)' },
  { id: 'archon-validate', label: 'Validate Archon workflows' },
  { id: 'archon-skill', label: 'Archon skill (.claude/skills/archon/)' },
  { id: 'archon-discover', label: 'Discover Archon workflows' },
];

/** @deprecated use WORKSPACE_SETUP_PLAN */
export const ARCHON_SETUP_PLAN = WORKSPACE_SETUP_PLAN;

export type ArchonSetupStepStatus = 'pending' | 'running' | 'ok' | 'skipped' | 'failed';

export interface ArchonSetupStep {
  id: string;
  label: string;
  status: ArchonSetupStepStatus;
  detail?: string;
}

export interface ArchonWorkspaceStatus {
  gitRepo: boolean;
  jq: boolean;
  ralphScripts: boolean;
  ralphLoopWorkflow: boolean;
  projectArchonDir: boolean;
  projectEnvFile: boolean;
  workflowsDir: boolean;
  archonSkillInstalled: boolean;
  workflowCount?: number;
  globalEnvFile: boolean;
}

export interface ArchonSetupResult {
  success: boolean;
  workspacePath: string;
  steps: ArchonSetupStep[];
  log: string;
  hints: string[];
}

export type ArchonSetupStreamEvent =
  | { type: 'plan'; steps: { id: string; label: string }[] }
  | { type: 'step'; step: ArchonSetupStep }
  | { type: 'log'; line: string }
  | { type: 'done'; result: ArchonSetupResult };

type ProgressEmit = (event: ArchonSetupStreamEvent) => void;

interface SetupCtx {
  resolved: string;
  log: string[];
  steps: ArchonSetupStep[];
  emit: ProgressEmit;
}

function commandOnPath(bin: string): boolean {
  try {
    execSync(process.platform === 'win32' ? `where ${bin}` : `which ${bin}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: dir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function appendLog(log: string[], chunk: string, emit?: ProgressEmit): void {
  for (const line of chunk.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || /^\{"level":/.test(trimmed)) continue;
    log.push(trimmed);
    emit?.({ type: 'log', line: trimmed });
    while (log.length > 200) log.shift();
  }
}

function commandFailureDetail(stdout: string, stderr: string, fallback: string): string {
  const combined = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
  if (!combined) return fallback;
  const lines = combined.split('\n').filter(l => l.trim() && !/^\[[0-9]+m/.test(l) && !/^\{"level":/.test(l));
  const tail = lines.slice(-8).join('\n');
  return tail.length > 1200 ? `${tail.slice(0, 1200)}…` : tail;
}

export function getArchonWorkspaceStatus(workspacePath: string): ArchonWorkspaceStatus {
  const resolved = expandHome(workspacePath);
  const archonDir = path.join(resolved, '.archon');
  const skillDir = path.join(resolved, '.claude', 'skills', 'archon');
  const ralphDir = path.join(resolved, RALPH_SCRIPTS_REL);
  const globalEnv = path.join(process.env.HOME ?? '', '.archon', '.env');
  return {
    gitRepo: isGitRepo(resolved),
    jq: commandOnPath('jq'),
    ralphScripts: fs.existsSync(path.join(ralphDir, 'ralph.sh')),
    ralphLoopWorkflow: fs.existsSync(path.join(resolved, '.claude', 'workflows', 'ralph-loop', 'WORKFLOW.md')),
    projectArchonDir: fs.existsSync(archonDir),
    projectEnvFile: fs.existsSync(path.join(archonDir, '.env')),
    workflowsDir: fs.existsSync(path.join(archonDir, 'workflows')),
    archonSkillInstalled: fs.existsSync(skillDir) && fs.readdirSync(skillDir).length > 0,
    globalEnvFile: fs.existsSync(globalEnv),
  };
}

export async function getArchonWorkspaceStatusWithCount(
  workspacePath: string
): Promise<ArchonWorkspaceStatus> {
  const status = getArchonWorkspaceStatus(workspacePath);
  const probe = await probeArchon();
  if (!probe.available) return status;
  try {
    const list = await listArchonWorkflows(workspacePath);
    status.workflowCount = list.length;
  } catch {
    // ignore
  }
  return status;
}

function emitStep(ctx: SetupCtx, step: ArchonSetupStep): void {
  const idx = ctx.steps.findIndex(s => s.id === step.id);
  if (idx >= 0) ctx.steps[idx] = step;
  else ctx.steps.push(step);
  ctx.emit({ type: 'step', step });
}

function emitRunning(ctx: SetupCtx, id: string, label: string, detail?: string): void {
  emitStep(ctx, { id, label, status: 'running', detail });
}

function buildResult(ctx: SetupCtx, success: boolean, hints: string[]): ArchonSetupResult {
  return {
    success,
    workspacePath: ctx.resolved,
    steps: ctx.steps,
    log: ctx.log.join('\n'),
    hints,
  };
}

function startPlan(ctx: SetupCtx, plan: { id: string; label: string }[]): void {
  ctx.emit({ type: 'plan', steps: plan });
  for (const p of plan) {
    emitStep(ctx, { id: p.id, label: p.label, status: 'pending' });
  }
}

function fail(ctx: SetupCtx, id: string, label: string, detail: string, hints: string[]): ArchonSetupResult {
  emitStep(ctx, { id, label, status: 'failed', detail });
  const result = buildResult(ctx, false, hints);
  ctx.emit({ type: 'done', result });
  return result;
}

const WORKFLOWS_README = `# Archon workflows

Add custom workflow definitions in this directory.
See the [CLI reference](${ARCHON_CLI_REFERENCE}).

\`\`\`bash
archon validate workflows
archon workflow list --json
\`\`\`
`;

function scaffoldProjectArchon(resolved: string): string {
  const archonDir = path.join(resolved, '.archon');
  const workflowsDir = path.join(archonDir, 'workflows');
  fs.mkdirSync(workflowsDir, { recursive: true });
  const readme = path.join(workflowsDir, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, WORKFLOWS_README, 'utf-8');
  }
  return workflowsDir;
}

function copyFileIfMissing(src: string, dest: string): 'copied' | 'skipped' {
  if (fs.existsSync(dest)) return 'skipped';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return 'copied';
}

function copyRalphScripts(resolved: string): { dest: string; copied: string[]; skipped: string[] } {
  const dest = path.join(resolved, RALPH_SCRIPTS_REL);
  fs.mkdirSync(dest, { recursive: true });
  const copied: string[] = [];
  const skipped: string[] = [];
  if (!fs.existsSync(RALPH_TEMPLATE_DIR)) {
    throw new Error('Ralph templates missing in Agent Console install');
  }
  for (const name of fs.readdirSync(RALPH_TEMPLATE_DIR)) {
    const src = path.join(RALPH_TEMPLATE_DIR, name);
    if (!fs.statSync(src).isFile()) continue;
    const out = path.join(dest, name);
    if (copyFileIfMissing(src, out) === 'copied') copied.push(name);
    else skipped.push(name);
  }
  const sh = path.join(dest, 'ralph.sh');
  if (fs.existsSync(sh)) {
    try {
      fs.chmodSync(sh, 0o755);
    } catch {
      // ignore chmod on Windows
    }
  }
  return { dest, copied, skipped };
}

function copyRalphLoopWorkflow(resolved: string): { dest: string; action: 'copied' | 'skipped' } {
  const src = path.join(RALPH_WORKFLOW_TEMPLATE_DIR, 'WORKFLOW.md');
  const dest = path.join(resolved, '.claude', 'workflows', 'ralph-loop', 'WORKFLOW.md');
  if (!fs.existsSync(src)) throw new Error('ralph-loop WORKFLOW template missing');
  if (fs.existsSync(dest)) return { dest, action: 'skipped' };
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return { dest, action: 'copied' };
}

/** Copy Ralph scripts + workflow; run Archon setup when CLI is available. */
export async function runSetupWorkspace(workspacePath: string, emit: ProgressEmit): Promise<ArchonSetupResult> {
  const resolved = expandHome(workspacePath);
  const ctx: SetupCtx = { resolved, log: [], steps: [], emit };
  startPlan(ctx, WORKSPACE_SETUP_PLAN);

  const hintsOk = [
    `Ralph: ${RALPH_REPO} — use workflow \`ralph-loop\` on project tasks with a generated plan.`,
    `Archon: ${ARCHON_CLI_REFERENCE}`,
    'Or run `./scripts/ralph/ralph.sh --tool claude` from the workspace root.',
  ];
  const setupCmd = `archon setup --scope project`;
  const setupSpawnCmd = `archon setup --spawn --scope project`;

  emitRunning(ctx, 'preflight', 'Preflight (claude, jq, git)');
  if (!commandOnPath('claude')) {
    return fail(ctx, 'preflight', 'Preflight (claude, jq, git)', '`claude` not on PATH', [
      'Run `claude /login` after installing Claude Code.',
      ...hintsOk,
    ]);
  }
  if (!commandOnPath('jq')) {
    return fail(ctx, 'preflight', 'Preflight (claude, jq, git)', '`jq` not on PATH (required by ralph.sh)', [
      'Install jq: `brew install jq`',
      ...hintsOk,
    ]);
  }
  if (!isGitRepo(resolved)) {
    return fail(ctx, 'preflight', 'Preflight (claude, jq, git)', 'Not a git repository', [
      'Ralph and Archon expect a git repo. Initialize git in this workspace.',
      ...hintsOk,
    ]);
  }
  emitStep(ctx, {
    id: 'preflight',
    label: 'Preflight (claude, jq, git)',
    status: 'ok',
  });

  emitRunning(ctx, 'ralph-scripts', 'Copy Ralph scripts (scripts/ralph/)');
  try {
    const { dest, copied, skipped } = copyRalphScripts(resolved);
    appendLog(ctx.log, `Ralph → ${dest} (copied: ${copied.join(', ') || 'none'}; skipped: ${skipped.join(', ') || 'none'})`, emit);
    emitStep(ctx, {
      id: 'ralph-scripts',
      label: 'Copy Ralph scripts (scripts/ralph/)',
      status: 'ok',
      detail: dest,
    });
  } catch (err) {
    return fail(
      ctx,
      'ralph-scripts',
      'Copy Ralph scripts (scripts/ralph/)',
      err instanceof Error ? err.message : String(err),
      hintsOk
    );
  }

  emitRunning(ctx, 'ralph-workflow', 'Ralph loop workflow (.claude/workflows/)');
  try {
    const { dest, action } = copyRalphLoopWorkflow(resolved);
    emitStep(ctx, {
      id: 'ralph-workflow',
      label: 'Ralph loop workflow (.claude/workflows/)',
      status: 'ok',
      detail: `${action}: ${dest}`,
    });
  } catch (err) {
    return fail(
      ctx,
      'ralph-workflow',
      'Ralph loop workflow (.claude/workflows/)',
      err instanceof Error ? err.message : String(err),
      hintsOk
    );
  }

  const probe = await probeArchon();
  if (!probe.available) {
    for (const step of [
      { id: 'archon-scaffold', label: 'Archon .archon/ layout' },
      { id: 'archon-project-setup', label: 'Archon project setup (--scope project)' },
      { id: 'archon-validate', label: 'Validate Archon workflows' },
      { id: 'archon-skill', label: 'Archon skill (.claude/skills/archon/)' },
      { id: 'archon-discover', label: 'Discover Archon workflows' },
    ]) {
      emitStep(ctx, {
        ...step,
        status: 'skipped',
        detail: probe.error ?? 'archon not on PATH — install from Prerequisites',
      });
    }
    appendLog(ctx.log, 'Archon steps skipped (CLI not installed).', emit);
    const result = buildResult(ctx, true, hintsOk);
    ctx.emit({ type: 'done', result });
    return result;
  }

  emitRunning(ctx, 'archon-scaffold', 'Archon .archon/ layout');
  const workflowsDir = scaffoldProjectArchon(resolved);
  emitStep(ctx, {
    id: 'archon-scaffold',
    label: 'Archon .archon/ layout',
    status: 'ok',
    detail: workflowsDir,
  });

  emitRunning(ctx, 'archon-project-setup', 'Archon project setup (--scope project)');
  const projectEnv = path.join(resolved, '.archon', '.env');
  const globalEnv = path.join(process.env.HOME ?? '', '.archon', '.env');
  if (fs.existsSync(projectEnv)) {
    emitStep(ctx, {
      id: 'archon-project-setup',
      label: 'Archon project setup (--scope project)',
      status: 'ok',
      detail: '.archon/.env present',
    });
  } else {
    try {
      const { stdout, stderr, code } = await runArchon(
        ['setup', '--spawn', '--scope', 'project'],
        resolved,
        30_000
      );
      appendLog(ctx.log, stdout + stderr, emit);
      const opened = (stdout + stderr).toLowerCase().includes('terminal') || code === 0;
      if (opened) {
        emitStep(ctx, {
          id: 'archon-project-setup',
          label: 'Archon project setup (--scope project)',
          status: 'ok',
          detail: 'Setup wizard opened in a new terminal — complete it to write .archon/.env',
        });
        appendLog(ctx.log, `Finish the wizard, then re-run setup or refresh workflows. (${setupCmd})`, emit);
      } else {
        emitStep(ctx, {
          id: 'archon-project-setup',
          label: 'Archon project setup (--scope project)',
          status: 'skipped',
          detail: commandFailureDetail(stdout, stderr, `Run manually: ${setupSpawnCmd}`),
        });
      }
    } catch (err) {
      const fallback = fs.existsSync(globalEnv)
        ? `Using ~/.archon/.env — run \`${setupSpawnCmd}\` for project config`
        : `Run \`${setupSpawnCmd}\` in a terminal`;
      emitStep(ctx, {
        id: 'archon-project-setup',
        label: 'Archon project setup (--scope project)',
        status: 'skipped',
        detail: err instanceof Error ? `${err.message}. ${fallback}` : fallback,
      });
      appendLog(ctx.log, fallback, emit);
    }
  }

  emitRunning(ctx, 'archon-validate', 'Validate Archon workflows');
  try {
    const { stdout, stderr, code } = await runArchon(
      ['validate', 'workflows', '--quiet'],
      resolved,
      120_000
    );
    appendLog(ctx.log, stdout + stderr, emit);
    const summary =
      stdout.match(/Results:.*$/m)?.[0] ??
      stderr.match(/Results:.*$/m)?.[0] ??
      (code === 0 ? 'All workflows valid' : commandFailureDetail(stdout, stderr, `exit ${code}`));
    emitStep(ctx, {
      id: 'archon-validate',
      label: 'Validate Archon workflows',
      status: 'ok',
      detail: summary,
    });
  } catch (err) {
    emitStep(ctx, {
      id: 'archon-validate',
      label: 'Validate Archon workflows',
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  emitRunning(ctx, 'archon-skill', 'Archon skill (.claude/skills/archon/)');
  const skillDir = path.join(resolved, '.claude', 'skills', 'archon');
  if (fs.existsSync(skillDir) && fs.readdirSync(skillDir).length > 0) {
    emitStep(ctx, {
      id: 'archon-skill',
      label: 'Archon skill (.claude/skills/archon/)',
      status: 'skipped',
      detail: 'Already installed',
    });
  } else {
    try {
      const { stdout, stderr, code } = await runArchon(['skill', 'install', resolved], resolved, 60_000);
      appendLog(ctx.log, stdout + stderr, emit);
      if (code === 0) {
        emitStep(ctx, {
          id: 'archon-skill',
          label: 'Archon skill (.claude/skills/archon/)',
          status: 'ok',
        });
      } else if ((stderr + stdout).includes('Unknown command')) {
        emitStep(ctx, {
          id: 'archon-skill',
          label: 'Archon skill (.claude/skills/archon/)',
          status: 'skipped',
          detail: 'Upgrade Archon CLI — `archon skill install` ships in newer releases',
        });
      } else {
        emitStep(ctx, {
          id: 'archon-skill',
          label: 'Archon skill (.claude/skills/archon/)',
          status: 'skipped',
          detail: commandFailureDetail(stdout, stderr, `exit ${code}`),
        });
      }
    } catch (err) {
      emitStep(ctx, {
        id: 'archon-skill',
        label: 'Archon skill (.claude/skills/archon/)',
        status: 'skipped',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  emitRunning(ctx, 'archon-discover', 'Discover Archon workflows');
  try {
    const list = await listArchonWorkflows(resolved);
    emitStep(ctx, {
      id: 'archon-discover',
      label: 'Discover Archon workflows',
      status: 'ok',
      detail: `${list.length} workflow(s) available`,
    });
  } catch (err) {
    return fail(
      ctx,
      'archon-discover',
      'Discover Archon workflows',
      err instanceof Error ? err.message : String(err),
      hintsOk
    );
  }

  const failed = ctx.steps.some(s => s.status === 'failed');
  const result = buildResult(ctx, !failed, hintsOk);
  ctx.emit({ type: 'done', result });
  return result;
}

export async function runSetupArchon(workspacePath: string, emit: ProgressEmit): Promise<ArchonSetupResult> {
  return runSetupWorkspace(workspacePath, emit);
}

export async function setupArchon(workspacePath: string): Promise<ArchonSetupResult> {
  return runSetupWorkspace(workspacePath, () => {});
}

export async function setupWorkspace(workspacePath: string): Promise<ArchonSetupResult> {
  return runSetupWorkspace(workspacePath, () => {});
}

export function writeArchonStreamEvent(res: import('express').Response, event: ArchonSetupStreamEvent): void {
  res.write(`${JSON.stringify(event)}\n`);
  const r = res as import('express').Response & { flush?: () => void };
  if (typeof r.flush === 'function') r.flush();
}
