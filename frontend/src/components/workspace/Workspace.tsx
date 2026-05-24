import React from 'react';
import { useStore } from '../../store/useStore';
import { WorkspaceViewId } from '../../types';
import KanbanBoard from '../kanban/KanbanBoard';
import ChatPanel from '../chat/ChatPanel';
import MemoryView from '../views/MemoryView';
import AgentsSection from '../sidebar/AgentsSection';
import SkillsSection from '../sidebar/SkillsSection';
import WorkflowsSection from '../sidebar/WorkflowsSection';
import PRDView from '../views/PRDView';
import SettingsView from '../views/SettingsView';

function PanelSection({ children }: { children: React.ReactNode }) {
  return <div className="panel-view">{children}</div>;
}

function ViewContent({ view }: { view: WorkspaceViewId }) {
  switch (view) {
    case 'tasks':
      return <KanbanBoard />;
    case 'chat':
      return <ChatPanel />;
    case 'memory':
      return <MemoryView />;
    case 'agents':
      return (
        <PanelSection>
          <div className="panel-view-hd">
            <h2>Agents</h2>
            <p className="muted">Global and workspace personas</p>
          </div>
          <AgentsSection panel />
        </PanelSection>
      );
    case 'skills':
      return (
        <PanelSection>
          <div className="panel-view-hd">
            <h2>Skills</h2>
            <p className="muted">Reusable prompt components from disk</p>
          </div>
          <SkillsSection panel />
        </PanelSection>
      );
    case 'workflows':
      return (
        <PanelSection>
          <div className="panel-view-hd">
            <h2>Workflows</h2>
            <p className="muted">Execution policies per workspace</p>
          </div>
          <WorkflowsSection panel />
        </PanelSection>
      );
    case 'prd':
      return <PRDView />;
    case 'settings':
      return <SettingsView />;
    default:
      return null;
  }
}

export default function Workspace() {
  const workspaceTabs = useStore(s => s.workspaceTabs);
  const activeTabId = useStore(s => s.activeTabId);
  const pinnedDock = useStore(s => s.pinnedDock);
  const openWorkspaceTab = useStore(s => s.openWorkspaceTab);
  const closeWorkspaceTab = useStore(s => s.closeWorkspaceTab);
  const setActiveTabId = useStore(s => s.setActiveTabId);
  const togglePinnedDock = useStore(s => s.togglePinnedDock);

  const activeTab = workspaceTabs.find(t => t.id === activeTabId) ?? workspaceTabs[0];
  const activeView = activeTab?.view ?? 'tasks';
  const tasksInDock = pinnedDock === 'tasks';
  const showTasksInPane = activeView === 'tasks' && !tasksInDock;

  return (
    <div className="workspace" data-screen-label="workspace">
      <header className="workspace-tabs">
        <div className="workspace-tabs-list">
          {workspaceTabs.map(tab => (
            <div
              key={tab.id}
              className={'workspace-tab' + (tab.id === activeTabId ? ' is-active' : '')}
            >
              <button
                type="button"
                className="workspace-tab-btn"
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </button>
              {tab.closable && (
                <button
                  type="button"
                  className="workspace-tab-close"
                  onClick={() => closeWorkspaceTab(tab.id)}
                  aria-label={`Close ${tab.label}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="workspace-tabs-actions">
          {activeView === 'tasks' && (
            <button
              type="button"
              className={'btn btn-sm' + (tasksInDock ? ' is-on' : '')}
              onClick={() => togglePinnedDock('tasks')}
              title={tasksInDock ? 'Unpin kanban' : 'Pin kanban to side'}
            >
              {tasksInDock ? '⊟ Unpin' : '⊞ Pin board'}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={() => openWorkspaceTab('chat')}>
            + Chat
          </button>
        </div>
      </header>

      <div className="workspace-body">
        {tasksInDock && (
          <aside className="workspace-dock">
            <div className="workspace-dock-hd">
              <span>Tasks</span>
              <button type="button" className="icon-btn" onClick={() => togglePinnedDock('tasks')}>✕</button>
            </div>
            <KanbanBoard docked />
          </aside>
        )}

        <div className="workspace-pane">
          {activeView === 'tasks' && tasksInDock ? (
            <div className="workspace-empty-hint">
              <p>Kanban is pinned in the side panel.</p>
              <button type="button" className="btn" onClick={() => togglePinnedDock('tasks')}>
                Unpin to show here
              </button>
            </div>
          ) : showTasksInPane || activeView !== 'tasks' ? (
            <ViewContent view={activeView} />
          ) : (
            <ViewContent view={activeView} />
          )}
        </div>
      </div>
    </div>
  );
}
