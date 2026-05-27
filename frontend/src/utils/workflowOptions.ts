import { WorkflowConfig } from '../types';

export type WorkflowGroupId = 'builtin' | 'archon' | 'workspace' | 'global';

export interface WorkflowGroup {
  id: WorkflowGroupId;
  label: string;
  hint: string;
  workflows: WorkflowConfig[];
}

const BUILTIN_ORDER = ['single-shot', 'ralph-loop'] as const;

export function isRalphLoopWorkflow(workflowId: string): boolean {
  return workflowId === 'ralph-loop';
}

export function groupWorkflowsForSelect(workflows: WorkflowConfig[]): WorkflowGroup[] {
  const builtin = workflows
    .filter(w => w.source === 'builtin')
    .sort((a, b) => BUILTIN_ORDER.indexOf(a.id as (typeof BUILTIN_ORDER)[number]) - BUILTIN_ORDER.indexOf(b.id as (typeof BUILTIN_ORDER)[number]));
  const archon = workflows.filter(w => w.source === 'archon').sort((a, b) => a.name.localeCompare(b.name));
  const workspace = workflows.filter(w => w.source === 'workspace').sort((a, b) => a.name.localeCompare(b.name));
  const global = workflows.filter(w => w.source === 'global').sort((a, b) => a.name.localeCompare(b.name));

  const groups: WorkflowGroup[] = [];

  if (builtin.length > 0) {
    groups.push({
      id: 'builtin',
      label: 'Agent Console (built-in)',
      hint: 'Single shot = one run. Ralph loop = one story per run until the task plan is done.',
      workflows: builtin,
    });
  }
  if (archon.length > 0) {
    groups.push({
      id: 'archon',
      label: 'Archon (local CLI)',
      hint: 'From `archon workflow list` in this workspace. Requires Archon CLI + setup.',
      workflows: archon,
    });
  }
  if (workspace.length > 0) {
    groups.push({
      id: 'workspace',
      label: 'Workspace WORKFLOW.md',
      hint: 'Custom folders under .claude/workflows/',
      workflows: workspace,
    });
  }
  if (global.length > 0) {
    groups.push({
      id: 'global',
      label: 'Global workflows',
      hint: 'From ~/.claude/workflows',
      workflows: global,
    });
  }

  return groups;
}

export function workflowOptionLabel(w: WorkflowConfig): string {
  if (w.id === 'single-shot') return 'Single shot — one Claude run';
  if (w.id === 'ralph-loop') return 'Ralph loop — PRD stories until done';
  if (w.source === 'archon') return w.name;
  return `${w.name} (${w.type})`;
}

export function workflowRunHint(w: WorkflowConfig | undefined): string {
  if (!w) return '';
  if (w.id === 'single-shot') {
    return 'Default: one Claude Code session with task prompt, memory, and skills.';
  }
  if (w.id === 'ralph-loop') {
    return 'Runs each pending story in the task plan (generate plan first). Or use ./scripts/ralph/ralph.sh after workspace setup.';
  }
  if (w.source === 'archon') {
    return `Runs locally: archon workflow run ${w.id}`;
  }
  if (w.type === 'loop') {
    return 'Loop workflow from WORKFLOW.md';
  }
  return w.description ?? 'Workspace workflow from WORKFLOW.md';
}

export function findWorkflowById(workflows: WorkflowConfig[], id: string): WorkflowConfig | undefined {
  return workflows.find(w => w.id === id);
}
