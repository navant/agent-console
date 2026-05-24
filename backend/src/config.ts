import os from 'os';
import path from 'path';
import { PathSettings } from './types';

export const DATA_DIR = path.join(os.homedir(), '.agent-control-panel');
export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

export const CLAUDE_DIR = path.join(os.homedir(), '.claude');

export const PATHS = {
  sessions: path.join(DATA_DIR, 'sessions'),
};

export const DEFAULT_PATH_SETTINGS: PathSettings = {
  prd: '.claude/prd',
  skills: '.claude/skills',
  agents: '.claude/agents',
  tasks: '.claude/tasks',
  memory: '.claude/memory',
  workflows: '.claude/workflows',
  globalAgents: '~/.claude/agents',
  globalSkills: '~/.claude/skills',
};

export function mergePathSettings(partial?: Partial<PathSettings>): PathSettings {
  return { ...DEFAULT_PATH_SETTINGS, ...partial };
}

export function resolveGlobalPath(settings: PathSettings, key: 'globalAgents' | 'globalSkills'): string {
  return expandHome(settings[key]);
}

export function resolveWorkspacePath(
  workspacePath: string,
  settings: PathSettings,
  key: Exclude<keyof PathSettings, 'globalAgents' | 'globalSkills'>
): string {
  const rel = settings[key].replace(/^\.\//, '');
  return path.join(expandHome(workspacePath), rel);
}

export function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p === '~') return os.homedir();
  return p;
}

// Legacy helpers — prefer resolveWorkspacePath with getPathSettings() from fileStore
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

export function workspacePrdDir(workspacePath: string): string {
  return path.join(workspaceClaudeDir(workspacePath), 'prd');
}

export function workspaceMemoryPath(workspacePath: string): string {
  return path.join(workspaceClaudeDir(workspacePath), 'memory.md');
}
