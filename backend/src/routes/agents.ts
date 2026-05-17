import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { listAgents, getAgent, saveAgent, deleteAgent } from '../services/fileStore';
import { AgentConfig } from '../types';

const router = Router();

// GET /api/agents
router.get('/', (_req: Request, res: Response) => {
  try {
    const agents = listAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/agents/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/agents
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<AgentConfig>;
    if (!body.name) return res.status(400).json({ error: 'name is required' });

    const id = body.id || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const agent: AgentConfig = {
      id,
      name: body.name,
      model: body.model || 'claude-sonnet-4-5',
      tint: body.tint || '#7aa7d4',
      tools: body.tools || ['Bash', 'Read', 'Write', 'Edit'],
      skills: body.skills || [],
      memory: body.memory !== false,
      soul: body.soul || '',
    };

    saveAgent(agent);
    res.status(201).json(agent);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /api/agents/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = getAgent(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    const body = req.body as Partial<AgentConfig>;
    const updated: AgentConfig = {
      ...existing,
      ...body,
      id: req.params.id, // never change id
    };

    saveAgent(updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/agents/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = getAgent(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    deleteAgent(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
