import { Router, Request, Response } from 'express';
import {
  getActiveWorkspace,
  getWorkflow,
  saveWorkflow,
  deleteWorkflow,
  getWorkflowFileContent,
  saveWorkflowFileContent,
  createWorkflowFolder,
} from '../services/fileStore';
import {
  ARCHON_INSTALL_STEPS,
  getWorkflowDependencyStatus,
  listWorkflowsForWorkspace,
  SINGLE_SHOT_WORKFLOW_ID,
} from '../services/workflowStore';
import {
  WORKSPACE_SETUP_PLAN,
  runSetupWorkspace,
  setupWorkspace,
  writeArchonStreamEvent,
} from '../services/archonSetupStore';
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

router.get('/deps', async (_req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    const status = await getWorkflowDependencyStatus(ws?.path);
    res.json({ installSteps: ARCHON_INSTALL_STEPS, status });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/setup-workspace', async (_req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    if (!ws) {
      return res.status(400).json({ error: 'No active workspace. Add a workspace first.' });
    }
    const result = await setupWorkspace(ws.path);
    if (!result.success) {
      return res.status(422).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function streamWorkspaceSetup(req: Request, res: Response): Promise<void> {
  void (async () => {
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

    const canWrite = (): boolean => !res.writableEnded && !res.destroyed;

    try {
      const result = await runSetupWorkspace(ws.path, event => {
        if (canWrite()) writeArchonStreamEvent(res, event);
      });
      if (!result.success) res.statusCode = 422;
    } catch (err) {
      if (canWrite()) {
        writeArchonStreamEvent(res, {
          type: 'done',
          result: {
            success: false,
            workspacePath: ws.path,
            steps: WORKSPACE_SETUP_PLAN.map(p => ({ ...p, status: 'failed' as const })),
            log: String(err),
            hints: ['Setup failed unexpectedly. Check backend logs and retry.'],
          },
        });
      }
    } finally {
      if (canWrite()) res.end();
    }
  })();
}

router.post('/setup-workspace/stream', (req: Request, res: Response) => {
  void streamWorkspaceSetup(req, res);
});

router.post('/setup-archon/stream', (req: Request, res: Response) => {
  void streamWorkspaceSetup(req, res);
});

router.post('/setup-archon', async (_req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    if (!ws) {
      return res.status(400).json({ error: 'No active workspace. Add a workspace first.' });
    }
    const result = await setupWorkspace(ws.path);
    if (!result.success) {
      return res.status(422).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const ws = getActiveWorkspace();
    res.json(await listWorkflowsForWorkspace(ws?.path));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/file', (req: Request, res: Response) => {
  try {
    if (req.params.id === SINGLE_SHOT_WORKFLOW_ID) {
      return res.json({
        id: SINGLE_SHOT_WORKFLOW_ID,
        source: 'builtin',
        path: 'single-shot/WORKFLOW.md',
        content: '---\nname: single-shot\ntype: single\n---\n\n{{prompt}}\n',
      });
    }
    const ws = getActiveWorkspace();
    const q = req.query.source as string;
    if (q === 'archon' || q === 'builtin') {
      return res.status(400).json({ error: 'Archon workflows are not editable here' });
    }
    const source = q === 'global' ? 'global' : 'workspace';
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
    if (req.params.id === SINGLE_SHOT_WORKFLOW_ID) {
      return res.status(400).json({ error: 'single-shot is built-in; edit .claude/workflows/single-shot/WORKFLOW.md in workspace to customize' });
    }
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
      type: 'single',
      agent: body.agent,
      skills: body.skills ?? [],
      task_type: body.task_type,
      template:
        body.template ||
        '# {{task.id}} — {{task.title}}\n\n{{storyDescription}}\n\n## PRD\n\n{{prdExcerpt}}\n\n## Memory\n\n{{memory}}',
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
