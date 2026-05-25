import { Router, Request, Response } from 'express';
import { getConfig, saveConfig, setActiveWorkspace, getPathSettings, savePathSettings, getActiveWorkspace } from '../services/fileStore';
import { setupConsole } from '../services/setupStore';
import {
  getMemoryDependencyStatus,
  MEMORY_DEPENDENCY_INSTALL_STEPS,
  runRefreshMemory,
  runSetupMemory,
  setupMemory,
  writeStreamEvent,
} from '../services/memorySetupStore';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const config = getConfig();
    res.json({ ...config, pathSettings: getPathSettings() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/paths', (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string>;
    const pathSettings = savePathSettings(body);
    res.json({ pathSettings });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/setup', (_req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    if (!ws) {
      return res.status(400).json({ error: 'No active workspace. Add a workspace first.' });
    }

    const result = setupConsole(ws.path);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/setup-memory', async (_req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    if (!ws) {
      return res.status(400).json({ error: 'No active workspace. Add a workspace first.' });
    }

    const result = await setupMemory(ws.path);
    if (!result.success) {
      return res.status(422).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/memory-deps', async (_req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    if (!ws) {
      return res.status(400).json({ error: 'No active workspace. Add a workspace first.' });
    }
    const status = await getMemoryDependencyStatus(ws.path);
    res.json({ installSteps: MEMORY_DEPENDENCY_INSTALL_STEPS, status });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function streamMemoryJob(
  req: Request,
  res: Response,
  run: (workspacePath: string, emit: (event: import('../services/memorySetupStore').MemorySetupStreamEvent) => void) => Promise<import('../services/memorySetupStore').MemorySetupResult>
): Promise<void> {
  const ws = getActiveWorkspace();
  if (!ws) {
    res.status(400).json({ error: 'No active workspace. Add a workspace first.' });
    return;
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Do NOT use req.on('close') — it fires when the POST body is fully read, not when
  // the client disconnects, which would skip the final events and leave the UI stuck.
  const canWrite = (): boolean => !res.writableEnded && !res.destroyed;

  try {
    const result = await run(ws.path, event => {
      if (canWrite()) writeStreamEvent(res, event);
    });
    if (!result.success) res.statusCode = 422;
  } catch (err) {
    if (canWrite()) {
      writeStreamEvent(res, {
        type: 'done',
        result: {
          success: false,
          workspacePath: ws.path,
          steps: [],
          log: String(err),
          hints: ['Operation failed unexpectedly. Check backend logs and retry.'],
          memoryTier: 'claude-mem',
        },
      });
    }
  } finally {
    if (canWrite()) res.end();
  }
}

router.post('/setup-memory/stream', (req: Request, res: Response) => {
  void streamMemoryJob(req, res, runSetupMemory);
});

router.post('/refresh-memory/stream', (req: Request, res: Response) => {
  void streamMemoryJob(req, res, runRefreshMemory);
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
