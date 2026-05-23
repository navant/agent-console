export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  tools: string[];
  memory: boolean;
  soul?: string;
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

export type WorkspaceViewId =
  | 'tasks'
  | 'chat'
  | 'memory'
  | 'agents'
  | 'skills'
  | 'workflows'
  | 'prd';

export interface WorkspaceTab {
  id: string;
  view: WorkspaceViewId;
  label: string;
  closable: boolean;
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

export interface MemoryState {
  tier: 'simple' | 'wiki' | 'claude-mem';
  workspace: MemoryFile;
  agents: MemoryFile[];
  files?: MemoryFileEntry[];
}

export interface AppConfig {
  activeWorkspace: string | null;
  registeredWorkspaces: WorkspaceConfig[];
  memoryTier?: 'simple' | 'wiki' | 'claude-mem';
}

export interface WorkspacesResponse {
  workspaces: WorkspaceConfig[];
  activeWorkspace: string | null;
}

export interface CreateWorkspaceResponse extends WorkspacesResponse {
  workspace: WorkspaceConfig;
}

export interface ChatMessage {
  type: 'system' | 'text' | 'tool_use' | 'tool_result' | 'user';
  text?: string;
  tool?: string;
  input?: unknown;
}

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
