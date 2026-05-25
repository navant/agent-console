import { getPrdContent } from './prdStore';
import { buildSkillInvocationPrompt, getTaskPrompt } from './fileStore';
import { formatCommentsForPrompt, getTaskComments } from './taskComments';
import { stripMemoryFromPrompt } from './promptSanitize';
import { renderWorkflowTemplate } from './workflowRenderer';
import { resolveWorkflow, SINGLE_SHOT_WORKFLOW_ID } from './workflowStore';
import { TaskConfig } from '../types';

const PRD_EXCERPT_MAX = 8000;

export function buildRunPrompt(
  taskId: string,
  workspacePath: string,
  task: TaskConfig,
  options?: { nudge?: boolean }
): string {
  const comments = getTaskComments(workspacePath, taskId);

  if (options?.nudge) {
    return buildNudgePrompt(taskId, workspacePath, task, comments);
  }

  const skills = buildSkillInvocationPrompt(task.skills, workspacePath);
  const taskPrompt = (getTaskPrompt(taskId, workspacePath) || task.title).trim();

  let prdBlock = '';
  if (task.prd) {
    try {
      const full = getPrdContent(workspacePath, task.prd);
      const excerpt =
        full.length > PRD_EXCERPT_MAX ? `${full.slice(0, PRD_EXCERPT_MAX)}\n\n…` : full;
      prdBlock = `## PRD (${task.prd})\n\n${excerpt}`;
    } catch {
      prdBlock = '';
    }
  }

  const core = [`# Task ${task.id}: ${task.title}`, prdBlock, taskPrompt].filter(Boolean).join('\n\n');

  const wfId = task.workflow?.trim() || SINGLE_SHOT_WORKFLOW_ID;
  const workflow = resolveWorkflow(wfId, workspacePath);
  const template = workflow?.template?.trim();

  let body = core;
  if (template) {
    if (template.includes('{{prompt}}')) {
      body = renderWorkflowTemplate(template, {
        task,
        memory: '',
        prompt: core,
        prdExcerpt: prdBlock,
      });
    } else {
      body = renderWorkflowTemplate(template, {
        task,
        memory: '',
        prdExcerpt: prdBlock,
        storyDescription: taskPrompt,
      });
    }
  }

  body = stripMemoryFromPrompt(body);

  const commentBlock = formatCommentsForPrompt(comments, { nudge: false });
  const parts: string[] = [];
  if (skills) parts.push(skills);
  parts.push(body);
  if (commentBlock) {
    parts.push(
      commentBlock +
        '\n\nAddress open user comments. Do not mark done while feedback is unanswered.'
    );
  }
  return parts.join('\n\n---\n\n');
}

function buildNudgePrompt(
  taskId: string,
  workspacePath: string,
  task: TaskConfig,
  comments: ReturnType<typeof getTaskComments>
): string {
  const skills = buildSkillInvocationPrompt(task.skills, workspacePath);
  const thread = formatCommentsForPrompt(comments, { nudge: true });
  const skillsBlock = skills ? `${skills}\n\n---\n\n` : '';
  return `${skillsBlock}# Task: ${task.title} (${taskId})

Continue work — address all user comments.

${thread}`;
}
