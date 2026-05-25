/**
 * Memory (CodeGraph, claude-mem, agent memory) is tool/MCP-only — never inlined in run prompts.
 */

/** Remove memory placeholders and inlined memory sections from a composed prompt. */
export function stripMemoryFromPrompt(text: string): string {
  let t = text.replace(/\{\{memory\}\}/g, '');

  t = t.replace(
    /\n*(?:Memory|Workspace memory):\s*\n[\s\S]*?(?=\n(?:## |# Task |---\s*\n|You are working on story ))/gi,
    '\n'
  );
  t = t.replace(
    /\n+## (?:Memory|CodeGraph summary|Session memory[^\n]*)\s*\n[\s\S]*?(?=\n## |\n---|\n# Task |$)/gi,
    '\n'
  );
  t = t.replace(/\n*Memory:\s*\n*/gi, '\n');
  t = t.replace(/\n*Workspace memory:\s*\n*/gi, '\n');

  return t.replace(/\n{3,}/g, '\n\n').trim();
}
