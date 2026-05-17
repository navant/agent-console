import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WSClientMessage, WSServerMessage } from './types';
import agentsRouter from './routes/agents';
import workspacesRouter from './routes/workspaces';
import tasksRouter, { setBroadcast } from './routes/tasks';
import skillsRouter from './routes/skills';
import sessionsRouter from './routes/sessions';
import { getTask, getAgent, getWorkspace, saveTask, getAgentSoulPath } from './services/fileStore';
import { runClaude, stopActive } from './services/claudeRunner';
import { spawnPty, PtySession } from './services/ptyRunner';

const PORT = 3001;

const app = express();
app.use(express.json());

app.use('/api/agents', agentsRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/sessions', sessionsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = createServer(app);

// ── Terminal WebSocket  (/ws/terminal) ────────────────────────────────────────
const termWss = new WebSocketServer({ server, path: '/ws/terminal' });

termWss.on('connection', (ws: WebSocket) => {
  let ptySession: PtySession | null = null;
  console.log('[pty] terminal client connected');

  ws.on('message', (raw: Buffer) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw.toString()) as Record<string, unknown>; } catch { return; }

    const type = msg.type as string;

    if (type === 'terminal_start') {
      // Kill any existing PTY for this connection
      ptySession?.kill();

      const agentId = msg.agentId as string | undefined;
      const agent   = agentId ? getAgent(agentId) : null;

      ptySession = spawnPty({
        sessionId:     (msg.sessionId as string) || undefined,
        model:         agent?.model,
        soulPath:      agent ? getAgentSoulPath(agent.id) : undefined,
        tools:         agent?.tools,
        workspacePath: (msg.workspacePath as string) || undefined,
        cols:          (msg.cols as number) || 220,
        rows:          (msg.rows as number) || 50,
        onData: (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'terminal_output', data }));
          }
        },
        onExit: () => {
          ptySession = null;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'terminal_exit' }));
          }
        },
      });
    }

    else if (type === 'terminal_input') {
      ptySession?.write(msg.data as string);
    }

    else if (type === 'terminal_resize') {
      ptySession?.resize(msg.cols as number, msg.rows as number);
    }

    else if (type === 'terminal_kill') {
      ptySession?.kill();
      ptySession = null;
    }
  });

  ws.on('close', () => {
    ptySession?.kill();
    ptySession = null;
    console.log('[pty] terminal client disconnected');
  });
});

// ── Task/chat WebSocket  (/ws) ────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });
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

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);

  ws.on('message', async (raw: Buffer) => {
    let msg: WSClientMessage;
    try { msg = JSON.parse(raw.toString()) as WSClientMessage; }
    catch { sendTo(ws, { type: 'error', message: 'Invalid JSON' }); return; }

    if (msg.type === 'run_task') {
      const task = getTask(msg.taskId);
      if (!task) { sendTo(ws, { type: 'error', message: `Task ${msg.taskId} not found` }); return; }

      const agent = getAgent(task.agent);
      if (!agent) { sendTo(ws, { type: 'error', message: `Agent "${task.agent}" not found` }); return; }

      const workspace  = getWorkspace(task.workspace);
      const prompt     = task.description?.trim() || task.title;
      const soulPath   = getAgentSoulPath(agent.id);

      task.status = 'running';
      task.updatedAt = new Date().toISOString();
      saveTask(task);
      broadcast({ type: 'task_update', task });

      runClaude({
        taskId: task.id, prompt, agentId: agent.id, model: agent.model,
        soulPath, workspacePath: workspace?.path, tools: agent.tools, sessionId: task.session_id,
        onMessage: (m) => {
          sendTo(ws, m);
          if (m.type === 'session_start') {
            task.session_id = m.sessionId;
            task.updatedAt = new Date().toISOString();
            saveTask(task);
          }
        },
        onDone: (sessionId) => {
          task.status = 'review';
          task.session_id = sessionId || task.session_id;
          task.updatedAt = new Date().toISOString();
          saveTask(task);
          sendTo(ws, { type: 'done', result: 'Task completed' });
          broadcast({ type: 'task_update', task });
        },
        onError: (err) => {
          sendTo(ws, { type: 'error', message: err });
          task.status = 'todo';
          task.updatedAt = new Date().toISOString();
          saveTask(task);
          broadcast({ type: 'task_update', task });
        },
      });
    }

    else if (msg.type === 'stop') {
      stopActive();
      sendTo(ws, { type: 'done', result: 'stopped' });
    }

    else if (msg.type === 'chat') {
      const agentId = msg.agentName; // field name is agentName but stores id
      const agent   = agentId ? getAgent(agentId) : null;
      const soulPath = agent ? getAgentSoulPath(agent.id) : '';

      runClaude({
        taskId:        'chat',
        prompt:        msg.message,
        agentId:       agent?.id ?? '',
        model:         agent?.model ?? '',
        soulPath,
        tools:         agent?.tools ?? [],
        sessionId:     msg.sessionId,
        onMessage:     (m) => sendTo(ws, m),
        onDone:        () => sendTo(ws, { type: 'done', result: '' }),
        onError:       (err) => sendTo(ws, { type: 'error', message: err }),
      });
    }
  });

  ws.on('close', () => { clients.delete(ws); });
  ws.on('error', () => { clients.delete(ws); });
});

server.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});

export default server;
