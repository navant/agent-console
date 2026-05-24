import {
  AgentConfig,
  AppConfig,
  MemoryState,
  MemoryFileEntry,
  PlanConfig,
  SkillConfig,
  TaskConfig,
  TaskComment,
  TaskTypeDef,
  WorkflowConfig,
  WorkspaceConfig,
  WorkspacesResponse,
  PathSettings,
  PrdFile,
  CreateWorkspaceResponse,
  WSServerMessage,
} from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Config ───────────────────────────────────────────────────────────────────
export const getConfig = () => request<AppConfig>('/config');
export const updatePathSettings = (paths: Partial<PathSettings>) =>
  request<PathSettings>('/config/paths', { method: 'PUT', body: JSON.stringify(paths) });
export const switchWorkspace = (workspaceId: string) =>
  request<{ activeWorkspace: string; workspace: WorkspaceConfig }>('/config/workspace', {
    method: 'POST',
    body: JSON.stringify({ workspaceId }),
  });

// ─── Agents ───────────────────────────────────────────────────────────────────
export const getAgents = () => request<AgentConfig[]>('/agents');
export const createAgent = (data: Partial<AgentConfig> & { source?: 'global' | 'workspace' }) =>
  request<AgentConfig>('/agents', { method: 'POST', body: JSON.stringify(data) });
export const updateAgent = (id: string, data: Partial<AgentConfig>) =>
  request<AgentConfig>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAgentApi = (id: string) =>
  request<void>(`/agents/${id}`, { method: 'DELETE' });

// ─── Workspaces ───────────────────────────────────────────────────────────────
export const getWorkspaces = () => request<WorkspacesResponse>('/workspaces');
export const createWorkspace = (data: Partial<WorkspaceConfig>) =>
  request<CreateWorkspaceResponse>('/workspaces', { method: 'POST', body: JSON.stringify(data) });
export const activateWorkspace = (id: string) =>
  request<WorkspaceConfig>(`/workspaces/${id}/activate`, { method: 'POST' });
export const deleteWorkspace = (id: string) =>
  request<void>(`/workspaces/${id}`, { method: 'DELETE' });

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const getTasks = () => request<TaskConfig[]>('/tasks');
export const getTask = (id: string) =>
  request<TaskConfig & { prompt?: string }>(`/tasks/${id}`);
export const createTask = (data: {
  title: string;
  agent?: string;
  workflow?: string;
  skills?: string[];
  description?: string;
  prd?: string;
  taskType?: string;
}) => request<TaskConfig>('/tasks', { method: 'POST', body: JSON.stringify(data) });

export const getTaskTypes = () => request<{ types: TaskTypeDef[] }>('/task-types');
export const saveTaskTypes = (types: TaskTypeDef[]) =>
  request<{ types: TaskTypeDef[] }>('/task-types', { method: 'PUT', body: JSON.stringify({ types }) });

// ─── PRD ──────────────────────────────────────────────────────────────────────
export const getPrdFiles = () => request<PrdFile[]>('/prd');
export const getPrdFile = (path: string) =>
  request<{ path: string; content: string }>(`/prd/file?path=${encodeURIComponent(path)}`);
export const savePrdFile = (path: string, content: string) =>
  request<{ path: string; content: string }>('/prd/file', {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  });
export const createPrd = (filename: string, content?: string) =>
  request<{ file: PrdFile; task: TaskConfig | null }>('/prd', {
    method: 'POST',
    body: JSON.stringify({ filename, content }),
  });
export const implementPrd = (data: {
  prdPath: string;
  agent?: string;
  workflow?: string;
  skills?: string[];
  title?: string;
  taskType?: string;
}) => request<TaskConfig>('/prd/implement', { method: 'POST', body: JSON.stringify(data) });
export const updateTask = (id: string, data: Partial<TaskConfig> & { description?: string }) =>
  request<TaskConfig>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTask = (id: string) =>
  request<void>(`/tasks/${id}`, { method: 'DELETE' });

export const getTaskPlan = (id: string) => request<PlanConfig>(`/tasks/${id}/plan`);
export const saveTaskPlan = (id: string, plan: PlanConfig) =>
  request<PlanConfig>(`/tasks/${id}/plan`, { method: 'PUT', body: JSON.stringify(plan) });
export const generateTaskPlan = (id: string, description?: string) =>
  request<PlanConfig>(`/tasks/${id}/plan/generate`, {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
export const getTaskProgress = (id: string) =>
  request<{ content: string }>(`/tasks/${id}/progress`);
export const getTaskMarkdown = (id: string) =>
  request<{ content: string }>(`/tasks/${id}/markdown`);
export const saveTaskMarkdown = (id: string, content: string) =>
  request<{ task: TaskConfig; content: string }>(`/tasks/${id}/markdown`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
export const confirmTask = (id: string) =>
  request<TaskConfig>(`/tasks/${id}/confirm`, { method: 'POST' });
export const rejectTask = (id: string) =>
  request<TaskConfig>(`/tasks/${id}/reject`, { method: 'POST' });
export const getTaskComments = (id: string) =>
  request<{ comments: TaskComment[] }>(`/tasks/${id}/comments`);
export const addTaskComment = (id: string, text: string) =>
  request<TaskComment>(`/tasks/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

export const runTask = (taskId: string, nudge = false) =>
  wsManager.send({ type: 'run_task', taskId, nudge });

export const startAutoQueue = () => wsManager.send({ type: 'auto_queue_start' });
export const stopAutoQueue = () => wsManager.send({ type: 'auto_queue_stop' });

// ─── Skills ───────────────────────────────────────────────────────────────────
export const getSkills = () => request<SkillConfig[]>('/skills');

// ─── Workflows ────────────────────────────────────────────────────────────────
export const getWorkflows = () => request<WorkflowConfig[]>('/workflows');
export const createWorkflow = (data: Partial<WorkflowConfig>) =>
  request<WorkflowConfig>('/workflows', { method: 'POST', body: JSON.stringify(data) });
export const updateWorkflow = (id: string, data: Partial<WorkflowConfig>) =>
  request<WorkflowConfig>(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteWorkflow = (id: string) =>
  request<void>(`/workflows/${id}`, { method: 'DELETE' });

// ─── Browse ───────────────────────────────────────────────────────────────────
export interface BrowseResult {
  path: string;
  parent: string;
  entries: { name: string; path: string }[];
}

export const browseDirectory = (path = '~') =>
  request<BrowseResult>(`/browse?path=${encodeURIComponent(path)}`);

// ─── Memory ───────────────────────────────────────────────────────────────────
export const getMemory = () => request<MemoryState>('/memory');
export const saveWorkspaceMemory = (content: string) =>
  request<MemoryState>('/memory/workspace', { method: 'PUT', body: JSON.stringify({ content }) });
export const saveAgentMemory = (agentId: string, content: string) =>
  request<MemoryState>(`/memory/agent/${agentId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
export const getMemoryFiles = () =>
  request<{ files: MemoryFileEntry[] }>('/memory/files');
export const getMemoryFile = (path: string, agentId?: string) =>
  request<{ path: string; content: string }>(
    `/memory/file?path=${encodeURIComponent(path)}${agentId ? `&agentId=${encodeURIComponent(agentId)}` : ''}`
  );
export const saveMemoryFile = (path: string, content: string, agentId?: string) =>
  request<MemoryState>('/memory/file', {
    method: 'PUT',
    body: JSON.stringify({ path, content, agentId }),
  });

// ─── Sessions ─────────────────────────────────────────────────────────────────
export interface SessionSummary {
  sessionId: string;
  project: string;
  projectPath: string;
  aiTitle: string;
  firstMessage: string;
  timestamp: string;
  messageCount: number;
}

export interface HistoryMessage {
  type: 'user' | 'text' | 'tool_use' | 'tool_result' | 'system';
  text?: string;
  tool?: string;
  input?: unknown;
  timestamp?: string;
}

export const getSessions = () => request<SessionSummary[]>('/sessions');
export const getSessionMessages = (sessionId: string) =>
  request<HistoryMessage[]>(`/sessions/${sessionId}/messages`);

// ─── WebSocket Manager ────────────────────────────────────────────────────────

type MessageHandler = (msg: WSServerMessage) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[ws] connected');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WSServerMessage;
        this.handlers.forEach(h => h(msg));
      } catch {
        console.error('[ws] failed to parse message:', event.data);
      }
    };

    this.ws.onclose = () => {
      console.log('[ws] disconnected');
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[ws] error:', err);
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('[ws] not connected');
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsManager = new WebSocketManager(
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
);
