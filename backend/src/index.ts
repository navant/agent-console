import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WSClientMessage, WSServerMessage } from './types';
import agentsRouter from './routes/agents';
import workspacesRouter from './routes/workspaces';
import tasksRouter, { setBroadcast } from './routes/tasks';
import skillsRouter from './routes/skills';
import sessionsRouter from './routes/sessions';
import configRouter from './routes/config';
import workflowsRouter from './routes/workflows';
import memoryRouter from './routes/memory';
import browseRouter from './routes/browse';
import {
  getTask,
  getAgent,
  getActiveWorkspace,
  saveTask,
  getAgentSoulPath,
  getTaskPrompt,
  buildMemoryContext,
  getSkillContent,
  appendTaskProgress,
} from './services/fileStore';
import { runClaude, stopActive } from './services/claudeRunner';
import { runRalphLoop, stopRalph } from './services/ralphRunner';

const PORT = 3001;

const app = express();
app.use(express.json());

app.use('/api/config', configRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/sessions', sessionsRouter);

app.use('/api/browse', browseRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = createServer(app);

// ── Task/chat WebSocket  (/ws) ────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const pathname = (req.url ?? '').split('?')[0];
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

const clients = new Set<WebSocket>();

function broadcast(msg: unknown): void {
  const data = JSON.stringify(msg);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}
setBroadcast(broadcast);

function sendTo(ws: WebSocket, msg: WSServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function buildTaskPrompt(
  taskId: string,
  workspacePath: string,
  task: { agent: string; skills: string[]; title: string }
): string {
  const memory = buildMemoryContext(workspacePath, task.agent);
  const skills = getSkillContent(task.skills, workspacePath);
  const prompt = getTaskPrompt(taskId, workspacePath) || task.title;
  const parts: string[] = [];
  if (memory) parts.push(memory);
  if (skills) parts.push(skills);
  parts.push(prompt);
  return parts.join('\n\n---\n\n');
}

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);

  ws.on('message', (raw: Buffer) => {
    let msg: WSClientMessage;
    try { msg = JSON.parse(raw.toString()) as WSClientMessage; }
    catch { sendTo(ws, { type: 'error', message: 'Invalid JSON' }); return; }

    try {
      if (msg.type === 'run_task') {
        const activeWs = getActiveWorkspace();
        if (!activeWs) {
          sendTo(ws, { type: 'error', message: 'No active workspace' });
          return;
        }

        const task = getTask(msg.taskId, activeWs.path);
        if (!task) { sendTo(ws, { type: 'error', message: `Task ${msg.taskId} not found` }); return; }

        const agent = task.agent ? getAgent(task.agent, activeWs.path) : null;
        if (task.agent && !agent) {
          sendTo(ws, { type: 'error', message: `Agent "${task.agent}" not found` });
          return;
        }

        const soulPath = agent ? getAgentSoulPath(agent.id, activeWs.path) : '';

        task.status = 'running';
        task.updatedAt = new Date().toISOString();
        saveTask(task, activeWs.path);
        broadcast({ type: 'task_update', task });

        if (task.type === 'project') {
          runRalphLoop(msg.taskId, activeWs.path, {
            onMessage: (m) => {
              sendTo(ws, m);
              if (m.type === 'session_start') {
                task.session_id = m.sessionId;
                task.updatedAt = new Date().toISOString();
                saveTask(task, activeWs.path);
              }
            },
            onProgress: (line) => {
              broadcast({ type: 'progress_append', taskId: task.id, line });
            },
            onStoryComplete: (storyId) => {
              broadcast({ type: 'story_complete', taskId: task.id, storyId });
            },
            onTaskUpdate: (updated) => {
              broadcast({ type: 'task_update', task: updated });
            },
          })
            .then(() => sendTo(ws, { type: 'done', result: 'Task completed' }))
            .catch((err) => {
              sendTo(ws, { type: 'error', message: String(err) });
              task.status = 'review';
              task.updatedAt = new Date().toISOString();
              saveTask(task, activeWs.path);
              broadcast({ type: 'task_update', task });
            });
        } else {
          const prompt = buildTaskPrompt(msg.taskId, activeWs.path, task);

          runClaude({
            taskId: task.id,
            prompt,
            agentId: agent?.id ?? '',
            model: agent?.model ?? '',
            soulPath,
            workspacePath: activeWs.path,
            tools: agent?.tools ?? [],
            sessionId: task.session_id,
            onMessage: (m) => {
              sendTo(ws, m);
              if (m.type === 'session_start') {
                task.session_id = m.sessionId;
                task.updatedAt = new Date().toISOString();
                saveTask(task, activeWs.path);
              }
            },
            onDone: (sessionId) => {
              task.status = 'awaiting_confirmation';
              task.session_id = sessionId || task.session_id;
              task.updatedAt = new Date().toISOString();
              saveTask(task, activeWs.path);
              appendTaskProgress(
                task.id,
                activeWs.path,
                `[${new Date().toISOString()}] Run finished — awaiting confirmation`,
                (line) => broadcast({ type: 'progress_append', taskId: task.id, line })
              );
              sendTo(ws, { type: 'done', result: 'Awaiting confirmation' });
              broadcast({ type: 'task_update', task });
            },
            onError: (err) => {
              sendTo(ws, { type: 'error', message: err });
              task.status = 'todo';
              task.updatedAt = new Date().toISOString();
              saveTask(task, activeWs.path);
              broadcast({ type: 'task_update', task });
            },
          });
        }
      } else if (msg.type === 'stop') {
        stopActive();
        stopRalph();
        sendTo(ws, { type: 'done', result: 'stopped' });
      } else if (msg.type === 'chat') {
        const activeWs = getActiveWorkspace();
        const agentId = msg.agentName;
        const agent = agentId ? getAgent(agentId, activeWs?.path) : null;
        const soulPath = agent ? getAgentSoulPath(agent.id, activeWs?.path) : '';

        runClaude({
          taskId: 'chat',
          prompt: msg.message,
          agentId: agent?.id ?? '',
          model: agent?.model ?? '',
          soulPath,
          tools: agent?.tools ?? [],
          sessionId: msg.sessionId,
          workspacePath: activeWs?.path,
          onMessage: (m) => sendTo(ws, m),
          onDone: () => sendTo(ws, { type: 'done', result: '' }),
          onError: (err) => sendTo(ws, { type: 'error', message: err }),
        });
      }
    } catch (err) {
      console.error('[ws] message handler error:', err);
      sendTo(ws, { type: 'error', message: String(err) });
    }
  });

  ws.on('close', () => { clients.delete(ws); });
  ws.on('error', () => { clients.delete(ws); });
});

process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});

server.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});

export default server;
