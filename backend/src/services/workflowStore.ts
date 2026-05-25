import { listWorkflows as listBuiltinWorkflows, getWorkflow } from './fileStore';
import { listArchonWorkflows, probeArchon } from './archonStore';
import { getArchonWorkspaceStatusWithCount } from './archonSetupStore';
import { WorkflowConfig } from '../types';

export const SINGLE_SHOT_WORKFLOW_ID = 'single-shot';
export const RALPH_LOOP_WORKFLOW_ID = 'ralph-loop';

export const ARCHON_INSTALL_STEPS = [
  {
    id: 'jq',
    label: 'jq (Ralph loop)',
    command: 'brew install jq',
    note: 'Required by scripts/ralph/ralph.sh',
  },
  {
    id: 'claude',
    label: 'Claude Code CLI',
    command: 'curl -fsSL https://claude.ai/install.sh | bash',
    note: 'Archon orchestrates Claude Code; install separately.',
  },
  {
    id: 'archon',
    label: 'Archon CLI',
    command: 'curl -fsSL https://archon.diy/install | bash',
    note: 'Or: brew install coleam00/archon/archon',
  },
  {
    id: 'gh',
    label: 'GitHub CLI (optional)',
    command: 'brew install gh',
    note: 'Required for some Archon workflows that open PRs.',
  },
  {
    id: 'path',
    label: 'Verify',
    command: 'archon version',
    note: 'Run from your project repo, not from the Archon source repo.',
  },
  {
    id: 'setup',
    label: 'Project setup',
    command: 'archon setup --scope project',
    note: 'Interactive wizard — writes .archon/.env (never repo .env). Use Workflows → Setup workspace for scaffold + validate.',
  },
];

export interface WorkflowDependencyStatus {
  archon: boolean;
  archonVersion?: string;
  archonError?: string;
  claude: boolean;
  jq: boolean;
  workspace?: {
    gitRepo: boolean;
    jq: boolean;
    ralphScripts: boolean;
    ralphLoopWorkflow: boolean;
    projectArchonDir: boolean;
    projectEnvFile: boolean;
    workflowsDir: boolean;
    archonSkillInstalled: boolean;
    workflowCount?: number;
    globalEnvFile: boolean;
  };
}

function commandOnPath(bin: string): boolean {
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    execSync(process.platform === 'win32' ? `where ${bin}` : `which ${bin}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function getWorkflowDependencyStatus(
  workspacePath?: string
): Promise<WorkflowDependencyStatus> {
  const probe = await probeArchon();
  const base: WorkflowDependencyStatus = {
    archon: probe.available,
    archonVersion: probe.version,
    archonError: probe.error,
    claude: commandOnPath('claude'),
    jq: commandOnPath('jq'),
  };
  if (workspacePath) {
    base.workspace = await getArchonWorkspaceStatusWithCount(workspacePath);
  }
  return base;
}

function singleShotWorkflow(): WorkflowConfig {
  return {
    id: SINGLE_SHOT_WORKFLOW_ID,
    name: 'Single shot',
    type: 'single',
    skills: [],
    template: '{{prompt}}',
    source: 'builtin',
    description: 'One Claude Code run with task prompt, optional PRD, and skills (memory via MCP/tools only).',
  };
}

function ralphLoopWorkflow(): WorkflowConfig {
  return {
    id: RALPH_LOOP_WORKFLOW_ID,
    name: 'Ralph loop',
    type: 'loop',
    max_iterations: 20,
    commit_on_story: true,
    skills: ['ralph'],
    template: `You are working on story {{story.id}}: {{story.title}}.
{{story.description}}

Acceptance criteria:
{{#each story.acceptanceCriteria}}- {{this}}
{{/each}}`,
    source: 'builtin',
    description:
      'Autonomous loop: one story per Claude run until task plan is complete. Setup copies scripts/ralph/ from templates.',
  };
}

export function isRalphLoopWorkflowId(workflowId: string, workflows?: WorkflowConfig[]): boolean {
  if (workflowId === RALPH_LOOP_WORKFLOW_ID) return true;
  if (workflows) {
    const w = workflows.find(x => x.id === workflowId);
    return w?.type === 'loop' && w.source !== 'archon';
  }
  return false;
}

/** Built-in single-shot plus Archon workflows when CLI is on PATH. */
export async function listWorkflowsForWorkspace(workspacePath?: string): Promise<WorkflowConfig[]> {
  const out: WorkflowConfig[] = [singleShotWorkflow(), ralphLoopWorkflow()];
  const seen = new Set<string>([SINGLE_SHOT_WORKFLOW_ID, RALPH_LOOP_WORKFLOW_ID]);

  if (workspacePath) {
    for (const w of listBuiltinWorkflows(workspacePath)) {
      if (
        w.id === SINGLE_SHOT_WORKFLOW_ID ||
        w.id === RALPH_LOOP_WORKFLOW_ID ||
        seen.has(w.id)
      ) {
        continue;
      }
      seen.add(w.id);
      out.push(w);
    }
  }

  const probe = await probeArchon();
  if (probe.available && workspacePath) {
    try {
      const archon = await listArchonWorkflows(workspacePath);
      for (const w of archon) {
        if (seen.has(w.id)) continue;
        seen.add(w.id);
        out.push({
          id: w.id,
          name: w.name,
          type: 'single',
          skills: [],
          template: '',
          source: 'archon',
          description: w.description,
        });
      }
    } catch {
      // Archon missing or list failed — single-shot only
    }
  }

  return out;
}

export function isArchonWorkflowId(workflowId: string, workflows?: WorkflowConfig[]): boolean {
  if (workflowId === SINGLE_SHOT_WORKFLOW_ID || workflowId === RALPH_LOOP_WORKFLOW_ID) return false;
  if (workflows) {
    const w = workflows.find(x => x.id === workflowId);
    return w?.source === 'archon';
  }
  return workflowId.startsWith('archon-') || workflowId.includes('archon');
}

export function resolveWorkflow(
  workflowId: string,
  workspacePath?: string
): WorkflowConfig | null {
  if (workflowId === SINGLE_SHOT_WORKFLOW_ID) return singleShotWorkflow();
  if (workflowId === RALPH_LOOP_WORKFLOW_ID) return ralphLoopWorkflow();
  if (workspacePath) {
    const builtin = getWorkflow(workflowId, workspacePath);
    if (builtin) return builtin;
  }
  return null;
}
