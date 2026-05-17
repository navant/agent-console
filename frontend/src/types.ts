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

// Chat messages displayed in the UI
export interface ChatMessage {
  type: 'system' | 'text' | 'tool_use' | 'tool_result' | 'user';
  text?: string;
  tool?: string;
  input?: unknown;
}

// WebSocket server → client messages
export type WSServerMessage =
  | { type: 'session_start'; sessionId: string; taskId: string }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; input: unknown }
  | { type: 'tool_result'; content: string }
  | { type: 'done'; result: string }
  | { type: 'error'; message: string }
  | { type: 'task_update'; task: TaskConfig };
