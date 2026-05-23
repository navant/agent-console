import { Router, Request, Response } from 'express';
import {
  listAgents,
  getAgent,
  saveAgent,
  deleteAgent,
  getActiveWorkspace,
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
    const body = req.body as Partial<AgentConfig> & { source?: 'global' | 'workspace' };
    if (!body.name) return res.status(400).json({ error: 'name is required' });

    const ws = getActiveWorkspace();
    const source = body.source || 'global';
    if (source === 'workspace' && !ws) {
      return res.status(400).json({ error: 'Active workspace required for workspace agents' });
    }

    const id = body.id || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const agent: AgentConfig = {
      id,
      name: body.name,
      model: body.model || 'claude-sonnet-4-5',
      tools: body.tools || ['Bash', 'Read', 'Write', 'Edit'],
      memory: body.memory !== false,
      soul: body.soul || '',
      source,
      tint: body.tint,
    };

    saveAgent(agent, source === 'workspace' ? ws!.path : undefined);
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
    const existing = getAgent(req.params.id, wsPath);
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    deleteAgent(req.params.id, existing.source, existing.source === 'workspace' ? wsPath : undefined);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
