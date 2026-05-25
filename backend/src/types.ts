export interface AppConfig {
  activeWorkspace: string | null;
  registeredWorkspaces: WorkspaceConfig[];
  memoryTier?: 'simple' | 'wiki' | 'claude-mem';
  pathSettings?: Partial<PathSettings>;
}

export interface PathSettings {
  prd: string;
  goals: string;
  skills: string;
  agents: string;
  tasks: string;
  memory: string;
  workflows: string;
  globalAgents: string;
  globalSkills: string;
  globalWorkflows: string;
}

export interface PrdFile {
  id: string;
  name: string;
  path: string;
  updatedAt?: string;
}

export interface GoalFile {
  id: string;
  name: string;
  path: string;
  updatedAt?: string;
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

export type TaskStatus =
  | 'todo'
  | 'planned'
  | 'running'
  | 'review'
  | 'awaiting_confirmation'
  | 'done'
  | 'archive';
export type TaskType = 'simple' | 'project';

export interface TaskTypeDef {
  id: string;
  name: string;
  agent: string;
  skills: string[];
  workflow: string;
  default?: boolean;
}

export interface TaskConfig {
  id: string;
  title: string;
  agent: string;
  workflow: string;
  status: TaskStatus;
  type: TaskType;
  skills: string[];
  taskType?: string;
  prd?: string;
  goal?: string;
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
  source: 'global' | 'workspace';
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

export type TaskCommentAuthor = 'user' | 'agent' | 'system';
export type TaskCommentKind = 'comment' | 'activity';

export interface TaskComment {
  id: string;
  author: TaskCommentAuthor;
  authorName?: string;
  body: string;
  kind: TaskCommentKind;
  createdAt: string;
}

export interface TaskCommentsFile {
  comments: TaskComment[];
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
  | { type: 'comment_append'; taskId: string; comment: TaskComment }
  | { type: 'automation_state'; autoQueue: boolean }
  | { type: 'story_complete'; taskId: string; storyId: string };

export type WSClientMessage =
  | { type: 'run_task'; taskId: string; nudge?: boolean }
  | { type: 'auto_queue_start' }
  | { type: 'auto_queue_stop' }
  | { type: 'chat'; message: string; agentName: string; sessionId?: string; taskId?: string; bootstrapSkills?: boolean }
  | { type: 'slash_command'; command: string; sessionId?: string }
  | { type: 'stop' };
