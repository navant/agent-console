import { Router, Request, Response } from 'express';
import { listSkills, getActiveWorkspace } from '../services/fileStore';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    res.json(listSkills(ws?.path));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
