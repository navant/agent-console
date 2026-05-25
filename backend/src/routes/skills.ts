import { Router, Request, Response } from 'express';
import {
  listSkills,
  getActiveWorkspace,
  getSkillFileContent,
  saveSkillFileContent,
  createSkillFolder,
} from '../services/fileStore';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    res.json(listSkills(ws?.path));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/file', (req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    const source = (req.query.source as string) === 'global' ? 'global' : 'workspace';
    const content = getSkillFileContent(req.params.id, source, ws?.path);
    res.json({
      id: req.params.id,
      source,
      path: `${req.params.id}/SKILL.md`,
      content,
    });
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

router.put('/:id/file', (req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    if (!ws) return res.status(400).json({ error: 'No active workspace' });

    const { content } = req.body as { content?: string };
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    saveSkillFileContent(req.params.id, ws.path, content);
    res.json({
      id: req.params.id,
      source: 'workspace',
      path: `${req.params.id}/SKILL.md`,
      content,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    if (!ws) return res.status(400).json({ error: 'No active workspace' });

    const { id, content } = req.body as { id?: string; content?: string };
    if (!id?.trim()) return res.status(400).json({ error: 'id is required' });

    const skillId = id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    createSkillFolder(ws.path, skillId, content);
    res.status(201).json({
      id: skillId,
      source: 'workspace',
      path: `${skillId}/SKILL.md`,
      content: getSkillFileContent(skillId, 'workspace', ws.path),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
