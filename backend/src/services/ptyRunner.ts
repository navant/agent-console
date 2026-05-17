import * as pty from 'node-pty';
import os from 'os';
import path from 'path';
import fs from 'fs';

export interface PtySession {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

export interface PtyOptions {
  sessionId?: string;       // resume existing Claude session
  agentId?: string;
  model?: string;
  soulPath?: string;
  tools?: string[];
  workspacePath?: string;
  cols?: number;
  rows?: number;
  onData: (data: string) => void;
  onExit: () => void;
}

export function spawnPty(opts: PtyOptions): PtySession {
  const { sessionId, model, soulPath, tools, workspacePath, cols = 220, rows = 50, onData, onExit } = opts;

  const args: string[] = [];

  if (sessionId) {
    args.push('--resume', sessionId);
  } else {
    if (model) args.push('--model', model);
    if (soulPath && fs.existsSync(soulPath)) args.push('--append-system-prompt-file', soulPath);
    if (tools && tools.length > 0) args.push('--allowedTools', ...tools);
    const resolved = workspacePath ? expandHome(workspacePath) : null;
    if (resolved && fs.existsSync(resolved)) args.push('--add-dir', resolved);
  }

  // --dangerously-skip-permissions so tools don't block
  args.push('--dangerously-skip-permissions');

  const cwd = workspacePath ? expandHome(workspacePath) : os.homedir();

  const proc = pty.spawn('claude', args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: fs.existsSync(cwd) ? cwd : os.homedir(),
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
  });

  proc.onData(onData);
  proc.onExit(() => onExit());

  return {
    write: (data) => { try { proc.write(data); } catch {} },
    resize: (c, r) => { try { proc.resize(c, r); } catch {} },
    kill: () => { try { proc.kill(); } catch {} },
  };
}
