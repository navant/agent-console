import React from 'react';
import { useStore } from '../../store/useStore';
import WorkspaceSelector from '../sidebar/WorkspaceSelector';
import TasksSection from '../sidebar/TasksSection';
import ThemeToggle from '../common/ThemeToggle';
import { WorkspaceViewId } from '../../types';

const NAV: { view: WorkspaceViewId; label: string; glyph: string }[] = [
  { view: 'goals', label: 'Goals', glyph: '◎' },
  { view: 'prd', label: 'Planning', glyph: '≡' },
  { view: 'tasks', label: 'Tasks', glyph: '▦' },
  { view: 'chat', label: 'Chat', glyph: '◻' },
  { view: 'memory', label: 'Memory', glyph: '◇' },
  { view: 'agents', label: 'Agents', glyph: '◉' },
  { view: 'skills', label: 'Skills', glyph: '◈' },
  { view: 'workflows', label: 'Workflows', glyph: '↻' },
  { view: 'settings', label: 'Settings', glyph: '⚙' },
];

export default function SidebarNav() {
  const wsConnected = useStore(s => s.wsConnected);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const workspaces = useStore(s => s.workspaces);
  const workspaceTabs = useStore(s => s.workspaceTabs);
  const activeTabId = useStore(s => s.activeTabId);
  const pinnedDock = useStore(s => s.pinnedDock);
  const openWorkspaceTab = useStore(s => s.openWorkspaceTab);
  const togglePinnedDock = useStore(s => s.togglePinnedDock);
  const setModal = useStore(s => s.setModal);

  const active = workspaces.find(w => w.id === activeWorkspaceId);
  const activeTab = workspaceTabs.find(t => t.id === activeTabId);

  return (
    <aside className="sidebar sidebar-nav" data-screen-label="sidebar">
      <div className="brand">
        <div className="brand-mark">◆</div>
        <div className="brand-text">
          <div className="brand-title">Coding Harness</div>
          <div className="brand-sub">
            {active?.name ?? 'no workspace'} · {wsConnected ? 'connected' : '…'}
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="ws-block">
        <WorkspaceSelector />
      </div>

      <nav className="side-nav">
        <div className="side-nav-hd">Open in workspace</div>
        {NAV.map(item => {
          const isActive = activeTab?.view === item.view;
          const isPinned = pinnedDock === item.view;
          return (
            <div key={item.view} className="side-nav-row">
              <button
                type="button"
                className={'side-nav-btn' + (isActive ? ' is-active' : '')}
                onClick={() => openWorkspaceTab(item.view)}
              >
                <span className="side-nav-glyph">{item.glyph}</span>
                <span>{item.label}</span>
              </button>
              {item.view === 'tasks' && (
                <button
                  type="button"
                  className={'side-nav-pin' + (isPinned ? ' is-on' : '')}
                  title={isPinned ? 'Unpin kanban' : 'Pin kanban'}
                  onClick={() => togglePinnedDock('tasks')}
                >
                  ⊞
                </button>
              )}
            </div>
          );
        })}
      </nav>

      <div className="side-nav-tasks">
        <TasksSection compact />
      </div>

      <div className="side-footer">
        <button type="button" className="btn btn-sm" onClick={() => setModal('task')}>+ Task</button>
        <span className="ok-dot" title="WebSocket">●</span>
      </div>
    </aside>
  );
}
