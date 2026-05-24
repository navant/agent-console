import { Router, Request, Response } from 'express';
import { getActiveWorkspace } from '../services/fileStore';
import {
  createPrdFile,
  getPrdContent,
  implementPrdAsTask,
  listPrdFiles,
  savePrdContent,
} from '../services/prdStore';

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
    res.json(listPrdFiles(wsPath));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/file', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    res.json({ path: filePath, content: getPrdContent(wsPath, filePath) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/file', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const { path: filePath, content } = req.body as { path?: string; content?: string };
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'path and content are required' });
    }
    savePrdContent(wsPath, filePath, content);
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const { filename, content } = req.body as { filename?: string; content?: string };
    if (!filename) return res.status(400).json({ error: 'filename is required' });
    const file = createPrdFile(wsPath, filename, content ?? `# ${filename}\n\n`);
    res.status(201).json(file);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/implement', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const body = req.body as {
      prdPath?: string;
      agent?: string;
      workflow?: string;
      skills?: string[];
      title?: string;
      taskType?: string;
    };
    if (!body.prdPath) return res.status(400).json({ error: 'prdPath is required' });
    const task = implementPrdAsTask(wsPath, {
      prdPath: body.prdPath,
      agent: body.agent,
      workflow: body.workflow,
      skills: body.skills,
      title: body.title,
      taskType: body.taskType,
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
