import path from 'path';
import {
  appendTaskProgress,
  buildSkillInvocationPrompt,
  ensureSkillToolAllowed,
  getAgent,
  getAgentSoulPath,
  getPathSettings,
  getTask,
  getTaskPlan,
  getTaskPrompt,
  saveTask,
} from './fileStore';
import { getPrdContent, createPrdFile } from './prdStore';
import { runClaude } from './claudeRunner';
import { createRunCommentTracker, formatCommentsForPrompt, getTaskComments } from './taskComments';
import { prdLooksSubstantive } from './ralphLoopGuards';
import { TaskRunCallbacks } from './taskRunner';
import { expandHome } from '../config';

export type TaskPlanPhase = 'write-prd' | 'convert-ralph';

function slugFromTitle(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'feature'
  );
}

function ensureTaskPrdLink(taskId: string, workspacePath: string): string {
  const task = getTask(taskId, workspacePath);
  if (!task) throw new Error(`Task ${taskId} not found`);
  if (task.prd?.trim()) return task.prd.trim();

  const prd = createPrdFile(
    workspacePath,
    `prd-${slugFromTitle(task.title)}`,
    `# ${task.title}\n\n${(getTaskPrompt(taskId, workspacePath) || '').trim()}\n`
  );
  task.prd = prd.path;
  task.updatedAt = new Date().toISOString();
  saveTask(task, workspacePath);
  return prd.path;
}

function buildWritePrdPrompt(
  taskId: string,
  workspacePath: string,
  prdRel: string
): string {
  const task = getTask(taskId, workspacePath)!;
  const settings = getPathSettings();
  const prdDir = settings.prd.replace(/^\.\//, '');
  const taskPrompt = (getTaskPrompt(taskId, workspacePath) || task.title).trim();
  const comments = getTaskComments(workspacePath, taskId);
  const commentBlock = formatCommentsForPrompt(comments, {
    nudge: true,
    maxComments: 16,
  });

  let prdBlock = '';
  try {
    const full = getPrdContent(workspacePath, prdRel);
    prdBlock = `## Current PRD (\`${prdRel}\`)\n\n${full.slice(0, 12000)}`;
  } catch {
    prdBlock = `## PRD file\n\nCreate and save: \`${prdDir}/${prdRel}\``;
  }

  const skillBlock = buildSkillInvocationPrompt(['prd'], workspacePath);

  return [
    skillBlock,
    `# Task ${task.id}: ${task.title}`,
    '## Planning phase 1 of 3 — Write PRD (prd skill)',
    `**First step:** invoke the **prd** skill via the Skill tool, then follow it fully.`,
    `**Save the spec to:** \`${prdDir}/${prdRel}\` (workspace PRD folder). Update that file on disk.`,
    'Do **not** ask the user new questions in chat only — if you need answers, use AskUserQuestion; answers land in the PRD under `## User answers`.',
    'Do **not** implement code. Do **not** write `prd.json` yet — phase 2 uses the **ralph** skill.',
    'The finished PRD must include real requirements (goals, scope, acceptance criteria) — not only `## User answers`.',
    prdBlock,
    '## Task context',
    taskPrompt,
    commentBlock,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
}

function buildConvertRalphPrompt(
  taskId: string,
  workspacePath: string,
  prdRel: string,
  planRel: string
): string {
  const task = getTask(taskId, workspacePath)!;
  const taskPrompt = (getTaskPrompt(taskId, workspacePath) || task.title).trim();
  const comments = getTaskComments(workspacePath, taskId);
  const commentBlock = formatCommentsForPrompt(comments, { maxComments: 12 });

  let prdExcerpt = '';
  try {
    const full = getPrdContent(workspacePath, prdRel);
    prdExcerpt =
      full.length > 12000
        ? `${full.slice(0, 12000)}\n\n…`
        : full;
  } catch {
    throw new Error(`PRD not found: ${prdRel}. Run "Write PRD" first.`);
  }

  if (!prdLooksSubstantive(workspacePath, prdRel)) {
    throw new Error(
      `PRD "${prdRel}" has no full spec yet (only stubs or user answers). Run "Write PRD" first.`
    );
  }

  const skillBlock = buildSkillInvocationPrompt(['ralph'], workspacePath);

  return [
    skillBlock,
    `# Task ${task.id}: ${task.title}`,
    '## Planning phase 2 of 3 — Build plan (ralph skill)',
    `**First step:** invoke the **ralph** skill via the Skill tool, then follow it to convert the PRD into Ralph JSON.`,
    `**PRD source:** \`${prdRel}\``,
    `**Write user stories to:** \`${planRel}\` (Agent Console task plan — **not** \`scripts/ralph/prd.json\`).`,
    'Set every story `passes: false`. Do **not** implement stories — phase 3 is **Run loop**.',
    `## PRD content\n\n${prdExcerpt}`,
    '## Extra task context',
    taskPrompt,
    commentBlock,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
}

export function executeTaskPlanPhase(
  taskId: string,
  workspacePath: string,
  phase: TaskPlanPhase,
  callbacks: TaskRunCallbacks
): Promise<void> {
  const { sendTo, broadcast } = callbacks;

  return new Promise((resolve, reject) => {
    const task = getTask(taskId, workspacePath);
    if (!task) {
      sendTo({ type: 'error', message: `Task ${taskId} not found` });
      reject(new Error('Task not found'));
      return;
    }

    if (task.workflow !== 'ralph-loop') {
      sendTo({
        type: 'error',
        message: 'Plan phases apply only to tasks with workflow ralph-loop',
      });
      reject(new Error('Not a ralph-loop task'));
      return;
    }

    const agent = task.agent ? getAgent(task.agent, workspacePath) : null;
    if (task.agent && !agent) {
      sendTo({ type: 'error', message: `Agent "${task.agent}" not found` });
      reject(new Error('Agent not found'));
      return;
    }

    const settings = getPathSettings();
    const tasksRel = settings.tasks.replace(/^\.\//, '');
    const planRel = path.join(tasksRel, taskId, 'prd.json');
    const agentName = agent?.name ?? 'Agent';

    let prdRel: string;
    try {
      prdRel = ensureTaskPrdLink(taskId, workspacePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendTo({ type: 'error', message });
      reject(new Error(message));
      return;
    }

    const latest = getTask(taskId, workspacePath)!;
    if (prdRel !== latest.prd) {
      broadcast({ type: 'task_update', task: latest });
    }

    let prompt: string;
    try {
      prompt =
        phase === 'write-prd'
          ? buildWritePrdPrompt(taskId, workspacePath, prdRel)
          : buildConvertRalphPrompt(taskId, workspacePath, prdRel, planRel);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendTo({ type: 'error', message });
      reject(new Error(message));
      return;
    }

    const commentTracker = createRunCommentTracker(
      workspacePath,
      taskId,
      agentName,
      c => broadcast({ type: 'comment_append', taskId, comment: c })
    );

    // Planning runs must start a new session in the workspace (project skills), not resume an old one.
    task.session_id = undefined;
    task.status = 'running';
    task.updatedAt = new Date().toISOString();
    saveTask(task, workspacePath);
    broadcast({ type: 'task_update', task });

    const label = phase === 'write-prd' ? 'Write PRD (prd skill)' : 'Build plan (ralph skill)';
    appendTaskProgress(
      taskId,
      workspacePath,
      `[${new Date().toISOString()}] ${label}\n`,
      line => broadcast({ type: 'progress_append', taskId, line })
    );

    const soulPath = agent ? getAgentSoulPath(agent.id, workspacePath) : '';
    const resolvedWs = expandHome(workspacePath);

    runClaude({
      taskId,
      prompt,
      agentId: agent?.id ?? '',
      model: agent?.model ?? '',
      soulPath,
      workspacePath: resolvedWs,
      tools: ensureSkillToolAllowed(agent?.tools ?? []),
      freshSession: true,
      onMessage: m => {
        commentTracker.onMessage(m);
        sendTo(m);
        if (m.type === 'session_start') {
          task.session_id = m.sessionId;
          task.updatedAt = new Date().toISOString();
          saveTask(task, workspacePath);
        }
      },
      onDone: sessionId => {
        commentTracker.onDone();
        if (sessionId) task.session_id = sessionId;
        task.status = 'todo';
        task.updatedAt = new Date().toISOString();

        let doneResult =
          phase === 'write-prd'
            ? 'PRD phase finished — review the linked PRD, then run Build plan (ralph skill)'
            : 'Plan phase finished — review prd.json, then Run loop';

        if (phase === 'write-prd' && !prdLooksSubstantive(workspacePath, prdRel)) {
          appendTaskProgress(
            taskId,
            workspacePath,
            `[${new Date().toISOString()}] ⚠ ${label} finished but PRD has no full spec yet — re-run Write PRD\n`,
            line => broadcast({ type: 'progress_append', taskId, line })
          );
          sendTo({
            type: 'error',
            message:
              'PRD file was not updated with a full spec (only title or user answers). Re-run Write PRD.',
          });
          doneResult = 'PRD incomplete — re-run Write PRD skill';
        } else if (phase === 'convert-ralph') {
          const plan = getTaskPlan(taskId, workspacePath);
          if (plan.userStories.length > 0) {
            task.status = 'planned';
          } else {
            appendTaskProgress(
              taskId,
              workspacePath,
              `[${new Date().toISOString()}] ⚠ ${label} finished but prd.json has no stories — re-run Build plan\n`,
              line => broadcast({ type: 'progress_append', taskId, line })
            );
            sendTo({
              type: 'error',
              message: 'prd.json has no user stories. Re-run Build plan (ralph skill).',
            });
            doneResult = 'Plan incomplete — re-run ralph skill';
          }
        }

        saveTask(task, workspacePath);
        appendTaskProgress(
          taskId,
          workspacePath,
          `[${new Date().toISOString()}] ${label} finished — ${task.status}\n`,
          line => broadcast({ type: 'progress_append', taskId, line })
        );
        broadcast({ type: 'task_update', task: getTask(taskId, workspacePath) ?? task });
        sendTo({ type: 'done', result: doneResult });
        resolve();
      },
      onError: err => {
        commentTracker.onError(err);
        task.status = 'todo';
        task.updatedAt = new Date().toISOString();
        saveTask(task, workspacePath);
        broadcast({ type: 'task_update', task });
        sendTo({ type: 'error', message: err });
        sendTo({ type: 'done', result: '' });
        reject(new Error(err));
      },
    });
  });
}
