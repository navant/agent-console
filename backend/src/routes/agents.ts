import { Router, Request, Response } from 'express';
import {
  listAgents,
  getAgent,
  saveAgent,
  deleteAgent,
  getActiveWorkspace,
  getAgentFileContent,
  saveAgentFileContent,
  createAgentFile,
} from '../services/fileStore';
import { AgentConfig } from '../types';

const router = Router();

function workspacePath(): string | undefined {
  return getActiveWorkspace()?.path;
}

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(listAgents(workspacePath()));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/file', (req: Request, res: Response) => {
  try {
    const ws = workspacePath();
    const source = (req.query.source as string) === 'global' ? 'global' : 'workspace';
    const content = getAgentFileContent(req.params.id, source, ws);
    res.json({
      id: req.params.id,
      source,
      path: `${req.params.id}.md`,
      content,
    });
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

router.put('/:id/file', (req: Request, res: Response) => {
  try {
    const ws = workspacePath();
    if (!ws) return res.status(400).json({ error: 'No active workspace' });

    const { content } = req.body as { content?: string };
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    saveAgentFileContent(req.params.id, ws, content);
    res.json({
      id: req.params.id,
      source: 'workspace',
      path: `${req.params.id}.md`,
      content,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const agent = getAgent(req.params.id, workspacePath());
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<AgentConfig> & { source?: 'global' | 'workspace'; content?: string };
    const ws = getActiveWorkspace();
    const source = body.source || 'workspace';
    if (source === 'workspace' && !ws) {
      return res.status(400).json({ error: 'Active workspace required for workspace agents' });
    }
    if (!body.name && !body.id) return res.status(400).json({ error: 'name is required' });

    const id =
      body.id ||
      (body.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    if (source === 'workspace' && ws) {
      createAgentFile(ws.path, id, body.content);
      const agent = getAgent(id, ws.path);
      return res.status(201).json(agent);
    }

    const agent: AgentConfig = {
      id,
      name: body.name || id,
      model: body.model || 'claude-sonnet-4-6',
      tools: body.tools || ['Bash', 'Read', 'Write', 'Edit'],
      memory: body.memory !== false,
      soul: body.soul || '',
      source,
      tint: body.tint,
    };

    saveAgent(agent, undefined);
    res.status(201).json(agent);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const wsPath = workspacePath();
    const existing = getAgent(req.params.id, wsPath);
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    const body = req.body as Partial<AgentConfig>;
    const updated: AgentConfig = { ...existing, ...body, id: req.params.id };
    saveAgent(updated, updated.source === 'workspace' ? wsPath : undefined);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const wsPath = workspacePath();
    const source = (req.query.source as string) === 'global' ? 'global' : 'workspace';
    const existing =
      source === 'workspace'
        ? listAgents(wsPath).find(a => a.id === req.params.id && a.source === 'workspace')
        : listAgents(wsPath).find(a => a.id === req.params.id && a.source === 'global');
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    deleteAgent(req.params.id, existing.source, existing.source === 'workspace' ? wsPath : undefined);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
