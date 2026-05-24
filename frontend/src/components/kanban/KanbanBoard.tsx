import React, { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import TaskCard from './TaskCard';
import TaskDetail from './TaskDetail';
import EditTaskModal from './EditTaskModal';
import { wsManager, updateTask, startAutoQueue, stopAutoQueue, runTask } from '../../api/client';
import { TaskConfig } from '../../types';
import {
  COLUMNS,
  ColumnId,
  normalizeStatusForColumn,
  statusToColumn,
} from './kanbanColumns';

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className={pulse ? 'dot pulse' : 'dot'} style={{ background: color }} />
  );
}

export default function KanbanBoard({ docked }: { docked?: boolean }) {
  const tasks = useStore(s => s.tasks);
  const selectedTaskId = useStore(s => s.selectedTaskId);
  const searchQuery = useStore(s => s.searchQuery);
  const showTaskDetail = useStore(s => s.showTaskDetail);
  const setSelectedTaskId = useStore(s => s.setSelectedTaskId);
  const setChatAgent = useStore(s => s.setChatAgent);
  const setModal = useStore(s => s.setModal);
  const setSearchQuery = useStore(s => s.setSearchQuery);
  const storeUpdateTask = useStore(s => s.updateTask);
  const setRunning = useStore(s => s.setRunning);
  const clearMessages = useStore(s => s.clearMessages);
  const setShowTaskDetail = useStore(s => s.setShowTaskDetail);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const autoQueue = useStore(s => s.autoQueue);
  const loadWorkspaceData = useStore(s => s.loadWorkspaceData);
  const continueTaskInChat = useStore(s => s.continueTaskInChat);

  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<ColumnId | null>(null);

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.agent.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.workflow.toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof tasks> = {
      todo: [], running: [], review: [], confirm: [], done: [], archive: [],
    };
    filteredTasks.forEach(t => {
      const col = statusToColumn(t.status);
      g[col]?.push(t);
    });
    return g;
  }, [filteredTasks]);

  const moveTaskToColumn = async (task: TaskConfig, columnId: ColumnId) => {
    const col = COLUMNS.find(c => c.id === columnId);
    if (!col?.dropEnabled) return;

    const nextStatus = normalizeStatusForColumn(task.status, columnId);
    if (statusToColumn(task.status) === columnId && task.status === nextStatus) return;

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

  const handleSelect = (id: string) => {
    setSelectedTaskId(id);
    setShowTaskDetail(true);
    const task = tasks.find(t => t.id === id);
    if (task) {
      setChatAgent(task.agent);
      clearMessages();
    }
  };

  const handleEdit = (id: string) => {
    setSelectedTaskId(id);
    setEditTaskId(id);
  };

  const handleAction = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.status === 'running') {
      wsManager.send({ type: 'stop' });
      const updated = { ...task, status: 'review' as const, updatedAt: new Date().toISOString() };
      storeUpdateTask(updated);
      try { await updateTask(id, { status: 'review' }); } catch { /* ignore */ }
      setRunning(false);
    } else if (task.status === 'todo' || task.status === 'review' || task.status === 'planned') {
      setSelectedTaskId(id);
      setChatAgent(task.agent);
      clearMessages();
      setRunning(true);
      wsManager.send({ type: 'run_task', taskId: id });
    } else if (task.status === 'awaiting_confirmation') {
      if (task.session_id) {
        void continueTaskInChat(id);
      } else {
        setSelectedTaskId(id);
        setShowTaskDetail(true);
      }
    }
  };

  const handleContinueInChat = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    void continueTaskInChat(id);
  };

  const toggleAutoQueue = () => {
    if (autoQueue) stopAutoQueue();
    else startAutoQueue();
  };

  const handleNudge = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === 'running' || task.status === 'done' || task.status === 'archive') return;
    setSelectedTaskId(id);
    setShowTaskDetail(true);
    setChatAgent(task.agent);
    clearMessages();
    setRunning(true);
    runTask(id, true);
  };

  const handleDragStart = (taskId: string, e: React.DragEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      e.preventDefault();
      return;
    }
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDropColumn(null);
  };

  const handleDragOver = (columnId: ColumnId, e: React.DragEvent) => {
    const col = COLUMNS.find(c => c.id === columnId);
    if (!col?.dropEnabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropColumn(columnId);
  };

  const handleDrop = (columnId: ColumnId, e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    const task = tasks.find(t => t.id === taskId);
    setDraggedTaskId(null);
    setDropColumn(null);
    if (task) void moveTaskToColumn(task, columnId);
  };

  const runningCount = tasks.filter(t => t.status === 'running').length;

  if (!activeWorkspaceId) {
    return (
      <section className="kanban kanban-empty">
        <p>Add a workspace in the sidebar to get started.</p>
      </section>
    );
  }

  return (
    <section className={'kanban-wrap' + (docked ? ' kanban-wrap--docked' : '')}>
      <section className={'kanban' + (docked ? ' kanban--docked' : '')} data-screen-label="kanban">
        <header className="kanban-hd">
          <div className="kanban-title">
            <h1>Tasks</h1>
            <span className="kanban-sub">
              {tasks.length} total · {runningCount} active
              {autoQueue ? ' · auto-queue on' : ''}
            </span>
          </div>
          <div className="kanban-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void loadWorkspaceData()}
              title="Reload tasks from disk (picks up task.md edits)"
            >
              ↻ Refresh
            </button>
            <button
              type="button"
              className={'btn btn-sm' + (autoQueue ? ' is-on' : '')}
              onClick={toggleAutoQueue}
              title="Automatically run todo tasks one at a time"
            >
              {autoQueue ? '⏸ Auto-queue' : '▶ Auto-queue'}
            </button>
            <div className="search">
              <span className="search-glyph">⌕</span>
              <input
                placeholder="Filter tasks…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setModal('task')}>+ New task</button>
          </div>
        </header>

        <div className="cols">
          {COLUMNS.map(col => (
            <div className="col" key={col.id}>
              <div className="col-hd">
                <span className="col-title"><Dot color={col.hue} pulse={col.id === 'running'} />{col.label}</span>
                <span className="col-count">{grouped[col.id]?.length ?? 0}</span>
              </div>
              <div
                className={
                  'col-body'
                  + (dropColumn === col.id ? ' is-drop-target' : '')
                  + (!col.dropEnabled ? ' is-drop-disabled' : '')
                }
                onDragOver={e => handleDragOver(col.id, e)}
                onDragEnter={() => col.dropEnabled && setDropColumn(col.id)}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropColumn(c => (c === col.id ? null : c));
                  }
                }}
                onDrop={e => handleDrop(col.id, e)}
              >
                {grouped[col.id]?.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={selectedTaskId === task.id}
                    dragging={draggedTaskId === task.id}
                    onSelect={handleSelect}
                    onEdit={handleEdit}
                    onContinueInChat={handleContinueInChat}
                    onNudge={handleNudge}
                    onAction={handleAction}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                ))}
                {(grouped[col.id]?.length ?? 0) === 0 && (
                  <div className="col-empty">{col.dropEnabled ? 'Drop here' : '—'}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {showTaskDetail && selectedTaskId && (
        <TaskDetail
          taskId={selectedTaskId}
          onClose={() => setShowTaskDetail(false)}
          onEdit={() => setEditTaskId(selectedTaskId)}
          onMoveStatus={(status) => {
            const task = tasks.find(t => t.id === selectedTaskId);
            if (task) void moveTaskToColumn(task, statusToColumn(status));
          }}
        />
      )}

      <EditTaskModal
        open={editTaskId !== null}
        taskId={editTaskId}
        onClose={() => setEditTaskId(null)}
      />
    </section>
  );
}
