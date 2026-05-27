import { TaskComment } from '../types';
import { isRalphLoopWorkflow } from './workflowOptions';

export function hasPendingUserFeedback(comments: TaskComment[]): boolean {
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (c.kind === 'activity') continue;
    if (c.author === 'agent') return false;
    if (c.author === 'user') return true;
  }
  return false;
}

export function getRalphRunBlockMessage(
  workflow: string | undefined,
  storyCount: number,
  comments: TaskComment[],
  nudge: boolean
): string | null {
  if (!isRalphLoopWorkflow(workflow)) return null;

  if (nudge || hasPendingUserFeedback(comments)) {
    return (
      'Ralph loop does not use Run/Nudge for open comments.\n\n' +
      'Use the planning panel: Run PRD skill (after Q&A), then Run ralph skill, then Run loop.'
    );
  }

  if (storyCount === 0) {
    return (
      'Ralph loop needs stories in prd.json before Run loop.\n\n' +
      '1. Run PRD skill → 2. Run ralph skill'
    );
  }

  return null;
}
