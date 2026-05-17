import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { CLAUDE_AGENTS_DIR } from '../config';
import { SkillConfig } from '../types';

const router = Router();

// GET /api/skills — read-only from ~/.claude/agents/
router.get('/', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(CLAUDE_AGENTS_DIR)) {
      return res.json([]);
    }

    const entries = fs.readdirSync(CLAUDE_AGENTS_DIR, { withFileTypes: true });
    const skills: SkillConfig[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const id = entry.name.replace('.md', '');
        const filePath = path.join(CLAUDE_AGENTS_DIR, entry.name);
        const content = fs.readFileSync(filePath, 'utf-8');
        skills.push({ id, name: id, content });
      } else if (entry.isDirectory()) {
        // Check for skill.md inside directory
        const skillMd = path.join(CLAUDE_AGENTS_DIR, entry.name, 'skill.md');
        const configMd = path.join(CLAUDE_AGENTS_DIR, entry.name, entry.name + '.md');
        let content = '';
        if (fs.existsSync(skillMd)) {
          content = fs.readFileSync(skillMd, 'utf-8');
        } else if (fs.existsSync(configMd)) {
          content = fs.readFileSync(configMd, 'utf-8');
        }
        skills.push({ id: entry.name, name: entry.name, content });
      }
    }

    res.json(skills);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
