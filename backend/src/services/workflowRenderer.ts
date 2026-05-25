import { TaskConfig, UserStory } from '../types';

export function renderWorkflowTemplate(
  template: string,
  ctx: {
    task?: TaskConfig;
    story?: UserStory;
    memory?: string;
    prompt?: string;
    prdExcerpt?: string;
    storyDescription?: string;
    tracking?: string;
    planSummary?: string;
  }
): string {
  let result = template;

  if (ctx.memory !== undefined) {
    result = result.replace(/\{\{memory\}\}/g, ctx.memory);
  }
  if (ctx.prompt !== undefined) {
    result = result.replace(/\{\{prompt\}\}/g, ctx.prompt);
  }
  if (ctx.prdExcerpt !== undefined) {
    result = result.replace(/\{\{prdExcerpt\}\}/g, ctx.prdExcerpt);
  }
  if (ctx.storyDescription !== undefined) {
    result = result.replace(/\{\{storyDescription\}\}/g, ctx.storyDescription);
  }
  if (ctx.tracking !== undefined) {
    result = result.replace(/\{\{tracking\}\}/g, ctx.tracking);
  }
  if (ctx.planSummary !== undefined) {
    result = result.replace(/\{\{planSummary\}\}/g, ctx.planSummary);
  }

  const task = ctx.task;
  if (task) {
    result = result.replace(/\{\{task\.id\}\}/g, task.id);
    result = result.replace(/\{\{task\.title\}\}/g, task.title);
    result = result.replace(/\{\{task\.prd\}\}/g, task.prd ?? '');
    result = result.replace(/\{\{task\.storyId\}\}/g, task.storyId ?? '');
    result = result.replace(/\{\{task\.status\}\}/g, task.status);
    result = result.replace(/\{\{task\.workflow\}\}/g, task.workflow);
    result = result.replace(/\{\{task\.storyPriority\}\}/g, String(task.storyPriority ?? ''));
  }

  const story = ctx.story;
  if (story) {
    result = result.replace(/\{\{story\.id\}\}/g, story.id);
    result = result.replace(/\{\{story\.title\}\}/g, story.title);
    result = result.replace(/\{\{story\.description\}\}/g, story.description);

    const criteriaBlock = story.acceptanceCriteria.map(c => `- ${c}`).join('\n');
    const eachPattern = /\{\{#each story\.acceptanceCriteria\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachPattern, (_match, inner: string) => {
      return story.acceptanceCriteria
        .map(c => inner.replace(/\{\{this\}\}/g, c))
        .join('\n');
    });
    result = result.replace(/\{\{story\.acceptanceCriteria\}\}/g, criteriaBlock);
    result = result.replace(/\{\{story\.passes\}\}/g, story.passes ? 'true' : 'false');
    result = result.replace(/\{\{story\.taskId\}\}/g, story.taskId ?? '');
  }

  return result.trim();
}
