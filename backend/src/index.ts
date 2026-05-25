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
import prdRouter from './routes/prd';
import goalsRouter from './routes/goals';
import taskTypesRouter from './routes/taskTypes';
import {
  getActiveWorkspace,
  getTask,
  getAgent,
  getAgentSoulPath,
  buildSkillInvocationPrompt,
  ensureSkillToolAllowed,
} from './services/fileStore';
import { executeTask, stopTaskRunner } from './services/taskRunner';
import {
  setTaskQueueCallbacks,
  setAutoQueue,
  tick,
  getAutomationState,
} from './services/taskQueue';
import { runSlashCommand, stopRalph } from './services/ptyRunner';
import { runClaude } from './services/claudeRunner';

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
app.use('/api/prd', prdRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/task-types', taskTypesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), automation: getAutomationState() });
});

const server = createServer(app);

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

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);

  sendTo(ws, { type: 'automation_state', ...getAutomationState() });

  ws.on('message', (raw: Buffer) => {
    let msg: WSClientMessage;
    try { msg = JSON.parse(raw.toString()) as WSClientMessage; }
    catch { sendTo(ws, { type: 'error', message: 'Invalid JSON' }); return; }

    const runCallbacks = {
      sendTo: (m: WSServerMessage) => sendTo(ws, m),
      broadcast,
    };

    try {
      if (msg.type === 'run_task') {
        const activeWs = getActiveWorkspace();
        if (!activeWs) {
          sendTo(ws, { type: 'error', message: 'No active workspace' });
          return;
        }
        executeTask(msg.taskId, activeWs.path, { nudge: !!msg.nudge, source: 'manual' }, runCallbacks)
          .then(() => void tick())
          .catch(() => {});
      } else if (msg.type === 'auto_queue_start') {
        setAutoQueue(true);
        broadcast({ type: 'automation_state', ...getAutomationState() });
        void tick();
      } else if (msg.type === 'auto_queue_stop') {
        setAutoQueue(false);
        broadcast({ type: 'automation_state', ...getAutomationState() });
      } else if (msg.type === 'stop') {
        stopTaskRunner();
        stopRalph();
        sendTo(ws, { type: 'done', result: 'stopped' });
      } else if (msg.type === 'slash_command') {
        const activeWs = getActiveWorkspace();
        runSlashCommand({
          command: msg.command,
          sessionId: msg.sessionId,
          workspacePath: activeWs?.path,
          onOutput: (text) => sendTo(ws, { type: 'text', content: text }),
          onDone: () => sendTo(ws, { type: 'done', result: '' }),
          onError: (err) => sendTo(ws, { type: 'error', message: err }),
        });
      } else if (msg.type === 'chat') {
        const activeWs = getActiveWorkspace();
        const agentId = msg.agentName;
        const agent = agentId ? getAgent(agentId, activeWs?.path) : null;
        const soulPath = agent ? getAgentSoulPath(agent.id, activeWs?.path) : '';

        let prompt = msg.message;
        let tools = agent?.tools ?? [];
        if (msg.taskId && activeWs?.path) {
          const task = getTask(msg.taskId, activeWs.path);
          if (task?.skills?.length) {
            tools = ensureSkillToolAllowed(tools);
            if (msg.bootstrapSkills) {
              const skillBlock = buildSkillInvocationPrompt(task.skills, activeWs.path);
              if (skillBlock) prompt = `${skillBlock}\n\n---\n\n${prompt}`;
            }
          }
        }

        runClaude({
          taskId: 'chat',
          prompt,
          agentId: agent?.id ?? '',
          model: agent?.model ?? '',
          soulPath,
          tools,
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

setTaskQueueCallbacks({
  sendTo: (m) => broadcast(m),
  broadcast,
});

void tick();

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
