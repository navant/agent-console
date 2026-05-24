import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { TaskTypeDef } from '../types';
import { workspaceClaudeDir } from '../config';

const FILENAME = 'task-types.yaml';

const DEFAULT_TYPES: TaskTypeDef[] = [
  {
    id: 'planning',
    name: 'Planning',
    agent: '',
    skills: [],
    workflow: 'single-shot',
    default: true,
  },
  {
    id: 'review',
    name: 'Review',
    agent: '',
    skills: [],
    workflow: 'single-shot',
    default: false,
  },
  {
    id: 'implement',
    name: 'Implement',
    agent: '',
    skills: [],
    workflow: 'single-shot',
    default: false,
  },
];

function configPath(workspacePath: string): string {
  return path.join(workspaceClaudeDir(workspacePath), FILENAME);
}

function normalizeTypes(types: TaskTypeDef[]): TaskTypeDef[] {
  let defaultSet = false;
  return types.map(t => {
    const entry: TaskTypeDef = {
      id: t.id.trim(),
      name: t.name.trim() || t.id.trim(),
      agent: t.agent ?? '',
      skills: Array.isArray(t.skills) ? t.skills.filter(Boolean) : [],
      workflow: t.workflow?.trim() || 'single-shot',
      default: !!t.default && !defaultSet,
    };
    if (entry.default) defaultSet = true;
    return entry;
  });
}

export function getTaskTypes(workspacePath: string): TaskTypeDef[] {
  const filePath = configPath(workspacePath);
  if (!fs.existsSync(filePath)) {
    saveTaskTypes(workspacePath, DEFAULT_TYPES);
    return [...DEFAULT_TYPES];
  }
  try {
    const raw = yaml.load(fs.readFileSync(filePath, 'utf-8')) as { types?: TaskTypeDef[] };
    const types = normalizeTypes(raw?.types ?? []);
    return types.length > 0 ? types : DEFAULT_TYPES;
  } catch {
    return [...DEFAULT_TYPES];
  }
}

export function saveTaskTypes(workspacePath: string, types: TaskTypeDef[]): TaskTypeDef[] {
  const normalized = normalizeTypes(types);
  const dir = workspaceClaudeDir(workspacePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    configPath(workspacePath),
    yaml.dump({ types: normalized }, { lineWidth: -1, noRefs: true }),
    'utf-8'
  );
  return normalized;
}

export function getTaskTypeDef(workspacePath: string, id: string): TaskTypeDef | null {
  return getTaskTypes(workspacePath).find(t => t.id === id) ?? null;
}

export function getDefaultTaskType(workspacePath: string): TaskTypeDef | null {
  const types = getTaskTypes(workspacePath);
  return types.find(t => t.default) ?? types.find(t => t.id === 'planning') ?? types[0] ?? null;
}

export function resolveTaskTypeFields(
  workspacePath: string,
  input: {
    taskType?: string;
    agent?: string;
    workflow?: string;
    skills?: string[];
  }
): {
  taskType?: string;
  agent: string;
  workflow: string;
  skills: string[];
} {
  if (!input.taskType) {
    return {
      taskType: undefined,
      agent: input.agent ?? '',
      workflow: input.workflow?.trim() || 'single-shot',
      skills: input.skills ?? [],
    };
  }

  const def = getTaskTypeDef(workspacePath, input.taskType);
  if (!def) {
    return {
      taskType: input.taskType,
      agent: input.agent ?? '',
      workflow: input.workflow?.trim() || 'single-shot',
      skills: input.skills ?? [],
    };
  }

  return {
    taskType: def.id,
    agent: def.agent ?? '',
    workflow: def.workflow || input.workflow?.trim() || 'single-shot',
    skills: [...(def.skills ?? [])],
  };
}
