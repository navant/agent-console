import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import TaskCard from './TaskCard';
import TaskDetail from './TaskDetail';
import { wsManager } from '../../api/client';
import { updateTask } from '../../api/client';
const COLUMNS = [
  { id: 'todo' as const, label: 'Todo', hue: 'var(--muted)', statuses: ['todo', 'planned'] as const },
  { id: 'running' as const, label: 'Running', hue: 'var(--accent)', statuses: ['running'] as const },
  { id: 'review' as const, label: 'Review', hue: 'var(--amber)', statuses: ['review'] as const },
  { id: 'confirm' as const, label: 'Awaiting Confirmation', hue: '#8ab4d4', statuses: ['awaiting_confirmation'] as const },
  { id: 'done' as const, label: 'Done', hue: 'var(--green)', statuses: ['done'] as const },
];

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
      todo: [], running: [], review: [], confirm: [], done: [],
    };
    filteredTasks.forEach(t => {
      if (t.status === 'todo' || t.status === 'planned') g.todo.push(t);
      else if (t.status === 'awaiting_confirmation') g.confirm.push(t);
      else if (g[t.status]) g[t.status].push(t);
    });
    return g;
  }, [filteredTasks]);

  const handleSelect = (id: string) => {
    setSelectedTaskId(id);
    setShowTaskDetail(true);
    const task = tasks.find(t => t.id === id);
    if (task) {
      setChatAgent(task.agent);
      clearMessages();
    }
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
    } else if (task.type === 'project' && (task.status === 'todo' || task.status === 'planned')) {
      if (task.status === 'todo') {
        setModal('plan');
        setSelectedTaskId(id);
        return;
      }
      setSelectedTaskId(id);
      setChatAgent(task.agent);
      clearMessages();
      setRunning(true);
      wsManager.send({ type: 'run_task', taskId: id });
    } else if (
      task.status === 'awaiting_confirmation'
    ) {
      setSelectedTaskId(id);
      setShowTaskDetail(true);
    } else if (task.status === 'todo' || task.status === 'review' || task.status === 'planned') {
      setSelectedTaskId(id);
      setChatAgent(task.agent);
      clearMessages();
      setRunning(true);
      wsManager.send({ type: 'run_task', taskId: id });
    }
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
            <span className="kanban-sub">{tasks.length} total · {runningCount} active</span>
          </div>
          <div className="kanban-actions">
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
              <div className="col-body">
                {grouped[col.id]?.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={selectedTaskId === task.id}
                    onSelect={handleSelect}
                    onAction={handleAction}
                  />
                ))}
                {(grouped[col.id]?.length ?? 0) === 0 && <div className="col-empty">—</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {showTaskDetail && selectedTaskId && (
        <TaskDetail taskId={selectedTaskId} onClose={() => setShowTaskDetail(false)} />
      )}
    </section>
  );
}
