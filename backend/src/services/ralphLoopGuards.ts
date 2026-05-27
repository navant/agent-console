import { getPrdContent } from './prdStore';
import { getTaskPlan } from './fileStore';
import { hasPendingUserFeedback } from './taskComments';
import { TaskComment, TaskConfig } from '../types';
import { isRalphLoopWorkflowId } from './workflowStore';

/** Strip Q&A block appended by Agent Console — not a substitute for a PRD spec. */
export function prdBodyWithoutUserAnswers(content: string): string {
  return content.replace(/##\s*User answers[\s\S]*$/i, '').trim();
}

/** True when the linked markdown PRD has a real spec, not just title + user answers. */
export function prdLooksSubstantive(workspacePath: string, prdRel: string): boolean {
  try {
    const body = prdBodyWithoutUserAnswers(getPrdContent(workspacePath, prdRel));
    if (body.length < 280) return false;
    const sectionCount = (body.match(/^##\s+/gm) ?? []).length;
    return sectionCount >= 1;
  } catch {
    return false;
  }
}

export function getRalphLoopRunBlockReason(
  task: TaskConfig,
  workspacePath: string,
  comments: TaskComment[],
  options: { nudge?: boolean }
): string | null {
  if (!isRalphLoopWorkflowId(task.workflow ?? '')) return null;

  if (options.nudge || hasPendingUserFeedback(comments)) {
    return (
      'Ralph loop does not run open comments via ▶ Run or Nudge. ' +
      'Use the planning panel: Run PRD skill (after Q&A), then Run ralph skill, then Run loop when prd.json has stories.'
    );
  }

  const plan = getTaskPlan(task.id, workspacePath);
  if (!plan.userStories?.length) {
    return (
      'Ralph loop needs stories in prd.json before Run loop. ' +
      'Run PRD skill → Run ralph skill in the task planning panel.'
    );
  }

  return null;
}
