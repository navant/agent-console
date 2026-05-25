import { spawn } from 'child_process';
import path from 'path';
import { expandHome } from '../config';

export interface ArchonWorkflowSummary {
  id: string;
  name: string;
  description?: string;
  source: 'archon';
}

export interface ArchonProbeResult {
  available: boolean;
  version?: string;
  error?: string;
}

export function runArchon(
  args: string[],
  cwd: string,
  timeoutMs = 120_000
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('archon', args, {
      cwd: expandHome(cwd),
      env: process.env,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('archon command timed out'));
    }, timeoutMs);

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

export async function probeArchon(): Promise<ArchonProbeResult> {
  try {
    const { stdout, code } = await runArchon(['version'], process.cwd(), 15_000);
    if (code !== 0) return { available: false, error: stdout };
    const firstLine = stdout.split('\n').find(l => l.includes('Archon')) ?? stdout.trim();
    return { available: true, version: firstLine };
  } catch (err) {
    return { available: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** List workflows Archon discovers in the workspace directory. */
export async function listArchonWorkflows(workspacePath: string): Promise<ArchonWorkflowSummary[]> {
  const { stdout, stderr, code } = await runArchon(
    ['workflow', 'list', '--json', '--quiet'],
    workspacePath,
    60_000
  );
  if (code !== 0) {
    throw new Error(stderr || stdout || `archon workflow list exited ${code}`);
  }

  const trimmed = stdout.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(row => normalizeWorkflowRow(row));
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { workflows?: unknown }).workflows)) {
      return ((parsed as { workflows: unknown[] }).workflows).map(normalizeWorkflowRow);
    }
  } catch {
    // fall through to line parse
  }

  return parseWorkflowListText(stdout);
}

function normalizeWorkflowRow(row: unknown): ArchonWorkflowSummary {
  if (row && typeof row === 'object') {
    const o = row as Record<string, unknown>;
    const id = String(o.name ?? o.id ?? 'unknown');
    return {
      id,
      name: id,
      description: typeof o.description === 'string' ? o.description : undefined,
      source: 'archon',
    };
  }
  const id = String(row);
  return { id, name: id, source: 'archon' };
}

function parseWorkflowListText(text: string): ArchonWorkflowSummary[] {
  const ids: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s{2}([a-z0-9][a-z0-9-]*)\s*$/i);
    if (m) ids.push(m[1]);
  }
  return ids.map(id => ({ id, name: id, source: 'archon' }));
}

export async function runArchonWorkflow(
  workspacePath: string,
  workflowId: string,
  message: string,
  onLine: (line: string) => void,
  onSpawn?: (child: ReturnType<typeof spawn>) => void
): Promise<{ code: number; stderr: string }> {
  const args = ['workflow', 'run', workflowId];
  if (message.trim()) args.push(message.trim());

  return new Promise((resolve, reject) => {
    const child = spawn('archon', args, {
      cwd: expandHome(workspacePath),
      env: process.env,
    });
    onSpawn?.(child);
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => onLine(d.toString()));
    child.stderr.on('data', (d: Buffer) => {
      const t = d.toString();
      stderr += t;
      onLine(t);
    });
    child.on('error', reject);
    child.on('close', code => resolve({ code: code ?? 1, stderr }));
  });
}
