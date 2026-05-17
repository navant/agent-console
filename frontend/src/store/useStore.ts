import { create } from 'zustand';
import { AgentConfig, WorkspaceConfig, TaskConfig, SkillConfig, ChatMessage } from '../types';
import { getAgents, getWorkspaces, getTasks, getSkills } from '../api/client';

interface Store {
  // Data
  agents: AgentConfig[];
  workspaces: WorkspaceConfig[];
  tasks: TaskConfig[];
  skills: SkillConfig[];

  // UI state
  selectedTask: string | null;
  selectedAgent: string | null;
  chatAgent: string;
  messages: ChatMessage[];
  running: boolean;
  modal: 'agent' | 'workspace' | 'task' | null;
  theme: 'dark' | 'light';
  accent: string;
  density: 'compact' | 'regular' | 'comfy';
  searchQuery: string;
  currentSessionId: string | null;
  wsConnected: boolean;
  panelMode: 'chat' | 'terminal';

  // Actions — data
  loadAll: () => Promise<void>;
  setAgents: (agents: AgentConfig[]) => void;
  addAgent: (agent: AgentConfig) => void;
  updateAgent: (agent: AgentConfig) => void;
  removeAgent: (id: string) => void;
  setWorkspaces: (workspaces: WorkspaceConfig[]) => void;
  addWorkspace: (workspace: WorkspaceConfig) => void;
  removeWorkspace: (id: string) => void;
  setTasks: (tasks: TaskConfig[]) => void;
  addTask: (task: TaskConfig) => void;
  updateTask: (task: TaskConfig) => void;
  removeTask: (id: string) => void;
  setSkills: (skills: SkillConfig[]) => void;

  // Actions — UI
  setSelectedTask: (id: string | null) => void;
  setSelectedAgent: (id: string | null) => void;
  setChatAgent: (id: string) => void;
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  setRunning: (running: boolean) => void;
  setModal: (modal: 'agent' | 'workspace' | 'task' | null) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setAccent: (accent: string) => void;
  setDensity: (density: 'compact' | 'regular' | 'comfy') => void;
  setSearchQuery: (q: string) => void;
  setCurrentSessionId: (id: string | null) => void;
  setWsConnected: (connected: boolean) => void;
  setPanelMode: (mode: 'chat' | 'terminal') => void;
}

export const useStore = create<Store>((set, get) => ({
  // Initial data
  agents: [],
  workspaces: [],
  tasks: [],
  skills: [],

  // Initial UI state
  selectedTask: null,
  selectedAgent: null,
  chatAgent: '',
  messages: [],
  running: false,
  modal: null,
  theme: 'dark',
  accent: '#7aa7d4',
  density: 'regular',
  searchQuery: '',
  currentSessionId: null,
  wsConnected: false,
  panelMode: 'chat',

  // Data actions
  loadAll: async () => {
    try {
      const [agents, workspaces, tasks, skills] = await Promise.all([
        getAgents(),
        getWorkspaces(),
        getTasks(),
        getSkills(),
      ]);
      set({ agents, workspaces, tasks, skills });
      // Set default chatAgent to first agent if not set
      const { chatAgent } = get();
      if (!chatAgent && agents.length > 0) {
        set({ chatAgent: agents[0].id });
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  },

  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set(s => ({ agents: [...s.agents, agent] })),
  updateAgent: (agent) => set(s => ({
    agents: s.agents.map(a => a.id === agent.id ? agent : a),
  })),
  removeAgent: (id) => set(s => ({ agents: s.agents.filter(a => a.id !== id) })),

  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) => set(s => ({ workspaces: [...s.workspaces, workspace] })),
  removeWorkspace: (id) => set(s => ({ workspaces: s.workspaces.filter(w => w.id !== id) })),

  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set(s => ({ tasks: [task, ...s.tasks] })),
  updateTask: (task) => set(s => ({
    tasks: s.tasks.map(t => t.id === task.id ? task : t),
  })),
  removeTask: (id) => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),
  setSkills: (skills) => set({ skills }),

  // UI actions
  setSelectedTask: (id) => set({ selectedTask: id }),
  setSelectedAgent: (id) => set({ selectedAgent: id }),
  setChatAgent: (id) => set({ chatAgent: id }),
  addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
  setRunning: (running) => set({ running }),
  setModal: (modal) => set({ modal }),
  setTheme: (theme) => set({ theme }),
  setAccent: (accent) => set({ accent }),
  setDensity: (density) => set({ density }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setPanelMode: (panelMode) => set({ panelMode }),
}));
