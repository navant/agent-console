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
  GoalFile,
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
export interface SetupConsoleResult {
  workspacePath: string;
  agentsDir: string;
  skillsDir: string;
  agents: { copied: string[]; skipped: string[] };
  skills: { copied: string[]; skipped: string[] };
}
export const setupConsole = () =>
  request<SetupConsoleResult>('/config/setup', { method: 'POST' });

export interface MemorySetupStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'ok' | 'skipped' | 'failed';
  detail?: string;
}

export type MemorySetupStreamEvent =
  | { type: 'plan'; steps: { id: string; label: string }[] }
  | { type: 'step'; step: MemorySetupStep }
  | { type: 'log'; line: string }
  | { type: 'done'; result: MemorySetupResult };

export interface MemorySetupResult {
  success: boolean;
  workspacePath: string;
  steps: MemorySetupStep[];
  log: string;
  hints: string[];
  memoryTier: 'claude-mem';
}

export const setupMemory = async (): Promise<MemorySetupResult> => {
  const res = await fetch(`${BASE}/config/setup-memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = (await res.json()) as MemorySetupResult & { error?: string };
  if (res.status === 422 && data.steps) return data;
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

function streamApiBase(): string {
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:3001/api';
  }
  return BASE;
}

async function readMemoryStream(
  path: string,
  onEvent: (event: MemorySetupStreamEvent) => void,
  signal?: AbortSignal
): Promise<MemorySetupResult> {
  const res = await fetch(`${streamApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
  });
  if (!res.body) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();

  const decoder = new TextDecoder();
  let buffer = '';
  let result: MemorySetupResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as MemorySetupStreamEvent;
      onEvent(event);
      if (event.type === 'done') result = event.result;
    }
  }
  if (buffer.trim()) {
    const event = JSON.parse(buffer) as MemorySetupStreamEvent;
    onEvent(event);
    if (event.type === 'done') result = event.result;
  }
  if (!result) throw new Error('Stream ended without result');
  return result;
}

export interface MemoryDependencyInstallStep {
  id: string;
  title: string;
  commands: readonly string[];
  note: string;
}

export interface MemoryDependencyStatus {
  claude: boolean;
  jq: boolean;
  codegraphMcp: boolean;
  codegraphProject: boolean;
  claudeMemWorker: boolean;
  claudeMemPort?: number;
  bridgeInstalled: boolean;
}

export const getMemoryDeps = () =>
  request<{ installSteps: MemoryDependencyInstallStep[]; status: MemoryDependencyStatus }>(
    '/config/memory-deps'
  );

export const setupMemoryStream = (
  onEvent: (event: MemorySetupStreamEvent) => void,
  signal?: AbortSignal
) => readMemoryStream('/config/setup-memory/stream', onEvent, signal);

export const refreshMemoryStream = (
  onEvent: (event: MemorySetupStreamEvent) => void,
  signal?: AbortSignal
) => readMemoryStream('/config/refresh-memory/stream', onEvent, signal);
export const switchWorkspace = (workspaceId: string) =>
  request<{ activeWorkspace: string; workspace: WorkspaceConfig }>('/config/workspace', {
    method: 'POST',
    body: JSON.stringify({ workspaceId }),
  });

// ─── Agents ───────────────────────────────────────────────────────────────────
export const getAgents = () => request<AgentConfig[]>('/agents');
export const getAgentFile = (id: string, source: 'global' | 'workspace') =>
  request<{ id: string; source: string; path: string; content: string }>(
    `/agents/${encodeURIComponent(id)}/file?source=${source}`
  );
export const saveAgentFile = (id: string, content: string) =>
  request<{ id: string; path: string; content: string }>(`/agents/${encodeURIComponent(id)}/file`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
export const createAgentFile = (id: string, content?: string) =>
  request<AgentConfig>('/agents', {
    method: 'POST',
    body: JSON.stringify({ id, name: id, source: 'workspace', content }),
  });
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
export const deletePrdFile = (path: string) =>
  request<{ ok: boolean }>(`/prd/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
export const createPrd = (filename: string, content?: string) =>
  request<PrdFile>('/prd', {
    method: 'POST',
    body: JSON.stringify({ filename, content }),
  });
// ─── Goals ────────────────────────────────────────────────────────────────────
export const getGoalFiles = () => request<GoalFile[]>('/goals');
export const getGoalFile = (path: string) =>
  request<{ path: string; content: string }>(`/goals/file?path=${encodeURIComponent(path)}`);
export const saveGoalFile = (path: string, content: string) =>
  request<{ path: string; content: string }>('/goals/file', {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  });
export const deleteGoalFile = (path: string) =>
  request<{ ok: boolean }>(`/goals/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
export const createGoal = (filename: string, content?: string) =>
  request<GoalFile>('/goals', {
    method: 'POST',
    body: JSON.stringify({ filename, content }),
  });
export const invokeGoal = (data: {
  goalPath: string;
  agent?: string;
  workflow?: string;
  skills?: string[];
  title?: string;
  taskType?: string;
}) => request<TaskConfig>('/goals/invoke', { method: 'POST', body: JSON.stringify(data) });

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

export const extractTaskQuestions = (taskId: string) =>
  request<{ comment: TaskComment }>(`/tasks/${taskId}/questions/extract`, {
    method: 'POST',
  });

export const answerTaskQuestions = (
  taskId: string,
  commentId: string,
  answers: Record<string, string | string[]>
) =>
  request<{ ok: boolean; prdUpdated: boolean; prdPath?: string; userComment: TaskComment }>(
    `/tasks/${taskId}/questions/${commentId}/answer`,
    { method: 'POST', body: JSON.stringify({ answers }) }
  );

export const runTask = (taskId: string, nudge = false) =>
  wsManager.send({ type: 'run_task', taskId, nudge });

export const runTaskPlanPhase = (
  taskId: string,
  phase: 'write-prd' | 'convert-ralph'
) => wsManager.send({ type: 'run_task_plan', taskId, phase });

export const startAutoQueue = () => wsManager.send({ type: 'auto_queue_start' });
export const stopAutoQueue = () => wsManager.send({ type: 'auto_queue_stop' });

// ─── Skills ───────────────────────────────────────────────────────────────────
export const getSkills = () => request<SkillConfig[]>('/skills');
export const getSkillFile = (id: string, source: 'global' | 'workspace') =>
  request<{ id: string; source: string; path: string; content: string }>(
    `/skills/${encodeURIComponent(id)}/file?source=${source}`
  );
export const saveSkillFile = (id: string, content: string) =>
  request<{ id: string; path: string; content: string }>(`/skills/${encodeURIComponent(id)}/file`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
export const createSkill = (id: string, content?: string) =>
  request<{ id: string; path: string; content: string }>('/skills', {
    method: 'POST',
    body: JSON.stringify({ id, content }),
  });

// ─── Workflows ────────────────────────────────────────────────────────────────
export interface ArchonWorkspaceStatus {
  gitRepo: boolean;
  jq: boolean;
  ralphScripts: boolean;
  ralphLoopWorkflow: boolean;
  projectArchonDir: boolean;
  projectEnvFile: boolean;
  workflowsDir: boolean;
  archonSkillInstalled: boolean;
  workflowCount?: number;
  globalEnvFile: boolean;
}

export interface WorkflowDepsResponse {
  installSteps: { id: string; label: string; command: string; note?: string }[];
  status: {
    archon: boolean;
    archonVersion?: string;
    archonError?: string;
    claude: boolean;
    jq: boolean;
    workspace?: ArchonWorkspaceStatus;
  };
}

export const getWorkflowDeps = () => request<WorkflowDepsResponse>('/workflows/deps');

export type ArchonSetupStepStatus = 'pending' | 'running' | 'ok' | 'skipped' | 'failed';

export interface ArchonSetupStep {
  id: string;
  label: string;
  status: ArchonSetupStepStatus;
  detail?: string;
}

export type ArchonSetupStreamEvent =
  | { type: 'plan'; steps: { id: string; label: string }[] }
  | { type: 'step'; step: ArchonSetupStep }
  | { type: 'log'; line: string }
  | { type: 'done'; result: ArchonSetupResult };

export interface ArchonSetupResult {
  success: boolean;
  workspacePath: string;
  steps: ArchonSetupStep[];
  log: string;
  hints: string[];
}

async function readArchonStream(
  path: string,
  onEvent: (event: ArchonSetupStreamEvent) => void,
  signal?: AbortSignal
): Promise<ArchonSetupResult> {
  const res = await fetch(`${streamApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
  });
  if (!res.body) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ArchonSetupResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ArchonSetupStreamEvent;
      onEvent(event);
      if (event.type === 'done') result = event.result;
    }
  }
  if (buffer.trim()) {
    const event = JSON.parse(buffer) as ArchonSetupStreamEvent;
    onEvent(event);
    if (event.type === 'done') result = event.result;
  }
  if (!result) throw new Error('Stream ended without result');
  return result;
}

export const setupWorkspaceStream = (
  onEvent: (event: ArchonSetupStreamEvent) => void,
  signal?: AbortSignal
) => readArchonStream('/workflows/setup-workspace/stream', onEvent, signal);

/** @deprecated alias */
export const setupArchonStream = setupWorkspaceStream;

export const getWorkflows = () => request<WorkflowConfig[]>('/workflows');
export const getWorkflowFile = (
  id: string,
  source: 'global' | 'workspace' | 'builtin' | 'archon'
) =>
  request<{ id: string; source: string; path: string; content: string }>(
    `/workflows/${encodeURIComponent(id)}/file?source=${source}`
  );
export const saveWorkflowFile = (id: string, content: string) =>
  request<{ id: string; path: string; content: string }>(`/workflows/${encodeURIComponent(id)}/file`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
export const createWorkflow = (data: Partial<WorkflowConfig> & { content?: string }) =>
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
