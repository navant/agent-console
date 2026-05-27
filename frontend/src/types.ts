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

export type TaskStatus =
  | 'todo'
  | 'planned'
  | 'running'
  | 'review'
  | 'awaiting_confirmation'
  | 'done'
  | 'archive';

export type WorkspaceViewId =
  | 'tasks'
  | 'task'
  | 'chat'
  | 'memory'
  | 'agents'
  | 'skills'
  | 'workflows'
  | 'prd'
  | 'goals'
  | 'settings'
  | 'setup';

export type HomeCapabilityId = 'chat' | 'tasks' | 'setup' | 'settings' | 'goals' | 'prd';

export type ChatDockMode = 'center' | 'side';

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

export interface WorkspaceTab {
  id: string;
  view: WorkspaceViewId;
  label: string;
  closable: boolean;
  taskId?: string;
}

export type MemoryFileKind = 'editable' | 'generated' | 'folder' | 'wiki' | 'agent';

export interface MemoryFileEntry {
  id: string;
  name: string;
  path: string;
  scope: 'workspace' | 'agent' | 'wiki';
  kind?: MemoryFileKind;
  description?: string;
  agentId?: string;
  isDir?: boolean;
  readOnly?: boolean;
  children?: MemoryFileEntry[];
}
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
  storyId?: string;
  storyPriority?: number;
  goal?: string;
  description?: string;
  session_id?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskCommentAuthor = 'user' | 'agent' | 'system';
export type TaskCommentKind = 'comment' | 'activity' | 'questions';

export interface AgentQuestionOption {
  label: string;
  description?: string;
}

export interface AgentQuestion {
  id: string;
  question: string;
  header?: string;
  multiSelect?: boolean;
  options?: AgentQuestionOption[];
}

export interface TaskComment {
  id: string;
  author: TaskCommentAuthor;
  authorName?: string;
  body: string;
  kind: TaskCommentKind;
  questions?: AgentQuestion[];
  answeredAt?: string;
  createdAt: string;
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
  description?: string;
  type: 'single' | 'loop';
  max_iterations?: number;
  commit_on_story?: boolean;
  agent?: string;
  skills: string[];
  task_type?: string;
  template: string;
  source: 'global' | 'workspace' | 'builtin' | 'archon';
}

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: number;
  passes: boolean;
  taskId?: string;
}

export interface PlanConfig {
  prdPath?: string;
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
  claudeMemAvailable?: boolean;
}

export interface AppConfig {
  activeWorkspace: string | null;
  registeredWorkspaces: WorkspaceConfig[];
  memoryTier?: 'simple' | 'wiki' | 'claude-mem';
  pathSettings?: PathSettings;
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

export type WSClientMessage =
  | { type: 'run_task'; taskId: string; nudge?: boolean }
  | { type: 'run_task_plan'; taskId: string; phase: 'write-prd' | 'convert-ralph' }
  | { type: 'auto_queue_start' }
  | { type: 'auto_queue_stop' }
  | { type: 'chat'; message: string; agentName: string; sessionId?: string; taskId?: string; bootstrapSkills?: boolean }
  | { type: 'slash_command'; command: string; sessionId?: string }
  | { type: 'stop' };

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
  | { type: 'automation_state'; autoQueue: boolean };
