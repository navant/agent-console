import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  AgentConfig,
  AppConfig,
  MemoryFile,
  MemoryFileEntry,
  MemoryState,
  PlanConfig,
  SkillConfig,
  TaskConfig,
  TaskType,
  UserStory,
  WorkflowConfig,
  WorkspaceConfig,
} from '../types';
import {
  CONFIG_PATH,
  DATA_DIR,
  GLOBAL_AGENTS_DIR,
  GLOBAL_SKILLS_DIR,
  PATHS,
  expandHome,
  workspaceAgentsDir,
  workspaceClaudeDir,
  workspaceMemoryPath,
  workspaceSkillsDir,
  workspaceTasksDir,
  workspaceWorkflowsDir,
} from '../config';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };
  const meta = (yaml.load(match[1]) as Record<string, unknown>) || {};
  return { meta, body: match[2].trim() };
}

function buildFrontmatter(meta: Record<string, unknown>, body: string): string {
  const yamlStr = yaml.dump(meta, { lineWidth: 120 }).trim();
  return `---\n${yamlStr}\n---\n${body}\n`;
}

function slugFromPath(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

function tintForId(id: string): string {
  const colors = ['#7aa7d4', '#c89f6a', '#8aa57a', '#b48ac4', '#d97757', '#8ab4a8'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── App config ──────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AppConfig = {
  activeWorkspace: null,
  registeredWorkspaces: [],
  memoryTier: 'simple',
};

export function getConfig(): AppConfig {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(CONFIG_PATH)) {
    writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as AppConfig;
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: AppConfig): void {
  ensureDir(DATA_DIR);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getActiveWorkspace(): WorkspaceConfig | null {
  const config = getConfig();
  if (!config.activeWorkspace) return config.registeredWorkspaces[0] ?? null;
  return config.registeredWorkspaces.find(w => w.id === config.activeWorkspace) ?? null;
}

export function setActiveWorkspace(id: string): WorkspaceConfig | null {
  const config = getConfig();
  const ws = config.registeredWorkspaces.find(w => w.id === id);
  if (!ws) return null;
  config.activeWorkspace = id;
  saveConfig(config);
  return ws;
}

export function registerWorkspace(ws: WorkspaceConfig): WorkspaceConfig {
  const config = getConfig();
  const existing = config.registeredWorkspaces.findIndex(w => w.id === ws.id);
  if (existing >= 0) {
    config.registeredWorkspaces[existing] = ws;
  } else {
    config.registeredWorkspaces.push(ws);
  }
  config.activeWorkspace = ws.id;
  saveConfig(config);
  ensureWorkspaceStructure(ws.path);
  return ws;
}

export function getWorkspacesSnapshot(): { workspaces: WorkspaceConfig[]; activeWorkspace: string | null } {
  const workspaces = listRegisteredWorkspaces();
  const active = getActiveWorkspace();
  return { workspaces, activeWorkspace: active?.id ?? null };
}

export function unregisterWorkspace(id: string): boolean {
  const config = getConfig();
  const before = config.registeredWorkspaces.length;
  config.registeredWorkspaces = config.registeredWorkspaces.filter(w => w.id !== id);
  if (config.activeWorkspace === id) {
    config.activeWorkspace = config.registeredWorkspaces[0]?.id ?? null;
  }
  saveConfig(config);
  return config.registeredWorkspaces.length < before;
}

export function listRegisteredWorkspaces(): WorkspaceConfig[] {
  return getConfig().registeredWorkspaces;
}

function ensureWorkspaceStructure(workspacePath: string): void {
  const resolved = expandHome(workspacePath);
  const dirs = [
    workspaceClaudeDir(resolved),
    workspaceAgentsDir(resolved),
    workspaceSkillsDir(resolved),
    workspaceWorkflowsDir(resolved),
    workspaceTasksDir(resolved),
  ];
  dirs.forEach(d => ensureDir(d));

  const memPath = workspaceMemoryPath(resolved);
  if (!fs.existsSync(memPath)) {
    writeFile(memPath, '# Workspace Memory\n\n_Context shared across all tasks in this workspace._\n');
  }

  // Seed default workflows if missing
  const singleDir = path.join(workspaceWorkflowsDir(resolved), 'single-shot');
  const ralphDir = path.join(workspaceWorkflowsDir(resolved), 'ralph-loop');
  if (!fs.existsSync(path.join(singleDir, 'WORKFLOW.md'))) {
    writeFile(
      path.join(singleDir, 'WORKFLOW.md'),
      buildFrontmatter(
        { name: 'single-shot', type: 'single' },
        '{{prompt}}\n\nWorkspace memory:\n{{memory}}'
      )
    );
  }
  if (!fs.existsSync(path.join(ralphDir, 'WORKFLOW.md'))) {
    writeFile(
      path.join(ralphDir, 'WORKFLOW.md'),
      buildFrontmatter(
        { name: 'ralph-loop', type: 'loop', max_iterations: 20, commit_on_story: true },
        `You are working on story {{story.id}}: {{story.title}}.
{{story.description}}

Acceptance criteria:
{{#each story.acceptanceCriteria}}- {{this}}
{{/each}}

Workspace memory:
{{memory}}`
      )
    );
  }
}

// ─── Agents ──────────────────────────────────────────────────────────────────

function parseAgentFile(filePath: string, source: 'global' | 'workspace'): AgentConfig | null {
  const raw = readFile(filePath);
  if (!raw.trim()) return null;
  const { meta, body } = parseFrontmatter(raw);
  const id = slugFromPath(filePath);
  const tools = Array.isArray(meta.tools)
    ? (meta.tools as string[])
    : typeof meta.tools === 'string'
      ? [meta.tools]
      : ['Bash', 'Read', 'Write', 'Edit'];

  return {
    id,
    name: (meta.name as string) || id,
    model: (meta.model as string) || 'claude-sonnet-4-5',
    tools,
    memory: meta.memory !== false,
    soul: body,
    source,
    tint: tintForId(id),
  };
}

function scanAgentsDir(dir: string, source: 'global' | 'workspace'): AgentConfig[] {
  if (!fs.existsSync(dir)) return [];
  const agents: AgentConfig[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.endsWith('.memory.md')) {
      const agent = parseAgentFile(path.join(dir, entry.name), source);
      if (agent) agents.push(agent);
    }
  }
  return agents;
}

export function listAgents(workspacePath?: string): AgentConfig[] {
  const global = scanAgentsDir(GLOBAL_AGENTS_DIR, 'global');
  const wsAgents = workspacePath ? scanAgentsDir(workspaceAgentsDir(expandHome(workspacePath)), 'workspace') : [];
  const byId = new Map<string, AgentConfig>();
  global.forEach(a => byId.set(a.id, a));
  wsAgents.forEach(a => byId.set(a.id, a)); // workspace overrides global
  return Array.from(byId.values());
}

export function getAgent(id: string, workspacePath?: string): AgentConfig | null {
  return listAgents(workspacePath).find(a => a.id === id) ?? null;
}

export function getAgentFilePath(id: string, source: 'global' | 'workspace', workspacePath?: string): string {
  if (source === 'global') return path.join(GLOBAL_AGENTS_DIR, `${id}.md`);
  if (!workspacePath) throw new Error('workspace path required for workspace agents');
  return path.join(workspaceAgentsDir(expandHome(workspacePath)), `${id}.md`);
}

export function saveAgent(agent: AgentConfig, workspacePath?: string): void {
  const filePath = getAgentFilePath(agent.id, agent.source, workspacePath);
  ensureDir(path.dirname(filePath));
  const meta: Record<string, unknown> = {
    name: agent.name,
    model: agent.model,
    tools: agent.tools,
    memory: agent.memory,
  };
  writeFile(filePath, buildFrontmatter(meta, agent.soul));

  const memPath = getAgentMemoryPath(agent.id, agent.source, workspacePath);
  if (!fs.existsSync(memPath)) {
    writeFile(memPath, `# Memory — ${agent.name}\n\n_No entries yet._\n`);
  }
}

export function deleteAgent(id: string, source: 'global' | 'workspace', workspacePath?: string): void {
  const filePath = getAgentFilePath(id, source, workspacePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const memPath = getAgentMemoryPath(id, source, workspacePath);
  if (fs.existsSync(memPath)) fs.unlinkSync(memPath);
}

export function getAgentSoulPath(agentId: string, workspacePath?: string): string {
  const agent = getAgent(agentId, workspacePath);
  if (!agent) return '';
  return getAgentFilePath(agentId, agent.source, workspacePath);
}

export function getAgentMemoryPath(
  agentId: string,
  source: 'global' | 'workspace',
  workspacePath?: string
): string {
  if (source === 'global') return path.join(GLOBAL_AGENTS_DIR, `${agentId}.memory.md`);
  if (!workspacePath) throw new Error('workspace path required');
  return path.join(workspaceAgentsDir(expandHome(workspacePath)), `${agentId}.memory.md`);
}

// ─── Skills ──────────────────────────────────────────────────────────────────

function scanSkillDir(skillDir: string, source: 'global' | 'workspace'): SkillConfig | null {
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) return null;
  const id = path.basename(skillDir);
  const content = readFile(skillMd);
  const { meta } = parseFrontmatter(content);
  return {
    id,
    name: (meta.name as string) || id,
    content,
    source,
  };
}

function listSkillsFromDir(skillsDir: string, source: 'global' | 'workspace'): SkillConfig[] {
  if (!fs.existsSync(skillsDir)) return [];
  const skills: SkillConfig[] = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const skill = scanSkillDir(path.join(skillsDir, entry.name), source);
      if (skill) skills.push(skill);
    }
  }
  return skills;
}

export function listSkills(workspacePath?: string): SkillConfig[] {
  const global = listSkillsFromDir(GLOBAL_SKILLS_DIR, 'global');
  const ws = workspacePath ? listSkillsFromDir(workspaceSkillsDir(expandHome(workspacePath)), 'workspace') : [];
  const byId = new Map<string, SkillConfig>();
  global.forEach(s => byId.set(s.id, s));
  ws.forEach(s => byId.set(s.id, s));
  return Array.from(byId.values());
}

export function getSkillContent(skillIds: string[], workspacePath?: string): string {
  const skills = listSkills(workspacePath);
  return skillIds
    .map(id => skills.find(s => s.id === id)?.content ?? '')
    .filter(Boolean)
    .join('\n\n---\n\n');
}

// ─── Workflows ───────────────────────────────────────────────────────────────

function parseWorkflowDir(workflowDir: string): WorkflowConfig | null {
  const workflowMd = path.join(workflowDir, 'WORKFLOW.md');
  if (!fs.existsSync(workflowMd)) return null;
  const raw = readFile(workflowMd);
  const { meta, body } = parseFrontmatter(raw);
  const id = path.basename(workflowDir);
  return {
    id,
    name: (meta.name as string) || id,
    type: (meta.type as 'loop' | 'single') || 'single',
    max_iterations: meta.max_iterations as number | undefined,
    commit_on_story: meta.commit_on_story as boolean | undefined,
    template: body,
  };
}

export function listWorkflows(workspacePath: string): WorkflowConfig[] {
  const dir = workspaceWorkflowsDir(expandHome(workspacePath));
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => parseWorkflowDir(path.join(dir, d.name)))
    .filter((w): w is WorkflowConfig => w !== null);
}

export function getWorkflow(id: string, workspacePath: string): WorkflowConfig | null {
  return listWorkflows(workspacePath).find(w => w.id === id) ?? null;
}

export function saveWorkflow(workflow: WorkflowConfig, workspacePath: string): void {
  const dir = path.join(workspaceWorkflowsDir(expandHome(workspacePath)), workflow.id);
  ensureDir(dir);
  const meta: Record<string, unknown> = {
    name: workflow.name,
    type: workflow.type,
  };
  if (workflow.max_iterations !== undefined) meta.max_iterations = workflow.max_iterations;
  if (workflow.commit_on_story !== undefined) meta.commit_on_story = workflow.commit_on_story;
  writeFile(path.join(dir, 'WORKFLOW.md'), buildFrontmatter(meta, workflow.template));
}

export function deleteWorkflow(id: string, workspacePath: string): void {
  const dir = path.join(workspaceWorkflowsDir(expandHome(workspacePath)), id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

function taskDir(workspacePath: string, taskId: string): string {
  return path.join(workspaceTasksDir(expandHome(workspacePath)), taskId);
}

export function listTasks(workspacePath: string): TaskConfig[] {
  const dir = workspaceTasksDir(expandHome(workspacePath));
  if (!fs.existsSync(dir)) return [];
  const tasks: TaskConfig[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const task = getTask(entry.name, workspacePath);
    if (task) tasks.push(task);
  }
  return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getTask(id: string, workspacePath: string): TaskConfig | null {
  const jsonPath = path.join(taskDir(workspacePath, id), 'task.json');
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as TaskConfig;
  } catch {
    return null;
  }
}

export function saveTask(task: TaskConfig, workspacePath: string): void {
  const dir = taskDir(workspacePath, task.id);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'task.json'), JSON.stringify(task, null, 2), 'utf-8');
}

export function deleteTask(id: string, workspacePath: string): void {
  const dir = taskDir(workspacePath, id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export function getTaskPrompt(id: string, workspacePath: string): string {
  return readFile(path.join(taskDir(workspacePath, id), 'prompt.md'));
}

export function saveTaskPrompt(id: string, workspacePath: string, prompt: string): void {
  writeFile(path.join(taskDir(workspacePath, id), 'prompt.md'), prompt);
}

export function getTaskPlan(id: string, workspacePath: string): PlanConfig {
  const planPath = path.join(taskDir(workspacePath, id), 'prd.json');
  if (!fs.existsSync(planPath)) return { userStories: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(planPath, 'utf-8')) as PlanConfig;
    return { userStories: raw.userStories ?? [] };
  } catch {
    return { userStories: [] };
  }
}

export function saveTaskPlan(id: string, workspacePath: string, plan: PlanConfig): void {
  const planPath = path.join(taskDir(workspacePath, id), 'prd.json');
  writeFile(planPath, JSON.stringify(plan, null, 2));
}

export function getTaskProgress(id: string, workspacePath: string): string {
  return readFile(path.join(taskDir(workspacePath, id), 'progress.txt'));
}

export function appendTaskProgress(
  id: string,
  workspacePath: string,
  line: string,
  onAppend?: (line: string) => void
): void {
  const progressPath = path.join(taskDir(workspacePath, id), 'progress.txt');
  ensureDir(path.dirname(progressPath));
  fs.appendFileSync(progressPath, line + '\n', 'utf-8');
  onAppend?.(line);
}

export function createTask(
  data: {
    title: string;
    agent: string;
    workflow: string;
    skills?: string[];
    description?: string;
    type?: TaskType;
  },
  workspacePath: string
): TaskConfig {
  const workflow = getWorkflow(data.workflow, workspacePath);
  const type: TaskType = data.type ?? (workflow?.type === 'loop' ? 'project' : 'simple');
  const now = new Date().toISOString();
  const taskNum = Date.now().toString(36).toUpperCase().slice(-4);
  const id = `T-${taskNum}`;

  const task: TaskConfig = {
    id,
    title: data.title,
    agent: data.agent,
    workflow: data.workflow,
    status: type === 'project' ? 'todo' : 'todo',
    type,
    skills: data.skills ?? [],
    createdAt: now,
    updatedAt: now,
  };

  const dir = taskDir(workspacePath, id);
  ensureDir(dir);
  saveTask(task, workspacePath);

  if (type === 'simple' && data.description) {
    saveTaskPrompt(id, workspacePath, data.description);
  } else if (data.description) {
    saveTaskPrompt(id, workspacePath, data.description);
  }

  writeFile(path.join(dir, 'progress.txt'), `# Progress — ${data.title}\n\n`);
  return task;
}

// ─── Memory ──────────────────────────────────────────────────────────────────

export function getWorkspaceMemory(workspacePath: string): string {
  return readFile(workspaceMemoryPath(expandHome(workspacePath)));
}

export function saveWorkspaceMemory(workspacePath: string, content: string): void {
  writeFile(workspaceMemoryPath(expandHome(workspacePath)), content);
}

export function getAgentMemory(agentId: string, workspacePath?: string): string {
  const agent = getAgent(agentId, workspacePath);
  if (!agent) return '';
  return readFile(getAgentMemoryPath(agentId, agent.source, workspacePath));
}

export function saveAgentMemory(
  agentId: string,
  content: string,
  workspacePath?: string
): void {
  const agent = getAgent(agentId, workspacePath);
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  writeFile(getAgentMemoryPath(agentId, agent.source, workspacePath), content);
}

function scanMemoryDir(
  dir: string,
  relPrefix: string,
  scope: 'workspace' | 'wiki',
  out: MemoryFileEntry[]
): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = relPrefix ? `${relPrefix}/${name}` : name;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push({ id: `${scope}:${rel}`, name, path: rel, scope, isDir: true });
      scanMemoryDir(full, rel, scope, out);
    } else if (name.endsWith('.md')) {
      out.push({ id: `${scope}:${rel}`, name, path: rel, scope });
    }
  }
}

export function listMemoryFiles(workspacePath: string): MemoryFileEntry[] {
  const claude = workspaceClaudeDir(expandHome(workspacePath));
  const files: MemoryFileEntry[] = [];

  const memMd = path.join(claude, 'memory.md');
  if (fs.existsSync(memMd)) {
    files.push({ id: 'workspace:memory.md', name: 'memory.md', path: 'memory.md', scope: 'workspace' });
  }

  scanMemoryDir(path.join(claude, 'memory'), 'memory', 'workspace', files);
  scanMemoryDir(path.join(claude, 'wiki'), 'wiki', 'wiki', files);

  for (const agent of listAgents(workspacePath)) {
    if (!agent.memory) continue;
    const memPath = getAgentMemoryPath(agent.id, agent.source, workspacePath);
    if (fs.existsSync(memPath)) {
      files.push({
        id: `agent:${agent.id}`,
        name: `${agent.id}.memory.md`,
        path: `agents/${agent.id}.memory.md`,
        scope: 'agent',
        agentId: agent.id,
      });
    }
  }

  return files;
}

export function resolveMemoryFilePath(
  workspacePath: string,
  filePath: string,
  agentId?: string
): string {
  const claude = workspaceClaudeDir(expandHome(workspacePath));
  if (filePath.startsWith('agents/') && agentId) {
    const agent = getAgent(agentId, workspacePath);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    return getAgentMemoryPath(agentId, agent.source, workspacePath);
  }
  if (filePath === 'memory.md') return workspaceMemoryPath(workspacePath);
  const resolved = path.join(claude, filePath);
  const claudeResolved = path.resolve(claude);
  if (!path.resolve(resolved).startsWith(claudeResolved)) {
    throw new Error('Invalid memory path');
  }
  return resolved;
}

export function readMemoryFile(
  workspacePath: string,
  filePath: string,
  agentId?: string
): string {
  return readFile(resolveMemoryFilePath(workspacePath, filePath, agentId));
}

export function writeMemoryFile(
  workspacePath: string,
  filePath: string,
  content: string,
  agentId?: string
): void {
  const abs = resolveMemoryFilePath(workspacePath, filePath, agentId);
  ensureDir(path.dirname(abs));
  writeFile(abs, content);
}

export function getMemoryState(workspacePath: string): MemoryState {
  const config = getConfig();
  const tier = config.memoryTier ?? 'simple';
  const wsMemPath = workspaceMemoryPath(expandHome(workspacePath));
  const workspace: MemoryFile = {
    id: 'workspace',
    name: 'Workspace memory',
    path: wsMemPath,
    content: getWorkspaceMemory(workspacePath),
    updatedAt: fs.existsSync(wsMemPath)
      ? fs.statSync(wsMemPath).mtime.toISOString()
      : undefined,
  };

  const agents: MemoryFile[] = listAgents(workspacePath)
    .filter(a => a.memory)
    .map(a => {
      const memPath = getAgentMemoryPath(a.id, a.source, workspacePath);
      return {
        id: a.id,
        name: a.name,
        path: memPath,
        content: readFile(memPath),
        updatedAt: fs.existsSync(memPath) ? fs.statSync(memPath).mtime.toISOString() : undefined,
      };
    });

  return {
    tier,
    workspace,
    agents,
    files: listMemoryFiles(workspacePath),
    claudeMemAvailable: false,
  };
}

export function buildMemoryContext(workspacePath: string, agentId: string): string {
  const parts: string[] = [];
  const wsMem = getWorkspaceMemory(workspacePath).trim();
  if (wsMem) parts.push(`## Workspace Memory\n\n${wsMem}`);

  const agentMem = getAgentMemory(agentId, workspacePath).trim();
  if (agentMem) parts.push(`## Agent Memory (${agentId})\n\n${agentMem}`);

  return parts.join('\n\n');
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function getSessionLogPath(sessionId: string): string {
  ensureDir(PATHS.sessions);
  return path.join(PATHS.sessions, `${sessionId}.log`);
}

export function appendSessionLog(sessionId: string, line: string): void {
  const logPath = getSessionLogPath(sessionId);
  fs.appendFileSync(logPath, line + '\n', 'utf-8');
}

// Legacy aliases for compatibility during migration
export function getWorkspace(id: string): WorkspaceConfig | null {
  return getConfig().registeredWorkspaces.find(w => w.id === id) ?? null;
}
