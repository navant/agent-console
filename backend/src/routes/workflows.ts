import { Router, Request, Response } from 'express';
import {
  getActiveWorkspace,
  listWorkflows,
  getWorkflow,
  saveWorkflow,
  deleteWorkflow,
  getWorkflowFileContent,
  saveWorkflowFileContent,
  createWorkflowFolder,
} from '../services/fileStore';
import { WorkflowConfig } from '../types';

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
    const ws = getActiveWorkspace();
    res.json(listWorkflows(ws?.path));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/file', (req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    const source = (req.query.source as string) === 'global' ? 'global' : 'workspace';
    const content = getWorkflowFileContent(req.params.id, source, ws?.path);
    res.json({
      id: req.params.id,
      source,
      path: `${req.params.id}/WORKFLOW.md`,
      content,
    });
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

router.put('/:id/file', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const { content } = req.body as { content?: string };
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    saveWorkflowFileContent(req.params.id, wsPath, content);
    res.json({
      id: req.params.id,
      source: 'workspace',
      path: `${req.params.id}/WORKFLOW.md`,
      content,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const workflow = getWorkflow(req.params.id, wsPath);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const body = req.body as Partial<WorkflowConfig> & { content?: string };
    if (!body.name && !body.id) return res.status(400).json({ error: 'name is required' });

    const id =
      body.id ||
      (body.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    if (body.content) {
      createWorkflowFolder(wsPath, id, body.content);
      return res.status(201).json(getWorkflow(id, wsPath));
    }

    const workflow: WorkflowConfig = {
      id,
      name: body.name || id,
      type: body.type || 'single',
      max_iterations: body.max_iterations,
      commit_on_story: body.commit_on_story,
      template: body.template || '{{prompt}}\n\nWorkspace memory:\n{{memory}}',
      source: 'workspace',
    };

    saveWorkflow(workflow, wsPath);
    res.status(201).json(workflow);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const existing = getWorkflow(req.params.id, wsPath);
    if (!existing) return res.status(404).json({ error: 'Workflow not found' });

    const body = req.body as Partial<WorkflowConfig>;
    const updated: WorkflowConfig = { ...existing, ...body, id: req.params.id };
    saveWorkflow(updated, wsPath);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    deleteWorkflow(req.params.id, wsPath);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
