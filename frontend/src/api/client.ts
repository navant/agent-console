import { AgentConfig, WorkspaceConfig, TaskConfig, SkillConfig, WSServerMessage } from '../types';

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

// ─── Agents ───────────────────────────────────────────────────────────────────
export const getAgents = () => request<AgentConfig[]>('/agents');
export const createAgent = (data: Partial<AgentConfig>) =>
  request<AgentConfig>('/agents', { method: 'POST', body: JSON.stringify(data) });
export const updateAgent = (id: string, data: Partial<AgentConfig>) =>
  request<AgentConfig>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAgent = (id: string) =>
  request<void>(`/agents/${id}`, { method: 'DELETE' });

// ─── Workspaces ───────────────────────────────────────────────────────────────
export const getWorkspaces = () => request<WorkspaceConfig[]>('/workspaces');
export const createWorkspace = (data: Partial<WorkspaceConfig>) =>
  request<WorkspaceConfig>('/workspaces', { method: 'POST', body: JSON.stringify(data) });
export const deleteWorkspace = (id: string) =>
  request<void>(`/workspaces/${id}`, { method: 'DELETE' });

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const getTasks = () => request<TaskConfig[]>('/tasks');
export const createTask = (data: Partial<TaskConfig>) =>
  request<TaskConfig>('/tasks', { method: 'POST', body: JSON.stringify(data) });
export const updateTask = (id: string, data: Partial<TaskConfig>) =>
  request<TaskConfig>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTask = (id: string) =>
  request<void>(`/tasks/${id}`, { method: 'DELETE' });

// ─── Skills ───────────────────────────────────────────────────────────────────
export const getSkills = () => request<SkillConfig[]>('/skills');

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
      console.warn('[ws] not connected, queuing message is not supported');
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
