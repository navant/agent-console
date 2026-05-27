import { AgentQuestion, TaskComment } from '../types';

export function findPendingQuestionsComment(comments: TaskComment[]): TaskComment | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (c.kind === 'questions' && c.questions?.length && !c.answeredAt) {
      return c;
    }
  }
  return null;
}

export function emptyAnswersFor(questions: AgentQuestion[]): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const q of questions) {
    out[q.id] = q.multiSelect ? [] : '';
  }
  return out;
}
