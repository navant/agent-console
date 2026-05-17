import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { listTasks, getTask, saveTask, deleteTask, getAgent, getWorkspace, getAgentSoulPath } from '../services/fileStore';
import { TaskConfig } from '../types';
import { runClaude } from '../services/claudeRunner';

// We'll inject the ws broadcast function from index.ts
let broadcast: ((msg: unknown) => void) | null = null;

export function setBroadcast(fn: (msg: unknown) => void): void {
  broadcast = fn;
}

const router = Router();

// GET /api/tasks
router.get('/', (_req: Request, res: Response) => {
  try {
    const tasks = listTasks();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/tasks/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/tasks
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<TaskConfig>;
    if (!body.title) return res.status(400).json({ error: 'title is required' });
    if (!body.agent) return res.status(400).json({ error: 'agent is required' });
    if (!body.workspace) return res.status(400).json({ error: 'workspace is required' });

    const now = new Date().toISOString();
    const taskNum = Date.now().toString(36).toUpperCase().slice(-4);
    const id = `T-${taskNum}`;

    const task: TaskConfig = {
      id,
      title: body.title,
      agent: body.agent,
      workspace: body.workspace,
      status: 'todo',
      description: body.description || '',
      createdAt: now,
      updatedAt: now,
    };

    saveTask(task);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /api/tasks/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = getTask(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const body = req.body as Partial<TaskConfig>;
    const updated: TaskConfig = {
      ...existing,
      ...body,
      id: req.params.id,
      updatedAt: new Date().toISOString(),
    };

    saveTask(updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = getTask(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    deleteTask(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/tasks/:id/run — trigger a task run via HTTP (WebSocket is preferred)
router.post('/:id/run', (req: Request, res: Response) => {
  try {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const agent = getAgent(task.agent);
    if (!agent) return res.status(404).json({ error: `Agent "${task.agent}" not found` });

    const workspace = getWorkspace(task.workspace);

    const prompt = task.description || task.title;
    const soulPath = getAgentSoulPath(agent.id);

    // Update task status
    task.status = 'running';
    task.updatedAt = new Date().toISOString();
    saveTask(task);

    runClaude({
      taskId: task.id,
      prompt,
      agentId: agent.id,
      model: agent.model,
      soulPath,
      workspacePath: workspace?.path,
      tools: agent.tools,
      sessionId: task.session_id,
      onMessage: (msg) => {
        if (broadcast) broadcast(msg);

        // Capture session ID
        if (msg.type === 'session_start') {
          task.session_id = msg.sessionId;
          task.updatedAt = new Date().toISOString();
          saveTask(task);
        }
      },
      onDone: (sessionId) => {
        task.status = 'review';
        task.session_id = sessionId || task.session_id;
        task.updatedAt = new Date().toISOString();
        saveTask(task);
        if (broadcast) broadcast({ type: 'task_update', task });
      },
      onError: (err) => {
        if (broadcast) broadcast({ type: 'error', message: err });
      },
    });

    res.json({ status: 'started', taskId: task.id });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
