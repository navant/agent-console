import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { AgentConfig, WorkspaceConfig, TaskConfig } from '../types';
import { PATHS } from '../config';

// ─── Ensure directories exist ────────────────────────────────────────────────

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── Generic YAML helpers ─────────────────────────────────────────────────────

function readYaml<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(raw) as T;
}

function writeYaml(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, yaml.dump(data, { lineWidth: 120 }), 'utf-8');
}

function readMarkdown(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function writeMarkdown(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export function listAgents(): AgentConfig[] {
  ensureDir(PATHS.agents);
  const dirs = fs.readdirSync(PATHS.agents, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const agents: AgentConfig[] = [];
  for (const name of dirs) {
    const configPath = path.join(PATHS.agents, name, 'config.yaml');
    const cfg = readYaml<AgentConfig>(configPath);
    if (cfg) {
      // Also load soul.md content
      const soulPath = path.join(PATHS.agents, name, 'soul.md');
      cfg.soul = readMarkdown(soulPath);
      agents.push(cfg);
    }
  }
  return agents;
}

export function getAgent(id: string): AgentConfig | null {
  const configPath = path.join(PATHS.agents, id, 'config.yaml');
  const cfg = readYaml<AgentConfig>(configPath);
  if (!cfg) return null;
  const soulPath = path.join(PATHS.agents, id, 'soul.md');
  cfg.soul = readMarkdown(soulPath);
  return cfg;
}

export function saveAgent(agent: AgentConfig): void {
  const dir = path.join(PATHS.agents, agent.id);
  ensureDir(dir);

  const { soul, ...configData } = agent;
  writeYaml(path.join(dir, 'config.yaml'), configData);

  if (soul !== undefined) {
    writeMarkdown(path.join(dir, 'soul.md'), soul);
  }

  // Ensure memory.md exists
  const memPath = path.join(dir, 'memory.md');
  if (!fs.existsSync(memPath)) {
    writeMarkdown(memPath, '# Memory\n\n_No entries yet._\n');
  }
}

export function deleteAgent(id: string): void {
  const dir = path.join(PATHS.agents, id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function getAgentSoulPath(agentId: string): string {
  return path.join(PATHS.agents, agentId, 'soul.md');
}

export function getAgentMemoryPath(agentId: string): string {
  return path.join(PATHS.agents, agentId, 'memory.md');
}

// ─── Workspaces ───────────────────────────────────────────────────────────────

export function listWorkspaces(): WorkspaceConfig[] {
  ensureDir(PATHS.workspaces);
  const dirs = fs.readdirSync(PATHS.workspaces, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const workspaces: WorkspaceConfig[] = [];
  for (const name of dirs) {
    const configPath = path.join(PATHS.workspaces, name, 'config.yaml');
    const cfg = readYaml<WorkspaceConfig>(configPath);
    if (cfg) workspaces.push(cfg);
  }
  return workspaces;
}

export function getWorkspace(id: string): WorkspaceConfig | null {
  const configPath = path.join(PATHS.workspaces, id, 'config.yaml');
  return readYaml<WorkspaceConfig>(configPath);
}

export function saveWorkspace(workspace: WorkspaceConfig): void {
  const dir = path.join(PATHS.workspaces, workspace.id);
  ensureDir(dir);
  writeYaml(path.join(dir, 'config.yaml'), workspace);
}

export function deleteWorkspace(id: string): void {
  const dir = path.join(PATHS.workspaces, id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export function listTasks(): TaskConfig[] {
  ensureDir(PATHS.tasks);
  const files = fs.readdirSync(PATHS.tasks)
    .filter(f => f.endsWith('.yaml'));

  const tasks: TaskConfig[] = [];
  for (const file of files) {
    const filePath = path.join(PATHS.tasks, file);
    const cfg = readYaml<TaskConfig>(filePath);
    if (cfg) {
      // Load description from .md file
      const mdPath = path.join(PATHS.tasks, file.replace('.yaml', '.md'));
      cfg.description = readMarkdown(mdPath);
      tasks.push(cfg);
    }
  }
  return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getTask(id: string): TaskConfig | null {
  const filePath = path.join(PATHS.tasks, `${id}.yaml`);
  const cfg = readYaml<TaskConfig>(filePath);
  if (!cfg) return null;
  const mdPath = path.join(PATHS.tasks, `${id}.md`);
  cfg.description = readMarkdown(mdPath);
  return cfg;
}

export function saveTask(task: TaskConfig): void {
  ensureDir(PATHS.tasks);
  const { description, ...configData } = task;
  writeYaml(path.join(PATHS.tasks, `${task.id}.yaml`), configData);
  if (description !== undefined) {
    writeMarkdown(path.join(PATHS.tasks, `${task.id}.md`), description);
  }
}

export function deleteTask(id: string): void {
  const yamlPath = path.join(PATHS.tasks, `${id}.yaml`);
  const mdPath = path.join(PATHS.tasks, `${id}.md`);
  if (fs.existsSync(yamlPath)) fs.unlinkSync(yamlPath);
  if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
}

export function getTaskDescriptionPath(taskId: string): string {
  return path.join(PATHS.tasks, `${taskId}.md`);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function getSessionLogPath(sessionId: string): string {
  ensureDir(PATHS.sessions);
  return path.join(PATHS.sessions, `${sessionId}.log`);
}

export function appendSessionLog(sessionId: string, line: string): void {
  const logPath = getSessionLogPath(sessionId);
  fs.appendFileSync(logPath, line + '\n', 'utf-8');
}
