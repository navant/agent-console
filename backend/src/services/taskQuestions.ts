import { AgentQuestion, AgentQuestionOption, TaskComment } from '../types';
import { getPrdContent, savePrdContent } from './prdStore';

export function parseAskUserQuestions(tool: string, input: unknown): AgentQuestion[] | null {
  const toolName = tool.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (
    !toolName.includes('askuser') &&
    toolName !== 'askuserquestion' &&
    toolName !== 'ask_user_question'
  ) {
    return null;
  }

  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input) as unknown;
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;

  const list = (raw as { questions?: unknown[] }).questions;
  if (!Array.isArray(list) || list.length === 0) return null;

  const out: AgentQuestion[] = [];
  for (let i = 0; i < list.length; i++) {
    const q = list[i];
    if (!q || typeof q !== 'object') continue;
    const rec = q as Record<string, unknown>;
    const question = String(rec.question ?? rec.prompt ?? '').trim();
    if (!question) continue;

    const optionsRaw = rec.options;
    let options: AgentQuestionOption[] | undefined;
    if (Array.isArray(optionsRaw)) {
      options = [];
      for (const o of optionsRaw) {
        if (!o || typeof o !== 'object') continue;
        const opt = o as Record<string, unknown>;
        const label = String(opt.label ?? opt.value ?? '').trim();
        if (!label) continue;
        options.push({
          label,
          ...(opt.description ? { description: String(opt.description) } : {}),
        });
      }
      if (options.length === 0) options = undefined;
    }

    out.push({
      id: `q-${i + 1}`,
      question,
      header: rec.header ? String(rec.header) : undefined,
      multiSelect: !!rec.multiSelect,
      options: options?.length ? options : undefined,
    });
  }

  return out.length > 0 ? out : null;
}

/** Dedupe repeated paragraphs (agent often repeats the same question block). */
export function dedupeAgentText(body: string): string {
  const parts = body.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const key = p.replace(/\s+/g, ' ').toLowerCase().slice(0, 280);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique.join('\n\n');
}

/**
 * When the agent types numbered questions instead of using AskUserQuestion,
 * e.g. `1. **What is X?** — option a, option b…`
 */
export function parseQuestionsFromAgentText(body: string): AgentQuestion[] | null {
  const text = dedupeAgentText(body.trim());
  if (!text) return null;

  const chunks = text
    .split(/(?=\d+[.)]\s*\*\*)/)
    .map(s => s.trim())
    .filter(s => /^\d+[.)]\s*\*\*/.test(s));

  if (chunks.length < 2) return null;

  const out: AgentQuestion[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].replace(/^\d+[.)]\s*/, '');
    const bold = chunk.match(/\*\*([^*]+)\*\*/);
    if (!bold) continue;

    const title = bold[1].trim();
    const boldAt = bold.index ?? 0;
    let rest = chunk.slice(boldAt + bold[0].length).replace(/^[\s:—–\-]+/, '').trim();
    const question = title.endsWith('?') ? title : `${title}?`;
    const options = parseInlineOptions(rest);

    out.push({
      id: `q-${i + 1}`,
      question: rest ? `${question} ${rest}` : question,
      header: title.length <= 80 ? title.replace(/\?+$/, '') : undefined,
      multiSelect: false,
      options: options.length >= 2 ? options : undefined,
    });
  }
  return out.length >= 2 ? out : null;
}

function parseInlineOptions(rest: string): AgentQuestionOption[] {
  if (!rest) return [];
  const opts: AgentQuestionOption[] = [];

  const orParts = rest.split(/\s*,\s+or\s+/i);
  if (orParts.length >= 2) {
    const first = orParts[0].trim().replace(/\.$/, '');
    if (first.length > 2) opts.push({ label: first });
    for (let i = 1; i < orParts.length; i++) {
      const label = orParts[i].trim().replace(/\.$/, '');
      if (label.length > 2) opts.push({ label });
    }
  }

  if (opts.length < 2) {
    const commaParts = rest.split(/\s*,\s+/);
    if (commaParts.length >= 3) {
      for (const p of commaParts) {
        const label = p.trim().replace(/\.$/, '');
        if (label.length > 2 && label.length < 220) opts.push({ label });
      }
    }
  }
  return opts.slice(0, 8);
}

export function findPendingQuestionsComment(comments: TaskComment[]): TaskComment | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (c.kind === 'questions' && c.questions?.length && !c.answeredAt) {
      return c;
    }
  }
  return null;
}

export type QuestionAnswers = Record<string, string | string[]>;

export function formatAnswersBody(questions: AgentQuestion[], answers: QuestionAnswers): string {
  const lines: string[] = ['## Your answers\n'];
  for (const q of questions) {
    const raw = answers[q.id];
    const header = q.header?.trim();
    if (header) lines.push(`### ${header}`);
    lines.push(`**${q.question}**`);
    if (Array.isArray(raw)) {
      for (const a of raw) lines.push(`- ${a}`);
    } else if (raw?.trim()) {
      lines.push(raw.trim());
    } else {
      lines.push('_(no answer)_');
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function formatAnswersForPrd(questions: AgentQuestion[], answers: QuestionAnswers): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    '',
    '---',
    '',
    `## User answers`,
    '',
    `_Recorded from Agent Console on ${stamp}_`,
    '',
  ];

  for (const q of questions) {
    const raw = answers[q.id];
    if (q.header?.trim()) lines.push(`### ${q.header.trim()}`);
    lines.push(`**${q.question}**`);
    lines.push('');
    if (Array.isArray(raw)) {
      for (const a of raw) lines.push(`- ${a}`);
    } else if (raw?.trim()) {
      lines.push(raw.trim());
    } else {
      lines.push('_No answer provided._');
    }
    lines.push('');
  }

  return lines.join('\n');
}

const USER_ANSWERS_HEADING = '## User answers';

export function appendAnswersToPrd(
  workspacePath: string,
  prdRelPath: string,
  questions: AgentQuestion[],
  answers: QuestionAnswers
): string {
  let content = getPrdContent(workspacePath, prdRelPath);
  const block = formatAnswersForPrd(questions, answers).trim();

  const idx = content.indexOf(USER_ANSWERS_HEADING);
  if (idx >= 0) {
    const before = content.slice(0, idx).trimEnd();
    const afterHeading = content.slice(idx + USER_ANSWERS_HEADING.length);
    const nextSection = afterHeading.search(/\n## /);
    const tail = nextSection >= 0 ? afterHeading.slice(nextSection) : '';
    content = `${before}\n\n${block}${tail ? `\n${tail.trimStart()}` : ''}`;
  } else {
    content = `${content.trimEnd()}\n\n${block}\n`;
  }

  savePrdContent(workspacePath, prdRelPath, content);
  return content;
}
