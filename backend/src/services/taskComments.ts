import fs from 'fs';
import path from 'path';
import { TaskComment, TaskCommentsFile } from '../types';
import { taskDir } from './fileStore';

function commentsPath(workspacePath: string, taskId: string): string {
  return path.join(taskDir(workspacePath, taskId), 'comments.json');
}

function newId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function getTaskComments(workspacePath: string, taskId: string): TaskComment[] {
  const filePath = commentsPath(workspacePath, taskId);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TaskCommentsFile;
    return raw.comments ?? [];
  } catch {
    return [];
  }
}

function saveComments(workspacePath: string, taskId: string, comments: TaskComment[]): void {
  const filePath = commentsPath(workspacePath, taskId);
  fs.writeFileSync(filePath, JSON.stringify({ comments }, null, 2), 'utf-8');
}

export function addTaskComment(
  workspacePath: string,
  taskId: string,
  data: Omit<TaskComment, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): TaskComment {
  const comments = getTaskComments(workspacePath, taskId);
  const comment: TaskComment = {
    id: data.id ?? newId(),
    author: data.author,
    authorName: data.authorName,
    body: data.body,
    kind: data.kind,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
  comments.push(comment);
  saveComments(workspacePath, taskId, comments);
  return comment;
}

export function hasPendingUserFeedback(comments: TaskComment[]): boolean {
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (c.kind === 'activity') continue;
    if (c.author === 'agent') return false;
    if (c.author === 'user') return true;
  }
  return false;
}

export function formatCommentsForPrompt(
  comments: TaskComment[],
  options?: { nudge?: boolean; maxComments?: number }
): string {
  if (comments.length === 0) return '';

  const max = options?.maxComments ?? 30;
  const slice = comments.slice(-max);

  const lines = slice.map(c => {
    const name = c.authorName ?? (c.author === 'user' ? 'User' : c.author === 'agent' ? 'Agent' : 'System');
    if (c.kind === 'activity') return `- [activity · ${name}] ${c.body}`;
    return `- [${name}] ${c.body}`;
  });

  let header = '## Task discussion (comments thread)\n\nReview these comments — especially the latest user messages — and continue the work accordingly.\n\n';
  if (options?.nudge) {
    header = '## Nudge — continue this task\n\nThe user added feedback below. Resume work on this task and address their latest comments.\n\n';
  }

  return header + lines.join('\n\n');
}

function isTrivialAgentResponse(body: string): boolean {
  const t = body.trim().toLowerCase().replace(/[.!?\s]+$/g, '');
  if (!t) return true;
  const phrases = [
    'task completed',
    'task complete',
    'completed',
    'done',
    'awaiting confirmation',
    'finished',
    'all done',
  ];
  return phrases.some(p => t === p || t.startsWith(p + ' ') || t.endsWith(' ' + p));
}

export type CommentBroadcast = (comment: TaskComment) => void;

export interface RunCommentStats {
  substantive: boolean;
  toolUseCount: number;
  durationMs: number;
  textLength: number;
}

/** Tracks a run and persists agent text + tool activity as task comments. */
export function createRunCommentTracker(
  workspacePath: string,
  taskId: string,
  agentName: string,
  onComment?: CommentBroadcast
) {
  let textBuffer = '';
  let toolUseCount = 0;
  const runStartedAt = Date.now();

  const persist = (data: Omit<TaskComment, 'id' | 'createdAt'>) => {
    const comment = addTaskComment(workspacePath, taskId, data);
    onComment?.(comment);
    return comment;
  };

  return {
    onRunStart(nudge?: boolean) {
      persist({
        author: 'system',
        authorName: 'System',
        kind: 'activity',
        body: nudge ? 'Agent nudged to continue' : 'Run started',
      });
    },

    onMessage(msg: { type: string; content?: string; tool?: string; result?: string }) {
      if (msg.type === 'text' && msg.content?.trim()) {
        textBuffer += (textBuffer ? '\n\n' : '') + msg.content.trim();
      } else if (msg.type === 'done' && msg.result?.trim()) {
        const r = msg.result.trim();
        if (!isTrivialAgentResponse(r)) {
          textBuffer += (textBuffer ? '\n\n' : '') + r;
        }
      } else if (msg.type === 'tool_use' && msg.tool) {
        toolUseCount++;
        persist({
          author: 'agent',
          authorName: agentName,
          kind: 'activity',
          body: `Used tool: ${msg.tool}`,
        });
      }
    },

    onDone(result?: string): RunCommentStats {
      const durationMs = Date.now() - runStartedAt;
      let body = result?.trim() || textBuffer.trim();
      if (isTrivialAgentResponse(body)) body = '';

      const substantive = toolUseCount > 0 || (body.length > 80 && !isTrivialAgentResponse(body));

      if (substantive && body) {
        persist({
          author: 'agent',
          authorName: agentName,
          kind: 'comment',
          body,
        });
      } else if (toolUseCount === 0) {
        persist({
          author: 'system',
          authorName: 'System',
          kind: 'activity',
          body:
            durationMs < 8000
              ? 'Agent exited quickly without running tools — session may be stale or Claude CLI needs auth. Try Run (manual) or add a new comment.'
              : 'Agent finished without using tools — no substantive work detected.',
        });
      }
      textBuffer = '';

      return { substantive, toolUseCount, durationMs, textLength: body.length };
    },

    onError(message: string) {
      persist({
        author: 'system',
        authorName: 'System',
        kind: 'activity',
        body: `Run failed: ${message}`,
      });
      textBuffer = '';
    },

    onStopped() {
      if (textBuffer.trim()) {
        persist({
          author: 'agent',
          authorName: agentName,
          kind: 'comment',
          body: textBuffer.trim() + '\n\n_(run stopped)_',
        });
      }
      textBuffer = '';
    },
  };
}
