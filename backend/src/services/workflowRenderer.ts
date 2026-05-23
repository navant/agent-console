import { UserStory } from '../types';

export function renderWorkflowTemplate(
  template: string,
  ctx: {
    story?: UserStory;
    memory?: string;
    prompt?: string;
  }
): string {
  let result = template;

  if (ctx.memory) {
    result = result.replace(/\{\{memory\}\}/g, ctx.memory);
  }
  if (ctx.prompt) {
    result = result.replace(/\{\{prompt\}\}/g, ctx.prompt);
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

    // Fallback if template uses literal list without each
    if (!eachPattern.test(template) && criteriaBlock) {
      result = result.replace(/\{\{story\.acceptanceCriteria\}\}/g, criteriaBlock);
    }
  }

  return result.trim();
}
