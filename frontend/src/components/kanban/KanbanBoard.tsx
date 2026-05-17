import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import TaskCard from './TaskCard';
import { wsManager } from '../../api/client';
import { updateTask } from '../../api/client';

const COLUMNS = [
  { id: 'todo' as const,    label: 'Todo',    hue: 'var(--muted)' },
  { id: 'running' as const, label: 'Running', hue: 'var(--accent)' },
  { id: 'review' as const,  label: 'Review',  hue: 'var(--amber)' },
  { id: 'done' as const,    label: 'Done',    hue: 'var(--green)' },
];

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={pulse ? 'dot pulse' : 'dot'}
      style={{ background: color }}
    />
  );
}

function ThemeToggle() {
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const isDark = theme === 'dark';
  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light' : 'Switch to dark'}
      aria-label="Toggle theme"
    >
      <span className={'theme-track' + (isDark ? ' is-dark' : '')}>
        <span className="theme-knob">
          <span className="theme-glyph theme-glyph--sun">☀</span>
          <span className="theme-glyph theme-glyph--moon">☾</span>
        </span>
      </span>
    </button>
  );
}

export default function KanbanBoard() {
  const tasks = useStore(s => s.tasks);
  const selectedTask = useStore(s => s.selectedTask);
  const searchQuery = useStore(s => s.searchQuery);
  const setSelectedTask = useStore(s => s.setSelectedTask);
  const setChatAgent = useStore(s => s.setChatAgent);
  const setModal = useStore(s => s.setModal);
  const setSearchQuery = useStore(s => s.setSearchQuery);
  const storeUpdateTask = useStore(s => s.updateTask);
  const setRunning = useStore(s => s.setRunning);
  const clearMessages = useStore(s => s.clearMessages);

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.agent.toLowerCase().includes(q) ||
      t.workspace.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof tasks> = { todo: [], running: [], review: [], done: [] };
    filteredTasks.forEach(t => {
      if (g[t.status]) g[t.status].push(t);
    });
    return g;
  }, [filteredTasks]);

  const handleSelect = (id: string) => {
    setSelectedTask(id);
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
      // Stop
      wsManager.send({ type: 'stop' });
      const updated = { ...task, status: 'review' as const, updatedAt: new Date().toISOString() };
      storeUpdateTask(updated);
      try { await updateTask(id, { status: 'review' }); } catch {}
      setRunning(false);
    } else if (task.status === 'todo' || task.status === 'review') {
      // Run via WebSocket
      setSelectedTask(id);
      setChatAgent(task.agent);
      clearMessages();
      wsManager.send({ type: 'run_task', taskId: id });
    }
  };

  const runningCount = tasks.filter(t => t.status === 'running').length;

  return (
    <section className="kanban" data-screen-label="kanban">
      <header className="kanban-hd">
        <div className="kanban-title">
          <h1>Tasks</h1>
          <span className="kanban-sub">
            {tasks.length} total · {runningCount} active
          </span>
        </div>
        <div className="kanban-actions">
          <div className="search">
            <span className="search-glyph">⌕</span>
            <input
              placeholder="Filter tasks…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <span className="kbd">⌘K</span>
          </div>
          <ThemeToggle />
          <button className="btn btn-primary" onClick={() => setModal('task')}>
            <span className="btn-glyph">+</span>
            New task
          </button>
        </div>
      </header>

      <div className="cols">
        {COLUMNS.map(col => (
          <div className="col" key={col.id} data-screen-label={`col-${col.id}`}>
            <div className="col-hd">
              <span className="col-title">
                <Dot color={col.hue} pulse={col.id === 'running'} />
                {col.label}
              </span>
              <span className="col-count">{grouped[col.id]?.length ?? 0}</span>
            </div>
            <div className="col-body">
              {grouped[col.id]?.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  selected={selectedTask === task.id}
                  onSelect={handleSelect}
                  onAction={handleAction}
                />
              ))}
              {(grouped[col.id]?.length ?? 0) === 0 && (
                <div className="col-empty">—</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
