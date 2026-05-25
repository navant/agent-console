import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { TaskConfig, TaskStatus } from '../types';
import { workspaceTasksDir } from '../config';

const VALID_STATUSES: TaskStatus[] = [
  'todo',
  'planned',
  'running',
  'review',
  'awaiting_confirmation',
  'done',
  'archive',
];

export const TASK_MD_FILENAME = 'task.md';

function taskMarkdownPath(workspacePath: string, taskId: string): string {
  return path.join(workspaceTasksDir(workspacePath), taskId, TASK_MD_FILENAME);
}

function parseTaskMarkdown(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content.trim() };
  try {
    const frontmatter = (yaml.load(match[1]) as Record<string, unknown>) ?? {};
    return { frontmatter, body: match[2].trim() };
  } catch {
    return { frontmatter: {}, body: content.trim() };
  }
}

function defaultBody(task: TaskConfig): string {
  return `# ${task.title}\n\nStatus is tracked in the frontmatter above. Agent prompt lives in \`prompt.md\`.`;
}

function serializeTaskMarkdown(task: TaskConfig, body: string): string {
  const frontmatter: Record<string, unknown> = {
    id: task.id,
    title: task.title,
    status: task.status,
    agent: task.agent,
    workflow: task.workflow,
    type: task.type,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
  if (task.skills.length > 0) frontmatter.skills = task.skills;
  if (task.prd) frontmatter.prd = task.prd;
  if (task.goal) frontmatter.goal = task.goal;
  if (task.taskType) frontmatter.taskType = task.taskType;

  const yamlBlock = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true }).trim();
  const trimmedBody = body.trim() || defaultBody(task);
  return `---\n${yamlBlock}\n---\n\n${trimmedBody}\n`;
}

export function readTaskStatusFromMarkdown(workspacePath: string, taskId: string): TaskStatus | null {
  const mdPath = taskMarkdownPath(workspacePath, taskId);
  if (!fs.existsSync(mdPath)) return null;
  const { frontmatter } = parseTaskMarkdown(fs.readFileSync(mdPath, 'utf-8'));
  const status = frontmatter.status;
  if (typeof status === 'string' && VALID_STATUSES.includes(status as TaskStatus)) {
    return status as TaskStatus;
  }
  return null;
}

export function readTaskMarkdown(workspacePath: string, taskId: string): string {
  const mdPath = taskMarkdownPath(workspacePath, taskId);
  if (!fs.existsSync(mdPath)) return '';
  return fs.readFileSync(mdPath, 'utf-8');
}

export function writeTaskMarkdown(task: TaskConfig, workspacePath: string): void {
  const mdPath = taskMarkdownPath(workspacePath, task.id);
  let body = defaultBody(task);
  if (fs.existsSync(mdPath)) {
    const parsed = parseTaskMarkdown(fs.readFileSync(mdPath, 'utf-8'));
    if (parsed.body.trim()) body = parsed.body;
  }
  fs.writeFileSync(mdPath, serializeTaskMarkdown(task, body), 'utf-8');
}

export function mergeTaskFromMarkdownContent(content: string, task: TaskConfig): TaskConfig | null {
  const { frontmatter } = parseTaskMarkdown(content);
  const status = frontmatter.status;
  if (typeof status !== 'string' || !VALID_STATUSES.includes(status as TaskStatus)) {
    return null;
  }
  return {
    ...task,
    title: typeof frontmatter.title === 'string' ? frontmatter.title : task.title,
    status: status as TaskStatus,
    agent: typeof frontmatter.agent === 'string' ? frontmatter.agent : task.agent,
    workflow: typeof frontmatter.workflow === 'string' ? frontmatter.workflow : task.workflow,
    type: frontmatter.type === 'project' || frontmatter.type === 'simple'
      ? frontmatter.type
      : task.type,
    skills: Array.isArray(frontmatter.skills)
      ? frontmatter.skills.filter((s): s is string => typeof s === 'string')
      : task.skills,
    prd: typeof frontmatter.prd === 'string' ? frontmatter.prd : task.prd,
    goal: typeof frontmatter.goal === 'string' ? frontmatter.goal : task.goal,
    taskType: typeof frontmatter.taskType === 'string' ? frontmatter.taskType : task.taskType,
    updatedAt: new Date().toISOString(),
  };
}
export function ensureTaskMarkdown(task: TaskConfig, workspacePath: string): void {
  const mdPath = taskMarkdownPath(workspacePath, task.id);
  if (!fs.existsSync(mdPath)) {
    writeTaskMarkdown(task, workspacePath);
  }
}
