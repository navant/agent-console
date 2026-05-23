import { Router, Request, Response } from 'express';
import { getConfig, saveConfig, setActiveWorkspace } from '../services/fileStore';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(getConfig());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/workspace', (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.body as { workspaceId?: string };
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const ws = setActiveWorkspace(workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });

    res.json({ activeWorkspace: workspaceId, workspace: ws });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/memory-tier', (req: Request, res: Response) => {
  try {
    const { tier } = req.body as { tier?: 'simple' | 'wiki' | 'claude-mem' };
    if (!tier) return res.status(400).json({ error: 'tier is required' });

    const config = getConfig();
    config.memoryTier = tier;
    saveConfig(config);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
