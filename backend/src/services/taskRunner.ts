import {
  getTask,
  getAgent,
  getAgentSoulPath,
  getTaskPrompt,
  getTaskPlan,
  buildMemoryContext,
  buildSkillInvocationPrompt,
  ensureSkillToolAllowed,
  appendTaskProgress,
  saveTask,
  listTasks,
} from './fileStore';
import { getPrdContent } from './prdStore';
import {
  getTaskComments,
  formatCommentsForPrompt,
  createRunCommentTracker,
  hasPendingUserFeedback,
} from './taskComments';
import { runClaude, stopActive, isClaudeRunning } from './claudeRunner';
import { runRalphLoop, isRalphRunning, stopRalph } from './ralphRunner';
import { TaskConfig, WSServerMessage } from '../types';

export type RunSource = 'manual' | 'queue' | 'nudge';

export interface ExecuteTaskOptions {
  nudge?: boolean;
  source?: RunSource;
}

export interface TaskRunCallbacks {
  sendTo: (msg: WSServerMessage) => void;
  broadcast: (msg: unknown) => void;
}

export function isTaskRunnerBusy(): boolean {
  return isClaudeRunning() || isRalphRunning();
}

export function buildTaskPrompt(
  taskId: string,
  workspacePath: string,
  task: { agent: string; skills: string[]; title: string; prd?: string },
  options?: { nudge?: boolean; feedbackOnly?: boolean }
): string {
  const comments = getTaskComments(workspacePath, taskId);
  const pendingFeedback = hasPendingUserFeedback(comments);
  const useNudge = options?.nudge || pendingFeedback || options?.feedbackOnly;

  if (useNudge) {
    return buildNudgePrompt(taskId, workspacePath, task, comments);
  }

  const memory = buildMemoryContext(workspacePath, task.agent);
  const skills = buildSkillInvocationPrompt(task.skills, workspacePath);
  let prompt = getTaskPrompt(taskId, workspacePath) || task.title;
  if (task.prd) {
    try {
      const prdBody = getPrdContent(workspacePath, task.prd);
      if (prdBody.trim()) {
        prompt = `# PRD: ${task.prd}\n\n${prdBody}\n\n---\n\n${prompt}`;
      }
    } catch {
      // ignore missing prd file
    }
  }
  const commentBlock = formatCommentsForPrompt(comments, { nudge: false });
  const parts: string[] = [];
  if (memory) parts.push(memory);
  if (skills) parts.push(skills);
  parts.push(prompt);
  if (commentBlock) {
    parts.push(
      commentBlock +
        '\n\nAddress any open user comments above as part of this run. Do not claim the task is finished while user feedback is unanswered.'
    );
  }
  return parts.join('\n\n---\n\n');
}

function buildNudgePrompt(
  taskId: string,
  workspacePath: string,
  task: { title: string; prd?: string; skills: string[] },
  comments: ReturnType<typeof getTaskComments>
): string {
  const taskPrompt = getTaskPrompt(taskId, workspacePath) || task.title;
  let prdSnippet = '';
  if (task.prd) {
    try {
      const prdBody = getPrdContent(workspacePath, task.prd);
      if (prdBody.trim()) prdSnippet = `\n\n## Linked PRD (${task.prd})\n${prdBody.slice(0, 3000)}`;
    } catch { /* ignore */ }
  }

  const thread = formatCommentsForPrompt(comments, { nudge: true });
  const skills = buildSkillInvocationPrompt(task.skills, workspacePath);
  const skillsBlock = skills ? `${skills}\n\n---\n\n` : '';

  return `${skillsBlock}# Task: ${task.title} (${taskId})

## Your job right now
The user left comments on this task. Read the full comment thread below and **continue working** — address every user message, fix issues, and implement requested changes.

**Do NOT** reply with "task completed" or stop unless all user comments are fully addressed.

## Original spec
${taskPrompt.slice(0, 4000)}${prdSnippet}

${thread}

Respond in the task thread with what you changed and what is still open.

If the user asks you to run a shell command (e.g. print test), use the Bash tool to execute it and report the output.`;
}

/** Tasks with user comments not yet answered by the agent. */
export function findTasksNeedingNudge(workspacePath: string): TaskConfig[] {
  return listTasks(workspacePath).filter(t => {
    if (t.status === 'running' || t.status === 'done' || t.status === 'archive') return false;
    const comments = getTaskComments(workspacePath, t.id);
    return hasPendingUserFeedback(comments);
  });
}

export function findNextTodoTask(workspacePath: string): TaskConfig | null {
  const todos = listTasks(workspacePath).filter(
    t => t.status === 'todo' || t.status === 'planned'
  );
  return todos.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )[0] ?? null;
}

export function executeTask(
  taskId: string,
  workspacePath: string,
  options: ExecuteTaskOptions,
  callbacks: TaskRunCallbacks
): Promise<void> {
  const { sendTo, broadcast } = callbacks;
  const nudge = !!options.nudge;

  return new Promise((resolve, reject) => {
    const task = getTask(taskId, workspacePath);
    if (!task) {
      sendTo({ type: 'error', message: `Task ${taskId} not found` });
      reject(new Error('Task not found'));
      return;
    }

    if (isTaskRunnerBusy()) {
      sendTo({ type: 'error', message: 'Another task is already running' });
      reject(new Error('Busy'));
      return;
    }

    const agent = task.agent ? getAgent(task.agent, workspacePath) : null;
    if (task.agent && !agent) {
      sendTo({ type: 'error', message: `Agent "${task.agent}" not found` });
      reject(new Error('Agent not found'));
      return;
    }

    const soulPath = agent ? getAgentSoulPath(agent.id, workspacePath) : '';
    const agentName = agent?.name ?? 'Agent';
    const comments = getTaskComments(workspacePath, taskId);
    const pendingFeedback = hasPendingUserFeedback(comments);
    const useNudgePrompt = nudge || pendingFeedback;

    const commentTracker = createRunCommentTracker(
      workspacePath,
      task.id,
      agentName,
      (comment) => broadcast({ type: 'comment_append', taskId: task.id, comment })
    );
    commentTracker.onRunStart(nudge || pendingFeedback);

    task.status = 'running';
    task.updatedAt = new Date().toISOString();
    saveTask(task, workspacePath);
    broadcast({ type: 'task_update', task });

    const finish = () => resolve();
    const fail = (err: Error) => reject(err);

    const runSimpleTask = (freshSession: boolean) => {
      const prompt = buildTaskPrompt(taskId, workspacePath, task, { nudge: useNudgePrompt });
      const sessionId = freshSession ? undefined : task.session_id;

      runClaude({
        taskId: task.id,
        prompt,
        agentId: agent?.id ?? '',
        model: agent?.model ?? '',
        soulPath,
        workspacePath,
        tools: task.skills.length > 0 ? ensureSkillToolAllowed(agent?.tools ?? []) : (agent?.tools ?? []),
        sessionId,
        onMessage: (m) => {
          commentTracker.onMessage(m);
          sendTo(m);
          if (m.type === 'session_start') {
            task.session_id = m.sessionId;
            task.updatedAt = new Date().toISOString();
            saveTask(task, workspacePath);
          }
        },
        onDone: (sessionId) => {
          const stats = commentTracker.onDone();
          if (stats.substantive) {
            task.session_id = sessionId || task.session_id;
          }
          task.status =
            !stats.substantive && stats.toolUseCount === 0
              ? 'todo'
              : pendingFeedback || nudge
                ? 'todo'
                : 'review';
          task.updatedAt = new Date().toISOString();
          saveTask(task, workspacePath);
          appendTaskProgress(
            task.id,
            workspacePath,
            `[${new Date().toISOString()}] Run finished — ${task.status} (tools: ${stats.toolUseCount}, ${stats.durationMs}ms)`,
            (line) => broadcast({ type: 'progress_append', taskId: task.id, line })
          );
          sendTo({
            type: 'done',
            result:
              !stats.substantive && stats.toolUseCount === 0
                ? 'No tools run — returned to todo'
                : task.status === 'todo'
                  ? 'Returned to todo — review comments'
                  : 'Moved to review — continue in chat',
          });
          broadcast({ type: 'task_update', task });
          finish();
        },
        onError: (err) => {
          commentTracker.onError(err);
          sendTo({ type: 'error', message: err });
          task.status = 'todo';
          task.updatedAt = new Date().toISOString();
          saveTask(task, workspacePath);
          broadcast({ type: 'task_update', task });
          fail(new Error(err));
        },
      });
    };

    if (task.type === 'project') {
      const plan = getTaskPlan(taskId, workspacePath);
      const pendingStories = plan.userStories.filter(s => !s.passes);
      if (pendingStories.length === 0) {
        runSimpleTask(true);
        return;
      }

      runRalphLoop(taskId, workspacePath, {
        onMessage: (m) => {
          commentTracker.onMessage(m);
          sendTo(m);
          if (m.type === 'session_start') {
            task.session_id = m.sessionId;
            task.updatedAt = new Date().toISOString();
            saveTask(task, workspacePath);
          }
        },
        onProgress: (line) => {
          broadcast({ type: 'progress_append', taskId: task.id, line });
        },
        onStoryComplete: (storyId) => {
          broadcast({ type: 'story_complete', taskId: task.id, storyId });
        },
        onTaskUpdate: (updated) => {
          broadcast({ type: 'task_update', task: updated });
        },
      })
        .then(() => {
          const stats = commentTracker.onDone();
          sendTo({
            type: 'done',
            result: stats.substantive ? 'Task completed' : 'Ralph loop finished — review progress',
          });
          finish();
        })
        .catch((err) => {
          commentTracker.onError(String(err));
          sendTo({ type: 'error', message: String(err) });
          task.status = 'review';
          task.updatedAt = new Date().toISOString();
          saveTask(task, workspacePath);
          broadcast({ type: 'task_update', task });
          fail(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }

    runSimpleTask(useNudgePrompt || pendingFeedback);
  });
}

export function stopTaskRunner(): void {
  stopActive();
  stopRalph();
}
