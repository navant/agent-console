export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  tint: string;
  tools: string[];
  skills: string[];
  memory: boolean;
  soul?: string;
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  path: string;
  description?: string;
}

export interface TaskConfig {
  id: string;
  title: string;
  agent: string;
  workspace: string;
  status: 'todo' | 'running' | 'review' | 'done';
  session_id?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillConfig {
  id: string;
  name: string;
  content?: string;
}

// WebSocket message types
export type WSServerMessage =
  | { type: 'session_start'; sessionId: string; taskId: string }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; input: unknown }
  | { type: 'tool_result'; content: string }
  | { type: 'done'; result: string }
  | { type: 'error'; message: string }
  | { type: 'task_update'; task: TaskConfig };

export type WSClientMessage =
  | { type: 'run_task'; taskId: string }
  | { type: 'chat'; message: string; agentName: string; sessionId?: string }
  | { type: 'stop' };
