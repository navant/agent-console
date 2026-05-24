import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { appendSessionLog } from './fileStore';

export type LineCallback = (msg: OutMessage) => void;

export type OutMessage =
  | { type: 'session_start'; sessionId: string; taskId: string }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; input: unknown }
  | { type: 'tool_result'; content: string }
  | { type: 'done'; result: string }
  | { type: 'error'; message: string };

function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

export interface RunOptions {
  taskId: string;
  prompt: string;
  agentId: string;
  model: string;
  soulPath: string;
  workspacePath?: string;
  tools: string[];
  sessionId?: string;
  onMessage: LineCallback;
  onDone: (sessionId: string) => void;
  onError: (err: string) => void;
}

let activeProcess: ChildProcess | null = null;

export function isClaudeRunning(): boolean {
  return activeProcess !== null;
}

export function stopActive(): void {
  if (activeProcess) {
    activeProcess.kill('SIGTERM');
    activeProcess = null;
  }
}

export function runClaude(opts: RunOptions): void {
  const { taskId, prompt, model, soulPath, workspacePath, tools, sessionId, onMessage, onDone, onError } = opts;

  stopActive();

  const args: string[] = ['-p', prompt];

  // Required for stream-json
  args.push('--output-format', 'stream-json');
  args.push('--verbose');

  // Skip permission prompts (we're running headless)
  args.push('--dangerously-skip-permissions');

  const resolvedWorkspace = workspacePath ? expandHome(workspacePath) : null;
  if (resolvedWorkspace && fs.existsSync(resolvedWorkspace)) {
    args.push('--add-dir', resolvedWorkspace);
  }

  if (sessionId) {
    args.push('--resume', sessionId);
  } else {
    if (model) args.push('--model', model);

    if (soulPath && fs.existsSync(soulPath)) {
      args.push('--append-system-prompt-file', soulPath);
    }

    if (tools.length > 0) {
      args.push('--allowedTools', ...tools);
    }
  }

  let capturedSessionId = sessionId || '';
  let buffer = '';

  const spawnOpts: { env: NodeJS.ProcessEnv; cwd?: string } = {
    env: { ...process.env, FORCE_COLOR: '0' },
  };

  // Run claude in the workspace directory if provided
  if (workspacePath) {
    const resolved = expandHome(workspacePath);
    if (fs.existsSync(resolved)) spawnOpts.cwd = resolved;
  }

  const proc = spawn('claude', args, {
    ...spawnOpts,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcess = proc;

  proc.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (capturedSessionId) appendSessionLog(capturedSessionId, trimmed);

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        // Not JSON — emit as raw text (shouldn't happen with stream-json)
        onMessage({ type: 'text', content: trimmed });
        continue;
      }

      const messages = parseEvent(event, taskId);
      for (const m of messages) {
        if (m.type === 'session_start') {
          capturedSessionId = m.sessionId;
          appendSessionLog(capturedSessionId, trimmed);
        }
        onMessage(m);
      }
    }
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg) onMessage({ type: 'error', message: msg });
  });

  proc.on('close', (code) => {
    activeProcess = null;
    if (code === 0 || code === null) {
      onDone(capturedSessionId);
    } else {
      onError(`claude exited with code ${code}`);
    }
  });

  proc.on('error', (err) => {
    activeProcess = null;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      onError('claude binary not found in PATH — run: npm install -g @anthropic-ai/claude-code');
    } else {
      onError(err.message);
    }
  });
}

function parseEvent(event: Record<string, unknown>, taskId: string): OutMessage[] {
  const type = event.type as string;
  const out: OutMessage[] = [];

  if (type === 'system' && event.subtype === 'init') {
    const sid = event.session_id as string;
    if (sid) out.push({ type: 'session_start', sessionId: sid, taskId });
    return out;
  }

  if (type === 'assistant') {
    const msg = event.message as Record<string, unknown>;
    const content = msg?.content as Array<Record<string, unknown>>;
    if (!Array.isArray(content)) return out;

    for (const block of content) {
      const bt = block.type as string;
      if (bt === 'text') {
        const text = (block.text as string)?.trim();
        if (text) out.push({ type: 'text', content: text });
      } else if (bt === 'tool_use') {
        out.push({ type: 'tool_use', tool: block.name as string, input: block.input });
      }
      // 'thinking' blocks are intentionally skipped
    }
    return out;
  }

  // Tool results come back as type:"user" with tool_result content
  if (type === 'user') {
    const msg = event.message as Record<string, unknown>;
    const content = msg?.content as Array<Record<string, unknown>>;
    if (!Array.isArray(content)) return out;

    for (const block of content) {
      if (block.type === 'tool_result') {
        const raw = block.content;
        let text = '';
        if (typeof raw === 'string') {
          text = raw;
        } else if (Array.isArray(raw)) {
          text = (raw as Array<Record<string, unknown>>)
            .filter(c => c.type === 'text')
            .map(c => c.text as string)
            .join('\n');
        }
        out.push({ type: 'tool_result', content: text });
      }
    }
    return out;
  }

  if (type === 'result') {
    const result = (event.result as string) || '';
    out.push({ type: 'done', result });
    return out;
  }

  // rate_limit_event, hook events, etc — silently ignored
  return out;
}
