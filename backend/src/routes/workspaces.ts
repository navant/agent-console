import { Router, Request, Response } from 'express';
import {
  listRegisteredWorkspaces,
  registerWorkspace,
  unregisterWorkspace,
  getActiveWorkspace,
  setActiveWorkspace,
  getWorkspacesSnapshot,
} from '../services/fileStore';
import { expandHome } from '../config';
import { WorkspaceConfig } from '../types';

function expandSnapshot(snapshot: ReturnType<typeof getWorkspacesSnapshot>) {
  return {
    ...snapshot,
    workspaces: snapshot.workspaces.map(w => ({ ...w, path: expandHome(w.path) })),
  };
}

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(expandSnapshot(getWorkspacesSnapshot()));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const ws = listRegisteredWorkspaces().find(w => w.id === req.params.id);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(ws);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

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

    registerWorkspace(workspace);
    res.status(201).json({
      workspace: { ...workspace, path: expandHome(workspace.path) },
      ...expandSnapshot(getWorkspacesSnapshot()),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/activate', (req: Request, res: Response) => {
  try {
    const ws = setActiveWorkspace(req.params.id);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(ws);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const ok = unregisterWorkspace(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Workspace not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
