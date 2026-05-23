export interface AppConfig {
  activeWorkspace: string | null;
  registeredWorkspaces: WorkspaceConfig[];
  memoryTier?: 'simple' | 'wiki' | 'claude-mem';
}

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  tools: string[];
  memory: boolean;
  soul: string;
  source: 'global' | 'workspace';
  tint?: string;
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  path: string;
  description?: string;
}

export type TaskStatus = 'todo' | 'planned' | 'running' | 'review' | 'awaiting_confirmation' | 'done';
export type TaskType = 'simple' | 'project';

export interface TaskConfig {
  id: string;
  title: string;
  agent: string;
  workflow: string;
  status: TaskStatus;
  type: TaskType;
  skills: string[];
  session_id?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillConfig {
  id: string;
  name: string;
  content: string;
  source: 'global' | 'workspace';
}

export interface WorkflowConfig {
  id: string;
  name: string;
  type: 'loop' | 'single';
  max_iterations?: number;
  commit_on_story?: boolean;
  template: string;
}

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
}

export interface PlanConfig {
  userStories: UserStory[];
}

export interface MemoryFile {
  id: string;
  name: string;
  path: string;
  content: string;
  updatedAt?: string;
}

export interface MemoryFileEntry {
  id: string;
  name: string;
  path: string;
  scope: 'workspace' | 'agent' | 'wiki';
  agentId?: string;
  isDir?: boolean;
  children?: MemoryFileEntry[];
}

export interface MemoryState {
  tier: 'simple' | 'wiki' | 'claude-mem';
  workspace: MemoryFile;
  agents: MemoryFile[];
  files?: MemoryFileEntry[];
  wikiFiles?: MemoryFile[];
  claudeMemAvailable?: boolean;
}

// WebSocket message types
export type WSServerMessage =
  | { type: 'session_start'; sessionId: string; taskId: string }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; input: unknown }
  | { type: 'tool_result'; content: string }
  | { type: 'done'; result: string }
  | { type: 'error'; message: string }
  | { type: 'task_update'; task: TaskConfig }
  | { type: 'progress_append'; taskId: string; line: string }
  | { type: 'story_complete'; taskId: string; storyId: string };

export type WSClientMessage =
  | { type: 'run_task'; taskId: string }
  | { type: 'chat'; message: string; agentName: string; sessionId?: string }
  | { type: 'stop' };
