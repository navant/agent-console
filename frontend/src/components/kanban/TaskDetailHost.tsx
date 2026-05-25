import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { wsManager, updateTask, deleteTask } from '../../api/client';
import { TaskConfig, TaskStatus } from '../../types';
import TaskDetail from './TaskDetail';
import EditTaskModal from './EditTaskModal';
import { normalizeStatusForColumn, statusToColumn } from './kanbanColumns';

interface TaskDetailHostProps {
  taskId: string;
  tabId: string;
}

export default function TaskDetailHost({ taskId, tabId }: TaskDetailHostProps) {
  const tasks = useStore(s => s.tasks);
  const closeWorkspaceTab = useStore(s => s.closeWorkspaceTab);
  const storeUpdateTask = useStore(s => s.updateTask);
  const removeTask = useStore(s => s.removeTask);
  const setRunning = useStore(s => s.setRunning);
  const running = useStore(s => s.running);

  const [editTaskId, setEditTaskId] = useState<string | null>(null);

  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    return (
      <div className="workspace-empty-hint">
        <p>Task not found.</p>
        <button type="button" className="btn" onClick={() => closeWorkspaceTab(tabId)}>
          Close tab
        </button>
      </div>
    );
  }

  const moveTaskToStatus = async (status: TaskStatus) => {
    const nextStatus = normalizeStatusForColumn(task.status, statusToColumn(status));

    if (task.status === 'running') {
      wsManager.send({ type: 'stop' });
      setRunning(false);
    }

    const updated: TaskConfig = {
      ...task,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    storeUpdateTask(updated);
    try {
      await updateTask(task.id, { status: nextStatus });
    } catch {
      storeUpdateTask(task);
    }
  };

  const handleDelete = async (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;
    if (
      !window.confirm(
        `Delete task "${target.title}" (${target.id})?\n\nThis removes the task folder from disk. This cannot be undone.`
      )
    ) {
      return;
    }

    if (target.status === 'running' || running) {
      wsManager.send({ type: 'stop' });
      setRunning(false);
    }

    try {
      await deleteTask(id);
      removeTask(id);
      if (editTaskId === id) setEditTaskId(null);
    } catch (err) {
      window.alert(`Failed to delete task: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
      <TaskDetail
        taskId={taskId}
        fullPage
        onClose={() => closeWorkspaceTab(tabId)}
        onEdit={() => setEditTaskId(taskId)}
        onDelete={() => void handleDelete(taskId)}
        onMoveStatus={moveTaskToStatus}
      />
      <EditTaskModal
        open={editTaskId !== null}
        taskId={editTaskId}
        onClose={() => setEditTaskId(null)}
        onDelete={editTaskId ? () => void handleDelete(editTaskId) : undefined}
      />
    </>
  );
}
