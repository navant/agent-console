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
  const setTaskRunning = useStore(s => s.setTaskRunning);
  const taskRunning = useStore(s => s.taskRunning);
  const setPlanEditorTaskId = useStore(s => s.setPlanEditorTaskId);

  const [editTaskId, setEditTaskId] = useState<string | null>(null);

  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    return (
      <div className="empty">
        <div className="empty-inner">
          <h2>Task not found</h2>
          <p>This task may have been deleted from disk.</p>
          <button type="button" className="btn btn-primary" onClick={() => closeWorkspaceTab(tabId)}>
            Close tab
          </button>
        </div>
      </div>
    );
  }

  const moveTaskToStatus = async (status: TaskStatus) => {
    const nextStatus = normalizeStatusForColumn(task.status, statusToColumn(status));

    if (task.status === 'running') {
      wsManager.send({ type: 'stop' });
      setTaskRunning(false);
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

    if (target.status === 'running' || taskRunning) {
      wsManager.send({ type: 'stop' });
      setTaskRunning(false);
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
        onEditPlan={() => setPlanEditorTaskId(taskId)}
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
