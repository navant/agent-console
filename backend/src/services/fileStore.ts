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
  PathSettings,
  SkillConfig,
  TaskConfig,
  TaskType,
  UserStory,
  WorkflowConfig,
  WorkspaceConfig,
} from '../types';
import {
  readTaskStatusFromMarkdown,
  writeTaskMarkdown,
  ensureTaskMarkdown,
} from './taskMarkdown';
import { resolveTaskTypeFields } from './taskTypesStore';
import {
  CONFIG_PATH,
  DATA_DIR,
  PATHS,
  expandHome,
  mergePathSettings,
  resolveGlobalPath,
  resolveWorkspacePath,
  workspaceClaudeDir,
  workspaceAgentsDir,
  workspaceSkillsDir,
  workspaceWorkflowsDir,
  workspaceTasksDir,
  workspaceMemoryPath,
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

export function getPathSettings(): PathSettings {
  return mergePathSettings(getConfig().pathSettings);
}

export function savePathSettings(partial: Partial<PathSettings>): PathSettings {
  const config = getConfig();
  const merged = mergePathSettings(config.pathSettings);
  config.pathSettings = { ...merged, ...partial };
  saveConfig(config);
  return mergePathSettings(config.pathSettings);
}

function wsDir(
  workspacePath: string,
  key: Exclude<keyof PathSettings, 'globalAgents' | 'globalSkills' | 'globalWorkflows'>
): string {
  return resolveWorkspacePath(workspacePath, getPathSettings(), key);
}

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
    wsDir(resolved, 'agents'),
    wsDir(resolved, 'skills'),
    wsDir(resolved, 'workflows'),
    wsDir(resolved, 'tasks'),
    wsDir(resolved, 'prd'),
    wsDir(resolved, 'goals'),
    wsDir(resolved, 'memory'),
  ];
  dirs.forEach(d => ensureDir(d));

  const memPath = workspaceMemoryPath(resolved);
  if (!fs.existsSync(memPath)) {
    writeFile(memPath, '# Workspace Memory\n\n_Context shared across all tasks in this workspace._\n');
  }

  // Seed default workflows if missing
  const singleDir = path.join(wsDir(resolved, 'workflows'), 'single-shot');
  const ralphDir = path.join(wsDir(resolved, 'workflows'), 'ralph-loop');
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
  const settings = getPathSettings();
  const global = scanAgentsDir(resolveGlobalPath(settings, 'globalAgents'), 'global');
  const wsAgents = workspacePath ? scanAgentsDir(wsDir(workspacePath, 'agents'), 'workspace') : [];
  return [...global, ...wsAgents];
}

export function getAgent(id: string, workspacePath?: string): AgentConfig | null {
  if (workspacePath) {
    const ws = scanAgentsDir(wsDir(workspacePath, 'agents'), 'workspace').find(a => a.id === id);
    if (ws) return ws;
  }
  const settings = getPathSettings();
  return scanAgentsDir(resolveGlobalPath(settings, 'globalAgents'), 'global').find(a => a.id === id) ?? null;
}

export function getAgentFileContent(
  id: string,
  source: 'global' | 'workspace',
  workspacePath?: string
): string {
  const filePath = getAgentFilePath(id, source, workspacePath);
  if (!fs.existsSync(filePath)) throw new Error('Agent not found');
  return readFile(filePath);
}

export function saveAgentFileContent(id: string, workspacePath: string, content: string): void {
  writeFile(getAgentFilePath(id, 'workspace', workspacePath), content);
}

export function createAgentFile(workspacePath: string, id: string, content?: string): void {
  const body =
    content ??
    `---\nname: ${id}\nmodel: claude-sonnet-4-6\ntools:\n  - Bash\n  - Read\n  - Write\n  - Edit\nmemory: true\n---\n\n`;
  writeFile(getAgentFilePath(id, 'workspace', workspacePath), body);
  const memPath = getAgentMemoryPath(id, 'workspace', workspacePath);
  if (!fs.existsSync(memPath)) {
    writeFile(memPath, `# Memory — ${id}\n\n_No entries yet._\n`);
  }
}

export function getAgentFilePath(id: string, source: 'global' | 'workspace', workspacePath?: string): string {
  if (source === 'global') return path.join(resolveGlobalPath(getPathSettings(), 'globalAgents'), `${id}.md`);
  if (!workspacePath) throw new Error('workspace path required for workspace agents');
  return path.join(wsDir(workspacePath, 'agents'), `${id}.md`);
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
  if (source === 'global') return path.join(resolveGlobalPath(getPathSettings(), 'globalAgents'), `${agentId}.memory.md`);
  if (!workspacePath) throw new Error('workspace path required');
  return path.join(wsDir(workspacePath, 'agents'), `${agentId}.memory.md`);
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
  const global = listSkillsFromDir(resolveGlobalPath(getPathSettings(), 'globalSkills'), 'global');
  const ws = workspacePath ? listSkillsFromDir(wsDir(workspacePath, 'skills'), 'workspace') : [];
  return [...global, ...ws];
}

function findSkillById(skills: SkillConfig[], id: string): SkillConfig | undefined {
  return skills.find(s => s.id === id && s.source === 'workspace') ?? skills.find(s => s.id === id);
}

export function getSkillContent(skillIds: string[], workspacePath?: string): string {
  const skills = listSkills(workspacePath);
  return skillIds
    .map(id => findSkillById(skills, id)?.content ?? '')
    .filter(Boolean)
    .join('\n\n---\n\n');
}

/** Instruct Claude to invoke skills via the Skill tool (not inline paste). */
export function buildSkillInvocationPrompt(skillIds: string[], workspacePath?: string): string {
  if (skillIds.length === 0) return '';
  const skills = listSkills(workspacePath);
  const lines = skillIds
    .map(id => findSkillById(skills, id))
    .filter((s): s is SkillConfig => !!s)
    .map(s => `- \`${s.id}\` (${s.name})`);
  if (lines.length === 0) return '';

  return `## Required skills (invoke via Skill tool)

**First step:** use the **Skill** tool to invoke each skill below. Do not skip this — do not substitute by reading SKILL.md yourself or relying on pasted skill text.

${lines.join('\n')}

After all skills are loaded, follow their instructions for the rest of this run.`;
}

/** Skill tool must be allowed when tasks reference skills. */
export function ensureSkillToolAllowed(tools: string[]): string[] {
  if (tools.length === 0) return tools;
  const hasSkill = tools.some(t => t.toLowerCase() === 'skill');
  return hasSkill ? tools : [...tools, 'Skill'];
}

// ─── Workflows ───────────────────────────────────────────────────────────────

function parseWorkflowDir(workflowDir: string, source: 'global' | 'workspace'): WorkflowConfig | null {
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
    source,
  };
}

function listWorkflowsFromDir(workflowsDir: string, source: 'global' | 'workspace'): WorkflowConfig[] {
  if (!fs.existsSync(workflowsDir)) return [];
  return fs
    .readdirSync(workflowsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => parseWorkflowDir(path.join(workflowsDir, d.name), source))
    .filter((w): w is WorkflowConfig => w !== null);
}

export function listWorkflows(workspacePath?: string): WorkflowConfig[] {
  const settings = getPathSettings();
  const global = listWorkflowsFromDir(resolveGlobalPath(settings, 'globalWorkflows'), 'global');
  const ws = workspacePath ? listWorkflowsFromDir(wsDir(workspacePath, 'workflows'), 'workspace') : [];
  return [...global, ...ws];
}

export function getWorkflow(id: string, workspacePath?: string): WorkflowConfig | null {
  if (workspacePath) {
    const ws = listWorkflowsFromDir(wsDir(workspacePath, 'workflows'), 'workspace').find(w => w.id === id);
    if (ws) return ws;
  }
  return listWorkflowsFromDir(resolveGlobalPath(getPathSettings(), 'globalWorkflows'), 'global').find(
    w => w.id === id
  ) ?? null;
}

export function saveWorkflow(workflow: WorkflowConfig, workspacePath: string): void {
  const dir = path.join(wsDir(workspacePath, 'workflows'), workflow.id);
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
  const dir = path.join(wsDir(workspacePath, 'workflows'), id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export function getSkillFilePath(
  id: string,
  source: 'global' | 'workspace',
  workspacePath?: string
): string {
  if (source === 'global') {
    return path.join(resolveGlobalPath(getPathSettings(), 'globalSkills'), id, 'SKILL.md');
  }
  if (!workspacePath) throw new Error('workspace path required');
  return path.join(wsDir(workspacePath, 'skills'), id, 'SKILL.md');
}

export function getSkillFileContent(
  id: string,
  source: 'global' | 'workspace',
  workspacePath?: string
): string {
  const filePath = getSkillFilePath(id, source, workspacePath);
  if (!fs.existsSync(filePath)) throw new Error('Skill not found');
  return readFile(filePath);
}

export function saveSkillFileContent(id: string, workspacePath: string, content: string): void {
  const filePath = getSkillFilePath(id, 'workspace', workspacePath);
  writeFile(filePath, content);
}

export function getWorkflowFilePath(
  id: string,
  source: 'global' | 'workspace',
  workspacePath?: string
): string {
  if (source === 'global') {
    return path.join(resolveGlobalPath(getPathSettings(), 'globalWorkflows'), id, 'WORKFLOW.md');
  }
  if (!workspacePath) throw new Error('workspace path required');
  return path.join(wsDir(workspacePath, 'workflows'), id, 'WORKFLOW.md');
}

export function getWorkflowFileContent(
  id: string,
  source: 'global' | 'workspace',
  workspacePath?: string
): string {
  const filePath = getWorkflowFilePath(id, source, workspacePath);
  if (!fs.existsSync(filePath)) throw new Error('Workflow not found');
  return readFile(filePath);
}

export function saveWorkflowFileContent(id: string, workspacePath: string, content: string): void {
  writeFile(getWorkflowFilePath(id, 'workspace', workspacePath), content);
}

export function createSkillFolder(workspacePath: string, id: string, content?: string): void {
  const dir = path.join(wsDir(workspacePath, 'skills'), id);
  ensureDir(dir);
  const body = content ?? `---\nname: ${id}\ndescription: \n---\n\n# ${id}\n`;
  writeFile(path.join(dir, 'SKILL.md'), body);
}

export function createWorkflowFolder(workspacePath: string, id: string, content?: string): void {
  const dir = path.join(wsDir(workspacePath, 'workflows'), id);
  ensureDir(dir);
  const body =
    content ??
    `---\nname: ${id}\ntype: single\n---\n\n{{prompt}}\n\nWorkspace memory:\n{{memory}}\n`;
  writeFile(path.join(dir, 'WORKFLOW.md'), body);
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export function taskDir(workspacePath: string, taskId: string): string {
  return path.join(wsDir(workspacePath, 'tasks'), taskId);
}

export function listTasks(workspacePath: string): TaskConfig[] {
  const dir = wsDir(workspacePath, 'tasks');
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
    const task = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as TaskConfig;
    const mdStatus = readTaskStatusFromMarkdown(workspacePath, id);
    if (mdStatus) {
      if (mdStatus !== task.status) {
        task.status = mdStatus;
        saveTask(task, workspacePath);
      }
    } else {
      ensureTaskMarkdown(task, workspacePath);
    }
    return task;
  } catch {
    return null;
  }
}

export function saveTask(task: TaskConfig, workspacePath: string): void {
  const dir = taskDir(workspacePath, task.id);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'task.json'), JSON.stringify(task, null, 2), 'utf-8');
  writeTaskMarkdown(task, workspacePath);
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
    agent?: string;
    workflow?: string;
    skills?: string[];
    description?: string;
    type?: TaskType;
    prd?: string;
    goal?: string;
    taskType?: string;
  },
  workspacePath: string
): TaskConfig {
  const resolved = resolveTaskTypeFields(workspacePath, {
    taskType: data.taskType,
    agent: data.agent,
    workflow: data.workflow,
    skills: data.skills,
  });
  const workflow = getWorkflow(resolved.workflow, workspacePath);
  const type: TaskType = data.type ?? (workflow?.type === 'loop' ? 'project' : 'simple');
  const now = new Date().toISOString();
  const taskNum = Date.now().toString(36).toUpperCase().slice(-4);
  const id = `T-${taskNum}`;

  const task: TaskConfig = {
    id,
    title: data.title,
    agent: resolved.agent,
    workflow: resolved.workflow,
    status: 'todo',
    type,
    skills: resolved.skills,
    ...(resolved.taskType ? { taskType: resolved.taskType } : {}),
    ...(data.prd ? { prd: data.prd } : {}),
    ...(data.goal ? { goal: data.goal } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const dir = taskDir(workspacePath, id);
  ensureDir(dir);
  saveTask(task, workspacePath);

  if (data.description && !data.prd && !data.goal) {
    saveTaskPrompt(id, workspacePath, data.description);
  }

  writeFile(path.join(dir, 'progress.txt'), `# Progress — ${data.title}\n\n`);
  writeTaskMarkdown(task, workspacePath);
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
