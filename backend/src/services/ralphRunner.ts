import { execSync } from 'child_process';
import { runClaude, stopActive, RunOptions } from './claudeRunner';
import {
  appendTaskProgress,
  getAgent,
  getAgentSoulPath,
  getPathSettings,
  getTask,
  getTaskPlan,
  saveTask,
  saveTaskPlan,
} from './fileStore';
import { stripMemoryFromPrompt } from './promptSanitize';
import { renderWorkflowTemplate } from './workflowRenderer';
import { resolveWorkflow } from './workflowStore';
import { TaskConfig } from '../types';
import { expandHome } from '../config';
import path from 'path';

export type RalphCallbacks = {
  onMessage: RunOptions['onMessage'];
  onProgress: (line: string) => void;
  onStoryComplete: (storyId: string) => void;
  onTaskUpdate: (task: TaskConfig) => void;
};

let ralphRunning = false;

export function isRalphRunning(): boolean {
  return ralphRunning;
}

export function stopRalphRunner(): void {
  stopActive();
  ralphRunning = false;
}

export async function runRalphLoop(
  taskId: string,
  workspacePath: string,
  callbacks: RalphCallbacks
): Promise<void> {
  const task = getTask(taskId, workspacePath);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const agent = task.agent ? getAgent(task.agent, workspacePath) : null;
  if (task.agent && !agent) throw new Error(`Agent "${task.agent}" not found`);

  const workflow = resolveWorkflow(task.workflow, workspacePath);
  if (!workflow || workflow.type !== 'loop') {
    throw new Error(`Workflow "${task.workflow}" is not a loop workflow`);
  }

  const plan = getTaskPlan(taskId, workspacePath);
  if (plan.userStories.length === 0) {
    throw new Error(
      'Task plan is empty. Generate or edit stories in the task plan (prd.json) before running Ralph loop.'
    );
  }

  const pending = plan.userStories
    .filter(s => !s.passes)
    .sort((a, b) => a.priority - b.priority);

  if (pending.length === 0) {
    task.status = 'review';
    task.updatedAt = new Date().toISOString();
    saveTask(task, workspacePath);
    callbacks.onTaskUpdate(task);
    return;
  }

  ralphRunning = true;
  const resolvedWs = expandHome(workspacePath);
  const settings = getPathSettings();
  const tasksRel = settings.tasks.replace(/^\.\//, '');
  const taskPlanRel = path.join(tasksRel, taskId, 'prd.json');
  const taskProgressRel = path.join(tasksRel, taskId, 'progress.txt');
  // Ralph loop uses plan stories + workflow template only — not task-type presets or task.skills.
  const skillPrefix = '';
  const soulPath = agent ? getAgentSoulPath(task.agent, workspacePath) : '';

  task.status = 'running';
  task.updatedAt = new Date().toISOString();
  saveTask(task, workspacePath);
  callbacks.onTaskUpdate(task);

  const maxIter = workflow.max_iterations ?? 20;
  let iteration = 0;

  for (const story of pending) {
    if (!ralphRunning || iteration >= maxIter) break;
    iteration++;

    const storyPrompt = stripMemoryFromPrompt(
      renderWorkflowTemplate(workflow.template, { story, memory: '' })
    );
    const pathNote = `Task plan: \`${taskPlanRel}\` (Agent Console updates \`passes\` after each story — do not edit that file unless asked). Progress log: \`${taskProgressRel}\`.`;
    const fullPrompt = [skillPrefix, pathNote, storyPrompt].filter(Boolean).join('\n\n---\n\n');

    appendTaskProgress(
      taskId,
      workspacePath,
      `[${new Date().toISOString()}] Starting story ${story.id}: ${story.title}`,
      callbacks.onProgress
    );

    try {
      await runClaudeOnce({
        taskId,
        prompt: fullPrompt,
        agent: {
          id: agent?.id ?? '',
          model: agent?.model ?? '',
          tools: agent?.tools ?? [],
        },
        soulPath,
        workspacePath: resolvedWs,
        sessionId: task.session_id,
        onMessage: m => {
          callbacks.onMessage(m);
          if (m.type === 'session_start' && !task.session_id) {
            task.session_id = m.sessionId;
            task.updatedAt = new Date().toISOString();
            saveTask(task, workspacePath);
          }
        },
      });

      story.passes = true;
      const updatedPlan = getTaskPlan(taskId, workspacePath);
      const idx = updatedPlan.userStories.findIndex(s => s.id === story.id);
      if (idx >= 0) updatedPlan.userStories[idx] = story;
      saveTaskPlan(taskId, workspacePath, updatedPlan);

      appendTaskProgress(
        taskId,
        workspacePath,
        `[${new Date().toISOString()}] ✓ Completed story ${story.id}`,
        callbacks.onProgress
      );
      callbacks.onStoryComplete(story.id);

      if (workflow.commit_on_story) {
        try {
          execSync(`git add -A && git commit -m "ralph: complete story ${story.id}"`, {
            cwd: resolvedWs,
            stdio: 'pipe',
          });
        } catch {
          // no changes or not a git repo
        }
      }
    } catch (err) {
      appendTaskProgress(
        taskId,
        workspacePath,
        `[${new Date().toISOString()}] ✗ Failed story ${story.id}: ${err}`,
        callbacks.onProgress
      );
      task.status = 'review';
      task.updatedAt = new Date().toISOString();
      saveTask(task, workspacePath);
      callbacks.onTaskUpdate(task);
      ralphRunning = false;
      return;
    }
  }

  task.status = 'review';
  task.updatedAt = new Date().toISOString();
  saveTask(task, workspacePath);
  callbacks.onTaskUpdate(task);
  ralphRunning = false;
}

function runClaudeOnce(opts: {
  taskId: string;
  prompt: string;
  agent: { id: string; model: string; tools: string[] };
  soulPath: string;
  workspacePath: string;
  sessionId?: string;
  onMessage: RunOptions['onMessage'];
}): Promise<void> {
  return new Promise((resolve, reject) => {
    runClaude({
      taskId: opts.taskId,
      prompt: opts.prompt,
      agentId: opts.agent.id,
      model: opts.agent.model,
      soulPath: opts.soulPath,
      workspacePath: opts.workspacePath,
      tools: opts.agent.tools,
      sessionId: opts.sessionId,
      onMessage: opts.onMessage,
      onDone: () => resolve(),
      onError: err => reject(new Error(err)),
    });
  });
}
