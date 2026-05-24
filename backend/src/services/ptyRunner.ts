import * as pty from 'node-pty';
import os from 'os';
import { expandHome } from '../config';

/**
 * Comprehensive ANSI/VT escape sequence stripper.
 * Handles: CSI (including private ?), OSC, DCS, APC, PM, SOS, 2-char escapes.
 */
function stripAnsi(str: string): string {
  return str
    // OSC (Operating System Command): ESC ] ... ST or ESC ] ... BEL
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '')
    // DCS/PM/APC/SOS: ESC [P^_X] ... ST
    .replace(/\x1B[P^_X][\s\S]*?\x1B\\/g, '')
    // CSI: ESC [ (optionally ?) + params + final byte
    .replace(/\x1B\[[\x3C-\x3F]?[\d;]*[\x20-\x2F]*[\x40-\x7E]/g, '')
    // 2-char: ESC + single printable (M, (, ), >, <, = etc.)
    .replace(/\x1B[\x40-\x5F\x60-\x7E]/g, '')
    // Remaining bare ESC
    .replace(/\x1B/g, '')
    // Non-printing control chars (keep \n, \t)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function cleanOutput(raw: string): string {
  return stripAnsi(raw)
    .split('\n')
    .map(l => l.replace(/\r/g, '').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Detect bypass-permissions confirmation prompt
const BYPASS_PROMPT_RE = /Yes.*accept|No.*exit|Bypass Permissions/i;

export interface SlashCommandOpts {
  command: string;
  sessionId?: string;
  workspacePath?: string;
  onOutput: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

let activeProc: pty.IPty | null = null;

export function stopRalph(): void {
  if (activeProc) { try { activeProc.kill(); } catch {} activeProc = null; }
}

export function runSlashCommand(opts: SlashCommandOpts): void {
  const { command, sessionId, workspacePath, onOutput, onDone, onError } = opts;

  stopRalph();

  const args: string[] = ['--dangerously-skip-permissions'];
  if (sessionId) args.push('--resume', sessionId);

  const cwd = workspacePath ? expandHome(workspacePath) : os.homedir();

  let proc: pty.IPty;
  try {
    proc = pty.spawn('claude', args, {
      cols: 200,
      rows: 50,
      cwd,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', TERM: 'dumb' },
    });
  } catch (err) {
    onError(String(err));
    return;
  }

  activeProc = proc;

  type Phase = 'init' | 'command_sent' | 'done';
  let phase: Phase = 'init';
  let bypassAccepted = false;
  let responseBuffer = '';
  let initTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = () => {
    if (phase === 'done') return;
    phase = 'done';
    if (idleTimer) clearTimeout(idleTimer);
    if (initTimer) clearTimeout(initTimer);
    try { proc.kill(); } catch {}
    activeProc = null;
    const text = cleanOutput(responseBuffer);
    if (text) onOutput(text);
    onDone();
  };

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(finish, 3000);
  };

  proc.onData((data: string) => {
    const stripped = cleanOutput(data);

    // Auto-accept bypass permissions dialog at any phase
    if (!bypassAccepted && BYPASS_PROMPT_RE.test(stripped)) {
      bypassAccepted = true;
      proc.write('2\r'); // Select "Yes, I accept"
      return;
    }

    if (phase === 'init') return; // Ignore welcome banner

    responseBuffer += data;
    resetIdleTimer();
  });

  proc.onExit(({ exitCode }) => {
    if (idleTimer) clearTimeout(idleTimer);
    if (initTimer) clearTimeout(initTimer);
    activeProc = null;
    if (phase === 'done') return;
    phase = 'done';
    const text = cleanOutput(responseBuffer);
    if (text) onOutput(text);
    if (exitCode !== 0 && !text) {
      onError(`claude exited with code ${exitCode}`);
    } else {
      onDone();
    }
  });

  // Wait for claude to load the session, then send the command
  initTimer = setTimeout(() => {
    if (phase !== 'init') return;
    phase = 'command_sent';
    proc.write(command + '\r');
    resetIdleTimer();
  }, 2000);
}
