import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { wsManager } from './api/client';
import { WSServerMessage } from './types';
import Layout from './components/layout/Layout';
import Workspace from './components/workspace/Workspace';
import CreateTaskModal from './components/kanban/CreateTaskModal';
import WorkflowModal from './components/kanban/WorkflowModal';
import AgentModal from './components/agents/AgentModal';
import WorkspaceModal from './components/workspaces/WorkspaceModal';

export default function App() {
  const theme = useStore(s => s.theme);
  const accent = useStore(s => s.accent);
  const density = useStore(s => s.density);
  const modal = useStore(s => s.modal);
  const setModal = useStore(s => s.setModal);
  const loadAll = useStore(s => s.loadAll);
  const addMessage = useStore(s => s.addMessage);
  const setRunning = useStore(s => s.setRunning);
  const setCurrentSessionId = useStore(s => s.setCurrentSessionId);
  const setWsConnected = useStore(s => s.setWsConnected);
  const updateTask = useStore(s => s.updateTask);
  const appendTaskProgress = useStore(s => s.appendTaskProgress);
  const appendTaskComment = useStore(s => s.appendTaskComment);
  const setAutomation = useStore(s => s.setAutomation);
  const setTaskPlan = useStore(s => s.setTaskPlan);
  const openTaskTab = useStore(s => s.openTaskTab);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    wsManager.connect();

    const unsubscribe = wsManager.onMessage((msg: WSServerMessage) => {
      switch (msg.type) {
        case 'session_start':
          setCurrentSessionId(msg.sessionId);
          addMessage({ type: 'system', text: `session ${msg.sessionId} · task ${msg.taskId}` });
          break;
        case 'text':
          addMessage({ type: 'text', text: msg.content });
          break;
        case 'tool_use':
          addMessage({ type: 'tool_use', tool: msg.tool, input: msg.input });
          break;
        case 'tool_result':
          addMessage({ type: 'tool_result', text: msg.content });
          break;
        case 'done':
          setRunning(false);
          if (msg.result && msg.result !== 'stopped' && msg.result !== 'Task completed') {
            addMessage({ type: 'text', text: msg.result });
          }
          break;
        case 'error':
          setRunning(false);
          addMessage({ type: 'system', text: `ERROR: ${msg.message}` });
          break;
        case 'task_update':
          updateTask(msg.task);
          break;
        case 'progress_append':
          appendTaskProgress(msg.taskId, msg.line);
          break;
        case 'comment_append':
          appendTaskComment(msg.taskId, msg.comment);
          break;
        case 'automation_state':
          setAutomation(msg.autoQueue);
          break;
        case 'story_complete':
          setTaskPlan(msg.taskId, {
            userStories: useStore.getState().taskPlans[msg.taskId]?.userStories.map(s =>
              s.id === msg.storyId ? { ...s, passes: true } : s
            ) ?? [],
          });
          break;
      }
    });

    const interval = setInterval(() => {
      const connected = wsManager.isConnected;
      if (connected !== useStore.getState().wsConnected) setWsConnected(connected);
    }, 1000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [
    addMessage, setRunning, setCurrentSessionId, setWsConnected,
    updateTask, appendTaskProgress, appendTaskComment, setAutomation, setTaskPlan,
  ]);

  return (
    <div
      className={`app ${theme} density-${density}`}
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <Layout>
        <Workspace />
      </Layout>

      <CreateTaskModal
        open={modal === 'task'}
        onClose={() => setModal(null)}
        onCreated={(id) => openTaskTab(id)}
      />
      <WorkflowModal open={modal === 'workflow'} onClose={() => setModal(null)} />
      <AgentModal open={modal === 'agent'} onClose={() => setModal(null)} />
      <WorkspaceModal open={modal === 'workspace'} onClose={() => setModal(null)} />
    </div>
  );
}
