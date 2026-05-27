import fs from 'fs';
import path from 'path';
import { TaskComment, TaskCommentsFile } from '../types';
import { taskDir } from './fileStore';
import { parseAskUserQuestions, parseQuestionsFromAgentText } from './taskQuestions';

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
    questions: data.questions,
    answeredAt: data.answeredAt,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
  comments.push(comment);
  saveComments(workspacePath, taskId, comments);
  return comment;
}

export function updateTaskComment(
  workspacePath: string,
  taskId: string,
  commentId: string,
  patch: Partial<Pick<TaskComment, 'body' | 'answeredAt' | 'questions'>>
): TaskComment | null {
  const comments = getTaskComments(workspacePath, taskId);
  const idx = comments.findIndex(c => c.id === commentId);
  if (idx < 0) return null;
  comments[idx] = { ...comments[idx], ...patch };
  saveComments(workspacePath, taskId, comments);
  return comments[idx];
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

function commentsForPrompt(comments: TaskComment[]): TaskComment[] {
  const dialogue = comments.filter(c => c.kind === 'comment');
  const activity = comments.filter(c => c.kind === 'activity' || c.kind === 'questions');

  const runNoise = /^Run (started|failed)/i;
  const toolExitNoise =
    /Agent (exited quickly|finished without using tools)/i;
  const usefulActivity = activity.filter(
    c => !runNoise.test(c.body) && !toolExitNoise.test(c.body)
  );
  const lastRunNote = activity.filter(c => runNoise.test(c.body)).slice(-1);

  const merged = [...dialogue, ...usefulActivity, ...lastRunNote];
  merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return merged.slice(-12);
}

export function formatCommentsForPrompt(
  comments: TaskComment[],
  options?: { nudge?: boolean; maxComments?: number }
): string {
  if (comments.length === 0) return '';

  const slice = commentsForPrompt(comments).slice(-(options?.maxComments ?? 12));

  const lines = slice.map(c => {
    const name = c.authorName ?? (c.author === 'user' ? 'User' : c.author === 'agent' ? 'Agent' : 'System');
    if (c.kind === 'questions') {
      return `- [questions · ${name}] ${c.answeredAt ? 'Answered' : 'Awaiting answers'}: ${c.body}`;
    }
    if (c.kind === 'activity') return `- [activity · ${name}] ${c.body}`;
    const body = c.body.length > 2000 ? `${c.body.slice(0, 2000)}…` : c.body;
    return `- [${name}] ${body}`;
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
    'no response requested',
  ];
  return phrases.some(p => t === p || t.startsWith(p + ' ') || t.endsWith(' ' + p));
}

/** True when the agent produced a real reply (tools or non-empty text). */
export function runHadSubstantiveOutput(toolUseCount: number, agentText: string): boolean {
  const body = agentText.trim();
  if (toolUseCount > 0) return true;
  return body.length > 0 && !isTrivialAgentResponse(body);
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
  let pendingQuestionsPosted = false;
  const runStartedAt = Date.now();

  const persist = (data: Omit<TaskComment, 'id' | 'createdAt'>) => {
    const comment = addTaskComment(workspacePath, taskId, data);
    onComment?.(comment);
    return comment;
  };

  return {
    onRunStart(_nudge?: boolean) {
      // Omit "Run started" — it flooded the prompt when auto-queue retried failed tasks.
    },

    onMessage(msg: {
      type: string;
      content?: string;
      tool?: string;
      input?: unknown;
      result?: string;
    }) {
      if (msg.type === 'text' && msg.content?.trim()) {
        textBuffer += (textBuffer ? '\n\n' : '') + msg.content.trim();
      } else if (msg.type === 'done' && msg.result?.trim()) {
        const r = msg.result.trim();
        if (!isTrivialAgentResponse(r)) {
          textBuffer += (textBuffer ? '\n\n' : '') + r;
        }
      } else if (msg.type === 'tool_use' && msg.tool) {
        toolUseCount++;
        const parsed = parseAskUserQuestions(msg.tool, msg.input);
        if (parsed?.length) {
          pendingQuestionsPosted = true;
          persist({
            author: 'agent',
            authorName: agentName,
            kind: 'questions',
            body: 'Agent asked clarifying questions — answer below (saved to linked PRD when you submit).',
            questions: parsed,
          });
        }
      }
    },

    onDone(result?: string): RunCommentStats {
      const durationMs = Date.now() - runStartedAt;
      let body = result?.trim() || textBuffer.trim();
      if (isTrivialAgentResponse(body)) body = '';

      const substantive = runHadSubstantiveOutput(toolUseCount, body);
      const emptyRun = toolUseCount === 0 && body.length === 0;

      if (!pendingQuestionsPosted && body) {
        const fromText = parseQuestionsFromAgentText(body);
        if (fromText?.length) {
          pendingQuestionsPosted = true;
          persist({
            author: 'agent',
            authorName: agentName,
            kind: 'questions',
            body: 'Agent asked clarifying questions — answer in Questions & answers (linked PRD when you submit).',
            questions: fromText,
          });
          persist({
            author: 'system',
            authorName: 'System',
            kind: 'activity',
            body: 'Exploration notes are omitted here — use Questions & answers below.',
          });
          textBuffer = '';
          return {
            substantive: true,
            toolUseCount,
            durationMs,
            textLength: 0,
          };
        }
      }

      if (pendingQuestionsPosted && !body) {
        persist({
          author: 'system',
          authorName: 'System',
          kind: 'activity',
          body: 'Waiting for your answers in Questions & answers.',
        });
      } else if (substantive && body && !pendingQuestionsPosted) {
        persist({
          author: 'agent',
          authorName: agentName,
          kind: 'comment',
          body,
        });
      } else if (emptyRun && !pendingQuestionsPosted) {
        persist({
          author: 'system',
          authorName: 'System',
          kind: 'activity',
          body:
            durationMs < 8000
              ? 'Agent exited quickly without output — session may be stale or Claude CLI needs auth. Try Run again.'
              : 'Agent finished without output or tools.',
        });
      }
      textBuffer = '';

      return { substantive, toolUseCount, durationMs, textLength: body.length };
    },

    onError(message: string) {
      const comments = getTaskComments(workspacePath, taskId);
      const last = comments[comments.length - 1];
      const same =
        last?.kind === 'activity' && last.body === `Run failed: ${message}`;
      if (!same) {
        persist({
          author: 'system',
          authorName: 'System',
          kind: 'activity',
          body: `Run failed: ${message}`,
        });
      }
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
