import fs from 'fs';
import path from 'path';
import { resolveWorkspacePath } from '../config';
import { PrdFile, TaskConfig } from '../types';
import { createTask, getPathSettings } from './fileStore';
import { getDefaultTaskType } from './taskTypesStore';

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

export function getPrdRoot(workspacePath: string): string {
  return resolveWorkspacePath(workspacePath, getPathSettings(), 'prd');
}

export function resolvePrdFilePath(workspacePath: string, relativePath: string): string {
  const root = path.resolve(getPrdRoot(workspacePath));
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error('Invalid PRD path');
  }
  return resolved;
}

function scanPrdDir(dir: string, base: string, out: PrdFile[]): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanPrdDir(full, base ? `${base}/${name}` : name, out);
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

export function listPrdFiles(workspacePath: string): PrdFile[] {
  const root = getPrdRoot(workspacePath);
  ensureDir(root);
  const files: PrdFile[] = [];
  scanPrdDir(root, '', files);
  return files;
}

export function getPrdContent(workspacePath: string, relativePath: string): string {
  return readFile(resolvePrdFilePath(workspacePath, relativePath));
}

export function savePrdContent(
  workspacePath: string,
  relativePath: string,
  content: string
): void {
  writeFile(resolvePrdFilePath(workspacePath, relativePath), content);
}

export function titleFromPrd(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
}

export function createPlanningTaskForPrd(
  workspacePath: string,
  prdPath: string,
  content: string
): TaskConfig | null {
  const taskTypeDef = getDefaultTaskType(workspacePath);
  if (!taskTypeDef) return null;

  const title = `Plan: ${titleFromPrd(content, path.basename(prdPath))}`;
  return createTask(
    {
      title,
      taskType: taskTypeDef.id,
      prd: prdPath,
      description: content,
    },
    workspacePath
  );
}

export function createPrdFile(
  workspacePath: string,
  filename: string,
  content: string
): { file: PrdFile; task: TaskConfig | null } {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\.md$/i, '') + '.md';
  const rel = safe;
  savePrdContent(workspacePath, rel, content);
  const file: PrdFile = {
    id: rel,
    name: safe,
    path: rel,
    updatedAt: new Date().toISOString(),
  };
  const task = createPlanningTaskForPrd(workspacePath, rel, content);
  return { file, task };
}

export function implementPrdAsTask(
  workspacePath: string,
  data: {
    prdPath: string;
    agent?: string;
    workflow?: string;
    skills?: string[];
    title?: string;
    taskType?: string;
  }
): TaskConfig {
  const content = getPrdContent(workspacePath, data.prdPath);
  const title = data.title?.trim() || titleFromPrd(content, path.basename(data.prdPath));

  return createTask(
    {
      title,
      agent: data.agent,
      workflow: data.workflow,
      skills: data.skills,
      taskType: data.taskType,
      description: content,
      prd: data.prdPath,
    },
    workspacePath
  );
}

export function ensurePrdDir(workspacePath: string): void {
  ensureDir(getPrdRoot(workspacePath));
}
