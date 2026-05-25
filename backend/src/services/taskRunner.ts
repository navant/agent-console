import {
  getTask,
  getAgent,
  getAgentSoulPath,
  buildSkillInvocationPrompt,
  ensureSkillToolAllowed,
  appendTaskProgress,
  saveTask,
  listTasks,
} from './fileStore';
import { buildRunPrompt } from './taskPrompt';
import {
  getTaskComments,
  formatCommentsForPrompt,
  createRunCommentTracker,
  hasPendingUserFeedback,
} from './taskComments';
import { runClaude, stopActive, isClaudeRunning } from './claudeRunner';
import { runArchonTask, stopArchonRunner, isArchonRunnerBusy } from './archonRunner';
import { runSlashCommand, isSlashRunning } from './ptyRunner';
import { buildGoalSlashCommand } from './goalsStore';
import { isArchonWorkflowId, isRalphLoopWorkflowId, SINGLE_SHOT_WORKFLOW_ID } from './workflowStore';
import { runRalphLoop, isRalphRunning, stopRalphRunner } from './ralphRunner';
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
  return isClaudeRunning() || isSlashRunning() || isArchonRunnerBusy() || isRalphRunning();
}

function isGoalTask(task: TaskConfig): boolean {
  return task.taskType === 'goals' || !!task.goal;
}

/** Auto-queue only runs `planned` tasks — not fresh `todo` (avoids running on create). */
export function findNextTodoTask(workspacePath: string): TaskConfig | null {
  const todos = listTasks(workspacePath).filter(t => t.status === 'planned');
  return (
    todos.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0] ?? null
  );
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
    const workflowId = task.workflow?.trim() || SINGLE_SHOT_WORKFLOW_ID;
    const useArchon = isArchonWorkflowId(workflowId) && !useNudgePrompt && !isGoalTask(task);
    const useRalph =
      isRalphLoopWorkflowId(workflowId) && !useNudgePrompt && !isGoalTask(task) && !useArchon;

    const commentTracker = createRunCommentTracker(
      workspacePath,
      task.id,
      agentName,
      c => broadcast({ type: 'comment_append', taskId: task.id, comment: c })
    );
    commentTracker.onRunStart(nudge || pendingFeedback);

    task.status = 'running';
    task.updatedAt = new Date().toISOString();
    saveTask(task, workspacePath);
    broadcast({ type: 'task_update', task });

    const finish = () => resolve();
    const fail = (err: Error) => reject(err);

    const runGoalSlashTask = () => {
      if (!task.goal) {
        sendTo({ type: 'error', message: 'Goals task has no linked goal file' });
        task.status = 'todo';
        task.updatedAt = new Date().toISOString();
        saveTask(task, workspacePath);
        broadcast({ type: 'task_update', task });
        fail(new Error('No goal linked'));
        return;
      }

      const command = buildGoalSlashCommand(task.goal);
      const startedAt = Date.now();
      appendTaskProgress(
        task.id,
        workspacePath,
        `[${new Date().toISOString()}] Slash command: ${command}\n`,
        line => broadcast({ type: 'progress_append', taskId: task.id, line })
      );

      runSlashCommand({
        command,
        sessionId: task.session_id,
        workspacePath,
        onOutput: text => sendTo({ type: 'text', content: text }),
        onDone: () => {
          commentTracker.onDone();
          task.status = pendingFeedback || nudge ? 'todo' : 'review';
          task.updatedAt = new Date().toISOString();
          saveTask(task, workspacePath);
          appendTaskProgress(
            task.id,
            workspacePath,
            `[${new Date().toISOString()}] Goal slash finished — ${task.status} (${Date.now() - startedAt}ms)\n`,
            line => broadcast({ type: 'progress_append', taskId: task.id, line })
          );
          sendTo({
            type: 'done',
            result:
              task.status === 'todo'
                ? 'Returned to todo — review comments'
                : 'Moved to review — goal command finished',
          });
          broadcast({ type: 'task_update', task });
          finish();
        },
        onError: err => {
          commentTracker.onError(err);
          sendTo({ type: 'error', message: err });
          task.status = 'review';
          task.updatedAt = new Date().toISOString();
          saveTask(task, workspacePath);
          broadcast({ type: 'task_update', task });
          fail(new Error(err));
        },
      });
    };

    const runRalph = () => {
      const startedAt = Date.now();
      appendTaskProgress(
        task.id,
        workspacePath,
        `[${new Date().toISOString()}] Ralph loop: ${workflowId}\n`,
        line => broadcast({ type: 'progress_append', taskId: task.id, line })
      );

      runRalphLoop(task.id, workspacePath, {
        onMessage: m => {
          commentTracker.onMessage(m);
          sendTo(m);
          if (m.type === 'session_start') {
            task.session_id = m.sessionId;
            task.updatedAt = new Date().toISOString();
            saveTask(task, workspacePath);
          }
        },
        onProgress: line => broadcast({ type: 'progress_append', taskId: task.id, line }),
        onStoryComplete: () => broadcast({ type: 'task_update', task }),
        onTaskUpdate: t => broadcast({ type: 'task_update', task: t }),
      })
        .then(() => {
          commentTracker.onDone();
          appendTaskProgress(
            task.id,
            workspacePath,
            `[${new Date().toISOString()}] Ralph loop finished (${Date.now() - startedAt}ms)\n`,
            line => broadcast({ type: 'progress_append', taskId: task.id, line })
          );
          sendTo({ type: 'done', result: 'Ralph loop finished — moved to review' });
          finish();
        })
        .catch(err => {
          commentTracker.onError(String(err));
          sendTo({ type: 'error', message: String(err) });
          fail(err instanceof Error ? err : new Error(String(err)));
        });
    };

    const runArchon = () => {
      const message = buildRunPrompt(taskId, workspacePath, task, { nudge: false });
      const startedAt = Date.now();
      appendTaskProgress(
        task.id,
        workspacePath,
        `[${new Date().toISOString()}] Archon workflow: ${workflowId}\n`,
        line => broadcast({ type: 'progress_append', taskId: task.id, line })
      );

      runArchonTask({
        taskId: task.id,
        workspacePath,
        workflowId,
        message,
        onOutput: text => sendTo({ type: 'text', content: text }),
        onDone: () => {
          commentTracker.onDone();
          task.status = 'review';
          task.updatedAt = new Date().toISOString();
          saveTask(task, workspacePath);
          appendTaskProgress(
            task.id,
            workspacePath,
            `[${new Date().toISOString()}] Archon finished (${Date.now() - startedAt}ms)\n`,
            line => broadcast({ type: 'progress_append', taskId: task.id, line })
          );
          sendTo({ type: 'done', result: 'Archon workflow finished — moved to review' });
          broadcast({ type: 'task_update', task });
          finish();
        },
        onError: err => {
          commentTracker.onError(err);
          sendTo({ type: 'error', message: err });
          task.status = 'review';
          task.updatedAt = new Date().toISOString();
          saveTask(task, workspacePath);
          broadcast({ type: 'task_update', task });
          fail(new Error(err));
        },
      });
    };

    const runSimpleTask = (freshSession: boolean) => {
      const prompt = buildRunPrompt(taskId, workspacePath, task, { nudge: useNudgePrompt });
      const sessionId = freshSession ? undefined : task.session_id;

      runClaude({
        taskId: task.id,
        prompt,
        agentId: agent?.id ?? '',
        model: agent?.model ?? '',
        soulPath,
        workspacePath,
        tools:
          task.skills.length > 0
            ? ensureSkillToolAllowed(agent?.tools ?? [])
            : agent?.tools ?? [],
        sessionId,
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
            `[${new Date().toISOString()}] Run finished — ${task.status} (tools: ${stats.toolUseCount}, ${stats.durationMs}ms)\n`,
            line => broadcast({ type: 'progress_append', taskId: task.id, line })
          );
          sendTo({
            type: 'done',
            result:
              !stats.substantive && stats.toolUseCount === 0
                ? 'No agent output — returned to todo'
                : task.status === 'todo'
                  ? 'Returned to todo — review comments'
                  : 'Moved to review',
          });
          broadcast({ type: 'task_update', task });
          finish();
        },
        onError: err => {
          commentTracker.onError(err);
          sendTo({ type: 'error', message: err });
          task.status = 'review';
          task.updatedAt = new Date().toISOString();
          saveTask(task, workspacePath);
          broadcast({ type: 'task_update', task });
          fail(new Error(err));
        },
      });
    };

    if (isGoalTask(task) && task.goal && !useNudgePrompt) {
      runGoalSlashTask();
      return;
    }

    if (useArchon) {
      runArchon();
      return;
    }

    if (useRalph) {
      runRalph();
      return;
    }

    runSimpleTask(useNudgePrompt || pendingFeedback);
  });
}

export function stopTaskRunner(): void {
  stopActive();
  stopArchonRunner();
  stopRalphRunner();
}
