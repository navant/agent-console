import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { wsManager } from './api/client';
import { WSServerMessage } from './types';
import AppShell from './components/shell/AppShell';
import CreateTaskModal from './components/kanban/CreateTaskModal';
import WorkflowModal from './components/kanban/WorkflowModal';
import AgentModal from './components/agents/AgentModal';
import WorkspaceModal from './components/workspaces/WorkspaceModal';
import PlanEditor from './components/kanban/PlanEditor';

export default function App() {
  const modal = useStore(s => s.modal);
  const setModal = useStore(s => s.setModal);
  const loadAll = useStore(s => s.loadAll);
  const addMessage = useStore(s => s.addMessage);
  const setChatRunning = useStore(s => s.setChatRunning);
  const setTaskRunning = useStore(s => s.setTaskRunning);
  const setCurrentSessionId = useStore(s => s.setCurrentSessionId);
  const setWsConnected = useStore(s => s.setWsConnected);
  const updateTask = useStore(s => s.updateTask);
  const appendTaskProgress = useStore(s => s.appendTaskProgress);
  const appendTaskComment = useStore(s => s.appendTaskComment);
  const setAutomation = useStore(s => s.setAutomation);
  const planEditorTaskId = useStore(s => s.planEditorTaskId);
  const setPlanEditorTaskId = useStore(s => s.setPlanEditorTaskId);
  const openTaskTab = useStore(s => s.openTaskTab);
  const pendingPrdPath = useStore(s => s.pendingPrdPath);
  const pendingGoalPath = useStore(s => s.pendingGoalPath);
  const openWorkspaceTab = useStore(s => s.openWorkspaceTab);
  const setAppScreen = useStore(s => s.setAppScreen);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (pendingPrdPath) {
      setAppScreen('coder');
      openWorkspaceTab('prd');
    }
  }, [pendingPrdPath, openWorkspaceTab, setAppScreen]);

  useEffect(() => {
    if (pendingGoalPath) {
      setAppScreen('coder');
      openWorkspaceTab('goals');
    }
  }, [pendingGoalPath, openWorkspaceTab, setAppScreen]);

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
          setChatRunning(false);
          setTaskRunning(false);
          if (msg.result && msg.result !== 'stopped' && msg.result !== 'Task completed') {
            addMessage({ type: 'text', text: msg.result });
          }
          break;
        case 'error':
          setChatRunning(false);
          setTaskRunning(false);
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
    addMessage, setChatRunning, setTaskRunning, setCurrentSessionId, setWsConnected,
    updateTask, appendTaskProgress, appendTaskComment, setAutomation,
  ]);

  return (
    <>
      <AppShell />

      <CreateTaskModal
        open={modal === 'task'}
        onClose={() => setModal(null)}
        onCreated={(id) => openTaskTab(id)}
      />
      <WorkflowModal open={modal === 'workflow'} onClose={() => setModal(null)} />
      <AgentModal open={modal === 'agent'} onClose={() => setModal(null)} />
      <WorkspaceModal open={modal === 'workspace'} onClose={() => setModal(null)} />
      <PlanEditor
        open={planEditorTaskId !== null}
        taskId={planEditorTaskId}
        onClose={() => setPlanEditorTaskId(null)}
      />
    </>
  );
}
