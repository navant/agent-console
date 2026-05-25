import fs from 'fs';
import path from 'path';
import { resolveWorkspacePath, PRD_TEMPLATE_PATH } from '../config';
import { PrdFile, TaskConfig } from '../types';
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

export function deletePrdFile(workspacePath: string, relativePath: string): void {
  const filePath = resolvePrdFilePath(workspacePath, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error('PRD file not found');
  }
  fs.unlinkSync(filePath);
}

export function titleFromPrd(content: string, fallback: string): string {
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

export function buildPrdFromTemplate(filename: string): string {
  const title = titleFromFilename(filename);
  const safeName = filename.replace(/\.md$/i, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  const today = new Date().toISOString().slice(0, 10);

  let template = readFile(PRD_TEMPLATE_PATH);
  if (!template.trim()) {
    template = `---\nstatus: draft\ncreated: {{date}}\nupdated: {{date}}\n---\n\n# {{title}}\n\n## Overview\n\n## Requirements\n\n`;
  }

  return template
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{filename\}\}/g, safeName)
    .replace(/\{\{date\}\}/g, today);
}

export function createPrdFile(
  workspacePath: string,
  filename: string,
  content?: string
): PrdFile {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\.md$/i, '') + '.md';
  const rel = safe;
  const body = content?.trim() ? content : buildPrdFromTemplate(filename);
  savePrdContent(workspacePath, rel, body);
  return {
    id: rel,
    name: safe,
    path: rel,
    updatedAt: new Date().toISOString(),
  };
}

function defaultPrdTaskType(workspacePath: string): string | undefined {
  return (
    getTaskTypeDef(workspacePath, 'planning')?.id
    ?? getTaskTypes(workspacePath).find(t => t.name.toLowerCase() === 'planning')?.id
    ?? getDefaultTaskType(workspacePath)?.id
  );
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
  const taskType = data.taskType?.trim() || defaultPrdTaskType(workspacePath);

  return createTask(
    {
      title,
      agent: data.agent,
      workflow: data.workflow,
      skills: data.skills,
      taskType,
      prd: data.prdPath,
    },
    workspacePath
  );
}

export function ensurePrdDir(workspacePath: string): void {
  ensureDir(getPrdRoot(workspacePath));
}
