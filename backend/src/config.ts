import os from 'os';
import path from 'path';

export const DATA_DIR = path.join(os.homedir(), '.agent-control-panel');
export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

export const CLAUDE_DIR = path.join(os.homedir(), '.claude');
export const GLOBAL_AGENTS_DIR = path.join(CLAUDE_DIR, 'agents');
export const GLOBAL_SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');

export const PATHS = {
  sessions: path.join(DATA_DIR, 'sessions'),
};

export function workspaceClaudeDir(workspacePath: string): string {
  return path.join(expandHome(workspacePath), '.claude');
}

export function workspaceAgentsDir(workspacePath: string): string {
  return path.join(workspaceClaudeDir(workspacePath), 'agents');
}

export function workspaceSkillsDir(workspacePath: string): string {
  return path.join(workspaceClaudeDir(workspacePath), 'skills');
}

export function workspaceWorkflowsDir(workspacePath: string): string {
  return path.join(workspaceClaudeDir(workspacePath), 'workflows');
}

export function workspaceTasksDir(workspacePath: string): string {
  return path.join(workspaceClaudeDir(workspacePath), 'tasks');
}

export function workspaceMemoryPath(workspacePath: string): string {
  return path.join(workspaceClaudeDir(workspacePath), 'memory.md');
}

export function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p === '~') return os.homedir();
  return p;
}
