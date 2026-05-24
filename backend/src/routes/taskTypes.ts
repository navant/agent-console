import { Router, Request, Response } from 'express';
import { getActiveWorkspace } from '../services/fileStore';
import { getTaskTypes, saveTaskTypes } from '../services/taskTypesStore';
import { TaskTypeDef } from '../types';

const router = Router();

function requireWorkspace(res: Response): string | null {
  const ws = getActiveWorkspace();
  if (!ws) {
    res.status(400).json({ error: 'No active workspace' });
    return null;
  }
  return ws.path;
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    res.json({ types: getTaskTypes(wsPath) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const body = req.body as { types?: TaskTypeDef[] };
    if (!Array.isArray(body.types)) {
      return res.status(400).json({ error: 'types array is required' });
    }
    const types = saveTaskTypes(wsPath, body.types);
    res.json({ types });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
