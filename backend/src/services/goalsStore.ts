import fs from 'fs';
import path from 'path';
import { resolveWorkspacePath, GOALS_TEMPLATE_PATH } from '../config';
import { GoalFile, TaskConfig } from '../types';
import { createTask, getPathSettings } from './fileStore';
import { getDefaultTaskType, getTaskTypeDef, getTaskTypes } from './taskTypesStore';

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

export function getGoalsRoot(workspacePath: string): string {
  return resolveWorkspacePath(workspacePath, getPathSettings(), 'goals');
}

export function resolveGoalFilePath(workspacePath: string, relativePath: string): string {
  const root = path.resolve(getGoalsRoot(workspacePath));
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error('Invalid goal path');
  }
  return resolved;
}

function scanGoalsDir(dir: string, base: string, out: GoalFile[]): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanGoalsDir(full, base ? `${base}/${name}` : name, out);
    } else if (/\.(md|markdown)$/i.test(name)) {
      const rel = base ? `${base}/${name}` : name;
      out.push({
        id: rel,
        name,
        path: rel,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  }
}

export function listGoalFiles(workspacePath: string): GoalFile[] {
  const root = getGoalsRoot(workspacePath);
  ensureDir(root);
  const files: GoalFile[] = [];
  scanGoalsDir(root, '', files);
  return files;
}

export function getGoalContent(workspacePath: string, relativePath: string): string {
  return readFile(resolveGoalFilePath(workspacePath, relativePath));
}

export function saveGoalContent(
  workspacePath: string,
  relativePath: string,
  content: string
): void {
  writeFile(resolveGoalFilePath(workspacePath, relativePath), content);
}

export function deleteGoalFile(workspacePath: string, relativePath: string): void {
  const filePath = resolveGoalFilePath(workspacePath, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error('Goal file not found');
  }
  fs.unlinkSync(filePath);
}

export function titleFromGoal(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
}

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.md$/i, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function buildGoalFromTemplate(filename: string): string {
  const title = titleFromFilename(filename);
  const safeName = filename.replace(/\.md$/i, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  const today = new Date().toISOString().slice(0, 10);

  let template = readFile(GOALS_TEMPLATE_PATH);
  if (!template.trim()) {
    template = `---\nstatus: active\ncreated: {{date}}\nupdated: {{date}}\n---\n\n# {{title}}\n\n## Outcome\n\n## Success metrics\n\n`;
  }

  return template
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{filename\}\}/g, safeName)
    .replace(/\{\{date\}\}/g, today);
}

export function createGoalFile(
  workspacePath: string,
  filename: string,
  content?: string
): GoalFile {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\.md$/i, '') + '.md';
  const rel = safe;
  const body = content?.trim() ? content : buildGoalFromTemplate(filename);
  saveGoalContent(workspacePath, rel, body);
  return {
    id: rel,
    name: safe,
    path: rel,
    updatedAt: new Date().toISOString(),
  };
}

function defaultGoalTaskType(workspacePath: string): string | undefined {
  return (
    getTaskTypeDef(workspacePath, 'goals')?.id
    ?? getTaskTypes(workspacePath).find(t => t.name.toLowerCase() === 'goals')?.id
    ?? getDefaultTaskType(workspacePath)?.id
  );
}

/** Slash command sent to Claude Code for goals tasks (interactive /goal skill). */
export function buildGoalSlashCommand(goalRelativePath: string): string {
  const normalized = goalRelativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const withPrefix = normalized.startsWith('goals/') ? normalized : `goals/${normalized}`;
  return `/goal ${withPrefix}`;
}

export function invokeGoalAsTask(
  workspacePath: string,
  data: {
    goalPath: string;
    agent?: string;
    workflow?: string;
    skills?: string[];
    title?: string;
    taskType?: string;
  }
): TaskConfig {
  const content = getGoalContent(workspacePath, data.goalPath);
  const title = data.title?.trim() || titleFromGoal(content, path.basename(data.goalPath));
  const taskType = data.taskType?.trim() || defaultGoalTaskType(workspacePath);

  return createTask(
    {
      title,
      agent: data.agent,
      workflow: data.workflow,
      skills: data.skills,
      taskType,
      goal: data.goalPath,
    },
    workspacePath
  );
}

export function ensureGoalsDir(workspacePath: string): void {
  ensureDir(getGoalsRoot(workspacePath));
}
