import fs from 'fs';
import path from 'path';
import {
  AGENTS_TEMPLATE_DIR,
  SKILLS_TEMPLATE_DIR,
  expandHome,
  resolveWorkspacePath,
} from '../config';
import { getPathSettings } from './fileStore';

export interface SetupCopyResult {
  copied: string[];
  skipped: string[];
}

export interface SetupConsoleResult {
  workspacePath: string;
  agentsDir: string;
  skillsDir: string;
  agents: SetupCopyResult;
  skills: SetupCopyResult;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFileIfMissing(src: string, dest: string, result: SetupCopyResult, label: string): void {
  if (fs.existsSync(dest)) {
    result.skipped.push(label);
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  result.copied.push(label);
}

function copyDirRecursive(src: string, dest: string, result: SetupCopyResult, relPrefix = ''): void {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, result, rel);
      continue;
    }

    copyFileIfMissing(srcPath, destPath, result, rel);
  }
}

function copyAgentTemplates(destDir: string): SetupCopyResult {
  const result: SetupCopyResult = { copied: [], skipped: [] };
  ensureDir(destDir);

  if (!fs.existsSync(AGENTS_TEMPLATE_DIR)) return result;

  for (const entry of fs.readdirSync(AGENTS_TEMPLATE_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name.endsWith('.memory.md')) continue;

    const src = path.join(AGENTS_TEMPLATE_DIR, entry.name);
    const dest = path.join(destDir, entry.name);
    copyFileIfMissing(src, dest, result, entry.name);
  }

  return result;
}

function copySkillTemplates(destDir: string): SetupCopyResult {
  const result: SetupCopyResult = { copied: [], skipped: [] };
  ensureDir(destDir);

  if (!fs.existsSync(SKILLS_TEMPLATE_DIR)) return result;

  for (const entry of fs.readdirSync(SKILLS_TEMPLATE_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const srcSkillDir = path.join(SKILLS_TEMPLATE_DIR, entry.name);
    const skillMd = path.join(srcSkillDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    const destSkillDir = path.join(destDir, entry.name);
    if (fs.existsSync(destSkillDir)) {
      result.skipped.push(entry.name);
      continue;
    }

    copyDirRecursive(srcSkillDir, destSkillDir, result, entry.name);
  }

  return result;
}

export function setupConsole(workspacePath: string): SetupConsoleResult {
  const resolvedWs = expandHome(workspacePath);
  const settings = getPathSettings();
  const agentsDir = resolveWorkspacePath(resolvedWs, settings, 'agents');
  const skillsDir = resolveWorkspacePath(resolvedWs, settings, 'skills');

  return {
    workspacePath: resolvedWs,
    agentsDir,
    skillsDir,
    agents: copyAgentTemplates(agentsDir),
    skills: copySkillTemplates(skillsDir),
  };
}
