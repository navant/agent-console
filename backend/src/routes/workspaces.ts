import { Router, Request, Response } from 'express';
import { listWorkspaces, getWorkspace, saveWorkspace, deleteWorkspace } from '../services/fileStore';
import { WorkspaceConfig } from '../types';

const router = Router();

// GET /api/workspaces
router.get('/', (_req: Request, res: Response) => {
  try {
    const workspaces = listWorkspaces();
    res.json(workspaces);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/workspaces/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const ws = getWorkspace(req.params.id);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(ws);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/workspaces
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<WorkspaceConfig>;
    if (!body.name) return res.status(400).json({ error: 'name is required' });
    if (!body.path) return res.status(400).json({ error: 'path is required' });

    const id = body.id || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const workspace: WorkspaceConfig = {
      id,
      name: body.name,
      path: body.path,
      description: body.description,
    };

    saveWorkspace(workspace);
    res.status(201).json(workspace);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/workspaces/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = getWorkspace(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Workspace not found' });

    deleteWorkspace(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
