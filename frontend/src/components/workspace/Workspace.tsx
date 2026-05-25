import React from 'react';
import { useStore } from '../../store/useStore';
import { WorkspaceViewId } from '../../types';
import KanbanBoard from '../kanban/KanbanBoard';
import TaskDetailHost from '../kanban/TaskDetailHost';
import ChatPanel from '../chat/ChatPanel';
import MemoryView from '../views/MemoryView';
import AgentsView from '../views/AgentsView';
import PRDView from '../views/PRDView';
import GoalsView from '../views/GoalsView';
import SkillsView from '../views/SkillsView';
import WorkflowsView from '../views/WorkflowsView';
import SettingsView from '../views/SettingsView';

function ViewContent({ view }: { view: WorkspaceViewId }) {
  switch (view) {
    case 'tasks':
      return <KanbanBoard />;
    case 'chat':
      return <ChatPanel />;
    case 'memory':
      return <MemoryView />;
    case 'agents':
      return <AgentsView />;
    case 'skills':
      return <SkillsView />;
    case 'workflows':
      return <WorkflowsView />;
    case 'prd':
      return <PRDView />;
    case 'goals':
      return <GoalsView />;
    case 'settings':
      return <SettingsView />;
    case 'task':
      return null;
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
  const tasks = useStore(s => s.tasks);

  const activeTab = workspaceTabs.find(t => t.id === activeTabId) ?? workspaceTabs[0];
  const activeView = activeTab?.view ?? 'tasks';
  const tasksInDock = pinnedDock === 'tasks';
  const isTaskTab = activeTab?.view === 'task' && !!activeTab.taskId;

  return (
    <div className="workspace" data-screen-label="workspace">
      <header className="workspace-tabs">
        <div className="workspace-tabs-list">
          {workspaceTabs.map(tab => {
            const task = tab.taskId ? tasks.find(t => t.id === tab.taskId) : null;
            return (
              <div
                key={tab.id}
                className={
                  'workspace-tab'
                  + (tab.id === activeTabId ? ' is-active' : '')
                  + (tab.view === 'task' ? ' workspace-tab--task' : '')
                }
              >
                <button
                  type="button"
                  className="workspace-tab-btn"
                  onClick={() => setActiveTabId(tab.id)}
                  title={tab.view === 'task' ? tab.label : undefined}
                >
                  {tab.view === 'task' && task && (
                    <span className={'status-dot status-' + task.status} />
                  )}
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
            );
          })}
        </div>
        <div className="workspace-tabs-actions">
          {(activeView === 'tasks' || isTaskTab) && (
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
          {isTaskTab && activeTab.taskId ? (
            <TaskDetailHost taskId={activeTab.taskId} tabId={activeTab.id} />
          ) : activeView === 'tasks' && tasksInDock ? (
            <div className="workspace-empty-hint">
              <p>Kanban is pinned in the side panel.</p>
              <button type="button" className="btn" onClick={() => togglePinnedDock('tasks')}>
                Unpin to show here
              </button>
            </div>
          ) : (
            <ViewContent view={activeView} />
          )}
        </div>
      </div>
    </div>
  );
}
