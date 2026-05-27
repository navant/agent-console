import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import {
  listTasks,
  getTask,
  saveTask,
  deleteTask,
  createTask,
  getActiveWorkspace,
  getTaskPlan,
  saveTaskPlan,
  getTaskProgress,
  getTaskPrompt,
  saveTaskPrompt,
  getAgent,
  getAgentSoulPath,
  getWorkflow,
} from '../services/fileStore';
import { resolveTaskTypeFields } from '../services/taskTypesStore';
import { PlanConfig, TaskConfig, UserStory } from '../types';
import { renderWorkflowTemplate } from '../services/workflowRenderer';
import { addTaskComment, getTaskComments, updateTaskComment } from '../services/taskComments';
import {
  appendAnswersToPrd,
  formatAnswersBody,
  findPendingQuestionsComment,
  parseQuestionsFromAgentText,
} from '../services/taskQuestions';
import type { QuestionAnswers } from '../services/taskQuestions';
import { onTaskCommentAdded } from '../services/taskQueue';
import { mergeTaskFromMarkdownContent, readTaskMarkdown } from '../services/taskMarkdown';
import { createPrdFile } from '../services/prdStore';
import { isRalphLoopWorkflowId } from '../services/workflowStore';

let broadcast: ((msg: unknown) => void) | null = null;

export function setBroadcast(fn: (msg: unknown) => void): void {
  broadcast = fn;
}

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
    res.json(listTasks(wsPath));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const task = getTask(req.params.id, wsPath);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({
      ...task,
      prompt: getTaskPrompt(req.params.id, wsPath),
      plan: getTaskPlan(req.params.id, wsPath),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const body = req.body as {
      title?: string;
      agent?: string;
      workflow?: string;
      skills?: string[];
      description?: string;
      prd?: string;
      goal?: string;
      taskType?: string;
    };
    if (!body.title) return res.status(400).json({ error: 'title is required' });

    const resolved = resolveTaskTypeFields(wsPath, {
      taskType: body.taskType,
      agent: body.agent,
      workflow: body.workflow,
      skills: body.skills,
    });
    if (!resolved.workflow) return res.status(400).json({ error: 'workflow is required' });

    let prdPath = body.prd;
    if (!prdPath && isRalphLoopWorkflowId(resolved.workflow)) {
      const slug = body.title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'feature';
      const prd = createPrdFile(
        wsPath,
        `prd-${slug}`,
        `# ${body.title}\n\n${(body.description || '').trim()}\n`
      );
      prdPath = prd.path;
    }

    const task = createTask(
      {
        title: body.title,
        agent: resolved.agent,
        workflow: resolved.workflow,
        skills: resolved.skills,
        description: body.description,
        prd: prdPath,
        goal: body.goal,
        taskType: resolved.taskType,
      },
      wsPath
    );

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const existing = getTask(req.params.id, wsPath);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const body = req.body as Partial<TaskConfig> & { description?: string };
    const resolved = resolveTaskTypeFields(wsPath, {
      taskType: 'taskType' in body ? (body.taskType || undefined) : existing.taskType,
      agent: body.agent ?? existing.agent,
      workflow: body.workflow ?? existing.workflow,
      skills: body.skills ?? existing.skills,
    });

    const updated: TaskConfig = {
      ...existing,
      ...body,
      agent: resolved.agent,
      workflow: resolved.workflow,
      skills: resolved.skills,
      id: req.params.id,
      updatedAt: new Date().toISOString(),
    };
    if (resolved.taskType) updated.taskType = resolved.taskType;
    else delete updated.taskType;

    saveTask(updated, wsPath);
    if (body.description !== undefined) {
      saveTaskPrompt(req.params.id, wsPath, body.description);
    }

    if (broadcast) broadcast({ type: 'task_update', task: updated });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/confirm', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const task = getTask(req.params.id, wsPath);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    task.status = 'done';
    task.updatedAt = new Date().toISOString();
    saveTask(task, wsPath);
    if (broadcast) broadcast({ type: 'task_update', task });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/reject', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const task = getTask(req.params.id, wsPath);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    task.status = 'todo';
    task.updatedAt = new Date().toISOString();
    saveTask(task, wsPath);
    addTaskComment(wsPath, req.params.id, {
      author: 'system',
      authorName: 'System',
      kind: 'activity',
      body: 'Task returned to todo',
    });
    if (broadcast) broadcast({ type: 'task_update', task });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    deleteTask(req.params.id, wsPath);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/plan', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    res.json(getTaskPlan(req.params.id, wsPath));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id/plan', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const task = getTask(req.params.id, wsPath);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const plan = req.body as PlanConfig;
    saveTaskPlan(req.params.id, wsPath, plan);

    const needsPlan =
      task.workflow === 'ralph-loop' || task.type === 'project';
    if (needsPlan && plan.userStories.length > 0 && task.status === 'todo') {
      task.status = 'planned';
      task.updatedAt = new Date().toISOString();
      saveTask(task, wsPath);
      if (broadcast) broadcast({ type: 'task_update', task });
    }

    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/plan/generate', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;

    const task = getTask(req.params.id, wsPath);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { description } = req.body as { description?: string };
    const promptText = description || getTaskPrompt(req.params.id, wsPath) || task.title;

    const systemPrompt = `You are a product manager. Generate a prd.json with user stories for the given task description.
Return ONLY valid JSON in this format:
{"userStories":[{"id":"US-001","title":"...","description":"...","acceptanceCriteria":["..."],"priority":1,"passes":false}]}`;

    const resolvedWs = path.resolve(wsPath);
    const args = [
      '-p', `${systemPrompt}\n\nTask:\n${promptText}`,
      '--output-format', 'json',
      '--dangerously-skip-permissions',
      '--setting-sources',
      'user,project',
      '--add-dir',
      resolvedWs,
    ];

    const proc = spawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: resolvedWs,
      env: { ...process.env, AGENT_CONSOLE_HEADLESS: '1' },
    });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (c: Buffer) => { stdout += c.toString(); });
    proc.stderr?.on('data', (c: Buffer) => { stderr += c.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        res.status(500).json({ error: stderr || `claude exited with code ${code}` });
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as { result?: string } | PlanConfig;
        let plan: PlanConfig;
        if ('result' in parsed && typeof parsed.result === 'string') {
          const jsonMatch = parsed.result.match(/\{[\s\S]*\}/);
          plan = JSON.parse(jsonMatch?.[0] ?? parsed.result) as PlanConfig;
        } else {
          plan = parsed as PlanConfig;
        }

        if (!plan.userStories) plan.userStories = [];
        plan.userStories = plan.userStories.map((s, i) => ({
          id: s.id || `US-${String(i + 1).padStart(3, '0')}`,
          title: s.title || 'Untitled',
          description: s.description || '',
          acceptanceCriteria: s.acceptanceCriteria || [],
          priority: s.priority ?? i + 1,
          passes: false,
        })) as UserStory[];

        saveTaskPlan(req.params.id, wsPath, plan);
        res.json(plan);
      } catch (err) {
        res.status(500).json({ error: `Failed to parse plan: ${err}` });
      }
    });

    proc.on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/progress', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    res.json({ content: getTaskProgress(req.params.id, wsPath) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/markdown', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const task = getTask(req.params.id, wsPath);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ content: readTaskMarkdown(wsPath, req.params.id) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put('/:id/markdown', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const existing = getTask(req.params.id, wsPath);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const updated = mergeTaskFromMarkdownContent(content, existing);
    if (!updated) {
      return res.status(400).json({ error: 'Invalid task.md — status frontmatter is required' });
    }

    saveTask(updated, wsPath);
    if (broadcast) broadcast({ type: 'task_update', task: updated });
    res.json({ task: updated, content: readTaskMarkdown(wsPath, req.params.id) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/:id/comments', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const task = getTask(req.params.id, wsPath);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ comments: getTaskComments(wsPath, req.params.id) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/questions/extract', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const task = getTask(req.params.id, wsPath);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (findPendingQuestionsComment(getTaskComments(wsPath, req.params.id))) {
      return res.status(400).json({ error: 'Questions already open on this task' });
    }

    const comments = getTaskComments(wsPath, req.params.id);
    const agentComments = comments.filter(c => c.kind === 'comment' && c.author === 'agent');
    const source = agentComments[agentComments.length - 1];
    if (!source?.body) {
      return res.status(404).json({ error: 'No agent message to extract questions from' });
    }

    const parsed = parseQuestionsFromAgentText(source.body);
    if (!parsed?.length) {
      return res.status(400).json({ error: 'Could not find numbered questions in the latest agent message' });
    }

    const qComment = addTaskComment(wsPath, req.params.id, {
      author: 'agent',
      authorName: 'Agent',
      kind: 'questions',
      body: 'Clarifying questions (extracted from agent message).',
      questions: parsed,
    });

    if (broadcast) {
      broadcast({ type: 'comment_append', taskId: req.params.id, comment: qComment });
    }
    res.json({ comment: qComment });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/questions/:commentId/answer', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const task = getTask(req.params.id, wsPath);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { answers } = req.body as { answers?: QuestionAnswers };
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers object is required' });
    }

    const comments = getTaskComments(wsPath, req.params.id);
    const qComment = comments.find(c => c.id === req.params.commentId);
    if (!qComment || qComment.kind !== 'questions' || !qComment.questions?.length) {
      return res.status(404).json({ error: 'Questions not found' });
    }
    if (qComment.answeredAt) {
      return res.status(400).json({ error: 'Questions already answered' });
    }

    const answeredAt = new Date().toISOString();
    updateTaskComment(wsPath, req.params.id, qComment.id, { answeredAt });

    let prdUpdated = false;
    if (task.prd) {
      appendAnswersToPrd(wsPath, task.prd, qComment.questions, answers);
      prdUpdated = true;
    }

    const answerBody = formatAnswersBody(qComment.questions, answers);
    const userComment = addTaskComment(wsPath, req.params.id, {
      author: 'user',
      authorName: 'You',
      kind: 'comment',
      body: answerBody,
    });

    if (task.status === 'running') {
      task.status = 'todo';
    } else if (
      task.status === 'awaiting_confirmation' ||
      task.status === 'review' ||
      task.status === 'done'
    ) {
      task.status = 'todo';
    }
    task.updatedAt = new Date().toISOString();
    saveTask(task, wsPath);

    if (broadcast) {
      broadcast({
        type: 'comment_append',
        taskId: req.params.id,
        comment: { ...qComment, answeredAt },
      });
      broadcast({ type: 'comment_append', taskId: req.params.id, comment: userComment });
      broadcast({ type: 'task_update', task });
    }

    onTaskCommentAdded(req.params.id);
    res.json({ ok: true, prdUpdated, prdPath: task.prd, userComment });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/:id/comments', (req: Request, res: Response) => {
  try {
    const wsPath = requireWorkspace(res);
    if (!wsPath) return;
    const task = getTask(req.params.id, wsPath);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const body = req.body as { text?: string; authorName?: string };
    const text = body.text?.trim();
    if (!text) return res.status(400).json({ error: 'text is required' });

    const comment = addTaskComment(wsPath, req.params.id, {
      author: 'user',
      authorName: body.authorName?.trim() || 'You',
      kind: 'comment',
      body: text,
    });

    if (task.status === 'awaiting_confirmation' || task.status === 'review' || task.status === 'done') {
      task.status = 'todo';
      task.updatedAt = new Date().toISOString();
      saveTask(task, wsPath);
      if (broadcast) broadcast({ type: 'task_update', task });
    }

    if (broadcast) broadcast({ type: 'comment_append', taskId: req.params.id, comment });
    onTaskCommentAdded(req.params.id);
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
