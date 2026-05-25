import { create } from 'zustand';
import {
  AgentConfig,
  MemoryState,
  PlanConfig,
  SkillConfig,
  TaskConfig,
  TaskComment,
  TaskTypeDef,
  WorkflowConfig,
  WorkspaceConfig,
  ChatMessage,
  PathSettings,
  PrdFile,
  WorkspaceTab,
  WorkspaceViewId,
} from '../types';

const VIEW_LABELS: Record<WorkspaceViewId, string> = {
  tasks: 'Tasks',
  task: 'Task',
  chat: 'Chat',
  memory: 'Memory',
  agents: 'Agents',
  skills: 'Skills',
  workflows: 'Workflows',
  prd: 'Planning',
  goals: 'Goals',
  settings: 'Settings',
};

const DEFAULT_TABS: WorkspaceTab[] = [
  { id: 'tab-tasks', view: 'tasks', label: 'Tasks', closable: false },
  { id: 'tab-chat', view: 'chat', label: 'Chat', closable: true },
];

function taskTabLabel(title: string): string {
  return title.length > 32 ? `${title.slice(0, 30)}…` : title;
}

function taskTabId(taskId: string): string {
  return `tab-task-${taskId}`;
}
import {
  getAgents,
  getWorkspaces,
  getTasks,
  getSkills,
  getWorkflows,
  getMemory,
  activateWorkspace,
  createWorkspace,
  getConfig,
  getTaskTypes,
  getSessionMessages,
} from '../api/client';

interface Store {
  // Data
  agents: AgentConfig[];
  workspaces: WorkspaceConfig[];
  activeWorkspaceId: string | null;
  tasks: TaskConfig[];
  skills: SkillConfig[];
  workflows: WorkflowConfig[];
  memory: MemoryState | null;
  taskPlans: Record<string, PlanConfig>;
  taskProgress: Record<string, string>;
  taskComments: Record<string, TaskComment[]>;
  selectedSkills: string[];

  // UI state
  selectedTaskId: string | null;
  selectedAgent: string | null;
  chatAgent: string;
  messages: ChatMessage[];
  running: boolean;
  modal: 'agent' | 'workspace' | 'task' | 'workflow' | 'plan' | null;
  expandedSections: Record<string, boolean>;
  previewSkillId: string | null;
  theme: 'dark' | 'light';
  accent: string;
  density: 'compact' | 'regular' | 'comfy';
  searchQuery: string;
  currentSessionId: string | null;
  wsConnected: boolean;
  panelMode: 'chat' | 'terminal';
  workspaceSaving: boolean;
  workspaceTabs: WorkspaceTab[];
  activeTabId: string;
  pinnedDock: WorkspaceViewId | null;
  pathSettings: PathSettings | null;
  pendingPrdPath: string | null;
  pendingGoalPath: string | null;
  autoQueue: boolean;
  taskTypes: TaskTypeDef[];
  chatSkillBootstrap: boolean;

  // Actions — data
  loadAll: () => Promise<void>;
  loadWorkspaceData: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  registerWorkspace: (data: { id: string; name: string; path: string; description?: string }) => Promise<void>;
  setAgents: (agents: AgentConfig[]) => void;
  addAgent: (agent: AgentConfig) => void;
  updateAgent: (agent: AgentConfig) => void;
  removeAgent: (id: string) => void;
  setWorkspaces: (workspaces: WorkspaceConfig[], activeId?: string | null) => void;
  addWorkspace: (workspace: WorkspaceConfig) => void;
  removeWorkspace: (id: string) => void;
  setTasks: (tasks: TaskConfig[]) => void;
  addTask: (task: TaskConfig) => void;
  updateTask: (task: TaskConfig) => void;
  removeTask: (id: string) => void;
  setSkills: (skills: SkillConfig[]) => void;
  setWorkflows: (workflows: WorkflowConfig[]) => void;
  setMemory: (memory: MemoryState | null) => void;
  setTaskPlan: (taskId: string, plan: PlanConfig) => void;
  appendTaskProgress: (taskId: string, line: string) => void;
  setTaskComments: (taskId: string, comments: TaskComment[]) => void;
  appendTaskComment: (taskId: string, comment: TaskComment) => void;
  toggleSkillSelection: (id: string) => void;
  setSelectedSkills: (ids: string[]) => void;

  // Actions — UI
  setSelectedTaskId: (id: string | null) => void;
  setSelectedAgent: (id: string | null) => void;
  setChatAgent: (id: string) => void;
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  setRunning: (running: boolean) => void;
  setModal: (modal: Store['modal']) => void;
  toggleSection: (section: string) => void;
  setPreviewSkillId: (id: string | null) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setAccent: (accent: string) => void;
  setDensity: (density: 'compact' | 'regular' | 'comfy') => void;
  setSearchQuery: (q: string) => void;
  setCurrentSessionId: (id: string | null) => void;
  setWsConnected: (connected: boolean) => void;
  setPanelMode: (mode: 'chat' | 'terminal') => void;
  openWorkspaceTab: (view: WorkspaceViewId) => void;
  openTaskTab: (taskId: string) => void;
  openPrdFile: (path: string) => void;
  clearPendingPrdPath: () => void;
  openGoalFile: (path: string) => void;
  clearPendingGoalPath: () => void;
  closeWorkspaceTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  setPathSettings: (pathSettings: PathSettings) => void;
  setTaskTypes: (taskTypes: TaskTypeDef[]) => void;
  setAutomation: (autoQueue: boolean) => void;
  setChatSkillBootstrap: (bootstrap: boolean) => void;
  bindTaskChatContext: (taskId: string) => Promise<void>;
  continueTaskInChat: (taskId: string) => Promise<void>;
  togglePinnedDock: (view: WorkspaceViewId) => void;
}

export const useStore = create<Store>((set, get) => ({
  agents: [],
  workspaces: [],
  activeWorkspaceId: null,
  tasks: [],
  skills: [],
  workflows: [],
  memory: null,
  taskPlans: {},
  taskProgress: {},
  taskComments: {},
  selectedSkills: [],

  selectedTaskId: null,
  selectedAgent: null,
  chatAgent: '',
  messages: [],
  running: false,
  modal: null,
  expandedSections: {
    memory: false,
    prd: false,
    agents: true,
    skills: false,
    workflows: false,
    tasks: true,
  },
  previewSkillId: null,
  theme: 'light',
  accent: '#7aa7d4',
  density: 'regular',
  searchQuery: '',
  currentSessionId: null,
  wsConnected: false,
  panelMode: 'chat',
  workspaceSaving: false,
  workspaceTabs: [...DEFAULT_TABS],
  activeTabId: 'tab-tasks',
  pinnedDock: null,
  pathSettings: null,
  pendingPrdPath: null,
  pendingGoalPath: null,
  autoQueue: true,
  taskTypes: [],
  chatSkillBootstrap: false,

  loadAll: async () => {
    try {
      const [wsData, config] = await Promise.all([getWorkspaces(), getConfig()]);
      set({
        workspaces: wsData.workspaces,
        activeWorkspaceId: wsData.activeWorkspace,
        pathSettings: config.pathSettings ?? null,
      });
      await get().loadWorkspaceData();
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  },

  loadWorkspaceData: async () => {
    const { activeWorkspaceId } = get();
    try {
      if (!activeWorkspaceId) {
        const [agents, skills] = await Promise.all([getAgents(), getSkills()]);
        set({ agents, skills, tasks: [], workflows: [], memory: null, taskTypes: [] });
        return;
      }
      const [agents, tasks, skills, workflows, memory, taskTypesRes] = await Promise.all([
        getAgents(),
        getTasks(),
        getSkills(),
        getWorkflows().catch(() => [] as WorkflowConfig[]),
        getMemory().catch(() => null),
        getTaskTypes().catch(() => ({ types: [] as TaskTypeDef[] })),
      ]);
      set({ agents, tasks, skills, workflows, memory, taskTypes: taskTypesRes.types });
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    }
  },

  switchWorkspace: async (id: string) => {
    set({ workspaceSaving: true });
    try {
      await activateWorkspace(id);
      set({ activeWorkspaceId: id, tasks: [], taskPlans: {}, taskProgress: {} });
      await get().loadWorkspaceData();
    } finally {
      set({ workspaceSaving: false });
    }
  },

  registerWorkspace: async (data) => {
    set({ workspaceSaving: true });
    try {
      const result = await createWorkspace(data);
      set({
        workspaces: result.workspaces,
        activeWorkspaceId: result.activeWorkspace,
      });
      await get().loadWorkspaceData();
    } finally {
      set({ workspaceSaving: false });
    }
  },

  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set(s => ({ agents: [...s.agents, agent] })),
  updateAgent: (agent) => set(s => ({
    agents: s.agents.map(a => a.id === agent.id ? agent : a),
  })),
  removeAgent: (id) => set(s => ({ agents: s.agents.filter(a => a.id !== id) })),

  setWorkspaces: (workspaces, activeId) => set({
    workspaces,
    ...(activeId !== undefined ? { activeWorkspaceId: activeId } : {}),
  }),
  addWorkspace: (workspace) => set(s => ({ workspaces: [...s.workspaces, workspace] })),
  removeWorkspace: (id) => set(s => ({
    workspaces: s.workspaces.filter(w => w.id !== id),
  })),

  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set(s => ({ tasks: [task, ...s.tasks] })),
  updateTask: (task) => set(s => ({
    tasks: s.tasks.map(t => t.id === task.id ? task : t),
    workspaceTabs: s.workspaceTabs.map(tab =>
      tab.taskId === task.id ? { ...tab, label: taskTabLabel(task.title) } : tab
    ),
  })),
  removeTask: (id) => set(s => {
    const { [id]: _p, ...taskProgress } = s.taskProgress;
    const { [id]: _c, ...taskComments } = s.taskComments;
    const { [id]: _plan, ...taskPlans } = s.taskPlans;
    const tabId = taskTabId(id);
    const workspaceTabs = s.workspaceTabs.filter(t => t.taskId !== id);
    const wasSelected = s.selectedTaskId === id;
    const closedActive = s.activeTabId === tabId;
    return {
      tasks: s.tasks.filter(t => t.id !== id),
      taskProgress,
      taskComments,
      taskPlans,
      workspaceTabs,
      selectedTaskId: wasSelected ? null : s.selectedTaskId,
      activeTabId: closedActive
        ? (workspaceTabs.find(t => t.id === 'tab-tasks')?.id ?? workspaceTabs[0]?.id ?? 'tab-tasks')
        : s.activeTabId,
    };
  }),
  setSkills: (skills) => set({ skills }),
  setWorkflows: (workflows) => set({ workflows }),
  setMemory: (memory) => set({ memory }),
  setTaskPlan: (taskId, plan) => set(s => ({
    taskPlans: { ...s.taskPlans, [taskId]: plan },
  })),
  appendTaskProgress: (taskId, line) => set(s => ({
    taskProgress: {
      ...s.taskProgress,
      [taskId]: (s.taskProgress[taskId] ?? '') + line + '\n',
    },
  })),
  setTaskComments: (taskId, comments) => set(s => ({
    taskComments: { ...s.taskComments, [taskId]: comments },
  })),
  appendTaskComment: (taskId, comment) => set(s => ({
    taskComments: {
      ...s.taskComments,
      [taskId]: [...(s.taskComments[taskId] ?? []), comment],
    },
  })),
  toggleSkillSelection: (id) => set(s => ({
    selectedSkills: s.selectedSkills.includes(id)
      ? s.selectedSkills.filter(x => x !== id)
      : [...s.selectedSkills, id],
  })),
  setSelectedSkills: (ids) => set({ selectedSkills: ids }),

  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setSelectedAgent: (id) => set({ selectedAgent: id }),
  setChatAgent: (id) => set({ chatAgent: id }),
  addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
  setRunning: (running) => set({ running }),
  setModal: (modal) => set({ modal }),
  toggleSection: (section) => set(s => ({
    expandedSections: {
      ...s.expandedSections,
      [section]: !s.expandedSections[section],
    },
  })),
  setPreviewSkillId: (id) => set({ previewSkillId: id }),
  setTheme: (theme) => set({ theme }),
  setAccent: (accent) => set({ accent }),
  setDensity: (density) => set({ density }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setPanelMode: (panelMode) => set({ panelMode }),

  openWorkspaceTab: (view) => {
    if (view === 'task') return;
    const { workspaceTabs } = get();
    const existing = workspaceTabs.find(t => t.view === view);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    const tab: WorkspaceTab = {
      id: `tab-${view}-${Date.now()}`,
      view,
      label: VIEW_LABELS[view],
      closable: view !== 'tasks',
    };
    set({ workspaceTabs: [...workspaceTabs, tab], activeTabId: tab.id });
  },

  openTaskTab: (taskId) => {
    const { workspaceTabs, tasks } = get();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const tabId = taskTabId(taskId);
    const existing = workspaceTabs.find(t => t.id === tabId);
    if (existing) {
      set({ activeTabId: existing.id, selectedTaskId: taskId });
      void get().bindTaskChatContext(taskId);
      return;
    }

    const tab: WorkspaceTab = {
      id: tabId,
      view: 'task',
      taskId,
      label: taskTabLabel(task.title),
      closable: true,
    };
    set({
      workspaceTabs: [...workspaceTabs, tab],
      activeTabId: tab.id,
      selectedTaskId: taskId,
    });
    void get().bindTaskChatContext(taskId);
  },

  openPrdFile: (path) => {
    set({ pendingPrdPath: path });
    get().openWorkspaceTab('prd');
  },

  clearPendingPrdPath: () => set({ pendingPrdPath: null }),

  openGoalFile: (path) => {
    set({ pendingGoalPath: path });
    get().openWorkspaceTab('goals');
  },

  clearPendingGoalPath: () => set({ pendingGoalPath: null }),

  closeWorkspaceTab: (tabId) => {
    const { workspaceTabs, activeTabId } = get();
    const tab = workspaceTabs.find(t => t.id === tabId);
    if (!tab || !tab.closable) return;
    const next = workspaceTabs.filter(t => t.id !== tabId);
    let nextActive = activeTabId;
    if (activeTabId === tabId) {
      nextActive = next.find(t => t.id === 'tab-tasks')?.id ?? next[next.length - 1]?.id ?? 'tab-tasks';
    }
    set({
      workspaceTabs: next,
      activeTabId: nextActive,
      ...(tab.taskId && tab.taskId === get().selectedTaskId ? { selectedTaskId: null } : {}),
    });
  },

  setActiveTabId: (activeTabId) => {
    const tab = get().workspaceTabs.find(t => t.id === activeTabId);
    if (tab?.view === 'task' && tab.taskId) {
      set({ activeTabId, selectedTaskId: tab.taskId });
      void get().bindTaskChatContext(tab.taskId);
      return;
    }
    set({ activeTabId });
  },

  setPathSettings: (pathSettings) => set({ pathSettings }),

  setTaskTypes: (taskTypes) => set({ taskTypes }),

  setAutomation: (autoQueue) => set({ autoQueue }),

  setChatSkillBootstrap: (bootstrap) => set({ chatSkillBootstrap: bootstrap }),

  bindTaskChatContext: async (taskId) => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;

    set({
      chatAgent: task.agent || '',
      currentSessionId: task.session_id ?? null,
      chatSkillBootstrap: (task.skills?.length ?? 0) > 0,
    });
    get().clearMessages();

    if (task.session_id) {
      try {
        const history = await getSessionMessages(task.session_id);
        history.forEach(m => {
          get().addMessage({ type: m.type, text: m.text, tool: m.tool, input: m.input });
        });
      } catch {
        get().addMessage({
          type: 'system',
          text: `Could not load session ${task.session_id.slice(0, 8)}… — send a message to continue.`,
        });
      }
    }
  },

  continueTaskInChat: async (taskId) => {
    get().openTaskTab(taskId);
  },

  togglePinnedDock: (view) => {
    const { pinnedDock } = get();
    set({ pinnedDock: pinnedDock === view ? null : view });
  },
}));
