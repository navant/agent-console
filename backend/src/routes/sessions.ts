import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

const router = Router();
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionInfo {
  sessionId: string;
  project: string;
  projectPath: string;
  aiTitle: string;
  firstMessage: string;
  timestamp: string;
  messageCount: number;
}

export interface HistoryMessage {
  type: 'user' | 'text' | 'tool_use' | 'tool_result' | 'system';
  text?: string;
  tool?: string;
  input?: unknown;
  timestamp?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodePath(encoded: string): string {
  return '/' + encoded.slice(1).replace(/-/g, '/');
}

function findSessionFile(sessionId: string): string | null {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return null;
  const dirs = fs.readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(CLAUDE_PROJECTS_DIR, d.name));
  for (const dir of dirs) {
    const candidate = path.join(dir, `${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

type JsonLine = Record<string, unknown>;

async function readLines(filePath: string): Promise<JsonLine[]> {
  const lines: JsonLine[] = [];
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { lines.push(JSON.parse(line) as JsonLine); } catch {}
  }
  return lines;
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return (content as JsonLine[])
      .filter(c => c.type === 'text')
      .map(c => c.text as string)
      .join('');
  }
  return '';
}

// ── Parse session list entry ──────────────────────────────────────────────────

async function parseSessionMeta(filePath: string): Promise<SessionInfo | null> {
  const sessionId  = path.basename(filePath, '.jsonl');
  const projectDir = path.basename(path.dirname(filePath));

  let firstMessage = '';
  let timestamp    = '';
  let aiTitle      = '';
  let messageCount = 0;

  try {
    const lines = await readLines(filePath);
    for (const obj of lines) {
      if (obj.type === 'ai-title') { aiTitle = (obj.aiTitle as string) || ''; continue; }
      if (obj.type === 'queue-operation') continue;

      const msg = obj.message as JsonLine | undefined;
      if (obj.type === 'user' && msg?.role === 'user') {
        // skip tool-result-only messages
        const content = msg.content;
        const isToolResult = Array.isArray(content) &&
          (content as JsonLine[]).every(c => c.type === 'tool_result');
        if (!isToolResult) {
          messageCount++;
          if (!firstMessage) {
            timestamp    = (obj.timestamp as string) || '';
            firstMessage = extractText(content).slice(0, 120);
          }
        }
      } else if (msg?.role === 'assistant') {
        messageCount++;
      }
    }
  } catch { return null; }

  if (!timestamp) return null;

  return {
    sessionId,
    project:      projectDir,
    projectPath:  decodePath(projectDir),
    aiTitle:      aiTitle || firstMessage.slice(0, 80),
    firstMessage: firstMessage || '(empty)',
    timestamp,
    messageCount,
  };
}

// ── Parse full message history ────────────────────────────────────────────────

async function parseSessionMessages(filePath: string): Promise<HistoryMessage[]> {
  const lines = await readLines(filePath);
  const out: HistoryMessage[] = [];

  for (const obj of lines) {
    if (obj.type === 'queue-operation') continue;
    if (obj.type === 'ai-title') {
      out.push({ type: 'system', text: `Session: ${obj.aiTitle as string}` });
      continue;
    }

    const msg = obj.message as JsonLine | undefined;

    // User turn
    if (obj.type === 'user' && msg?.role === 'user') {
      const content = msg.content;
      if (Array.isArray(content)) {
        for (const block of content as JsonLine[]) {
          if (block.type === 'tool_result') {
            const raw = block.content;
            out.push({ type: 'tool_result', text: extractText(raw), timestamp: obj.timestamp as string });
          } else if (block.type === 'text' && block.text) {
            out.push({ type: 'user', text: block.text as string, timestamp: obj.timestamp as string });
          }
        }
      } else if (typeof content === 'string' && content) {
        out.push({ type: 'user', text: content, timestamp: obj.timestamp as string });
      }
      continue;
    }

    // Assistant turn
    if (msg?.role === 'assistant') {
      const content = msg.content as JsonLine[] | undefined;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type === 'thinking') continue; // skip thinking blocks
        if (block.type === 'text' && block.text) {
          out.push({ type: 'text', text: block.text as string });
        } else if (block.type === 'tool_use') {
          out.push({ type: 'tool_use', tool: block.name as string, input: block.input });
        }
      }
    }
  }

  return out;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/sessions
router.get('/', async (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return res.json([]);

    const dirs = fs.readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(CLAUDE_PROJECTS_DIR, d.name));

    const files: string[] = [];
    for (const dir of dirs) {
      fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .forEach(f => files.push(path.join(dir, f)));
    }

    const results = await Promise.all(files.map(parseSessionMeta));
    const sessions = (results.filter(Boolean) as SessionInfo[])
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/sessions/:sessionId/messages
router.get('/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const filePath = findSessionFile(sessionId);
    if (!filePath) return res.status(404).json({ error: 'Session not found' });
    const messages = await parseSessionMessages(filePath);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/sessions/:sessionId
router.delete('/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const filePath = findSessionFile(sessionId);
    if (!filePath) return res.status(404).json({ error: 'Session not found' });
    fs.unlinkSync(filePath);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
