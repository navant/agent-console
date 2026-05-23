import { Router, Request, Response } from 'express';
import {
  getActiveWorkspace,
  getMemoryState,
  saveWorkspaceMemory,
  saveAgentMemory,
  getConfig,
  saveConfig,
  listMemoryFiles,
  readMemoryFile,
  writeMemoryFile,
} from '../services/fileStore';

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
    res.json(getMemoryState(wsPath));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/files', (_req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    res.json({ files: listMemoryFiles(wsPath) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/file', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const filePath = req.query.path as string;
    const agentId = req.query.agentId as string | undefined;
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    res.json({
      path: filePath,
      content: readMemoryFile(wsPath, filePath, agentId),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/file', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const { path: filePath, content, agentId } = req.body as {
      path?: string;
      content?: string;
      agentId?: string;
    };
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'path and content are required' });
    }

    writeMemoryFile(wsPath, filePath, content, agentId);
    res.json(getMemoryState(wsPath));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/workspace', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const { content } = req.body as { content?: string };
    if (content === undefined) return res.status(400).json({ error: 'content is required' });

    saveWorkspaceMemory(wsPath, content);
    res.json(getMemoryState(wsPath));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/agent/:agentId', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const { content } = req.body as { content?: string };
    if (content === undefined) return res.status(400).json({ error: 'content is required' });

    saveAgentMemory(req.params.agentId, content, wsPath);
    res.json(getMemoryState(wsPath));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/tier', (req: Request, res: Response) => {
  try {
    const { tier } = req.body as { tier?: 'simple' | 'wiki' | 'claude-mem' };
    if (!tier) return res.status(400).json({ error: 'tier is required' });

    const config = getConfig();
    config.memoryTier = tier;
    saveConfig(config);
    res.json(getMemoryState(requireWorkspace(res) ?? ''));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
