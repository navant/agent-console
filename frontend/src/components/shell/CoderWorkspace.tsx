import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { WorkspaceViewId } from '../../types';
import Icon, { IconName } from '../common/Icon';
import TitleBar from './TitleBar';
import CoderSidebar from './CoderSidebar';
import KanbanBoard from '../kanban/KanbanBoard';
import TaskDetailHost from '../kanban/TaskDetailHost';
import ChatPanel from '../chat/ChatPanel';
import GoalsView from '../views/GoalsView';
import PRDView from '../views/PRDView';
import SetupWorkspaceView from './SetupWorkspaceView';
import SettingsShell from './SettingsShell';
import WorkspacePickerModal from './WorkspacePickerModal';

const TAB_ADD_OPTIONS: { view: WorkspaceViewId; title: string; icon: IconName }[] = [
  { view: 'chat', title: 'Chat', icon: 'chat' },
  { view: 'tasks', title: 'Tasks', icon: 'kanban' },
  { view: 'goals', title: 'Goals', icon: 'target' },
  { view: 'prd', title: 'Planning', icon: 'list' },
  { view: 'setup', title: 'Setup', icon: 'folder-open' },
  { view: 'settings', title: 'Settings', icon: 'settings' },
];

function TabContent({ view, taskId }: { view: WorkspaceViewId; taskId?: string }) {
  const chatDock = useStore(s => s.chatDock);

  if (view === 'task' && taskId) {
    return <TaskDetailHost taskId={taskId} tabId={`tab-task-${taskId}`} />;
  }
  if (view === 'chat') {
    return chatDock === 'center' ? <ChatPanel /> : <ChatDockPlaceholder />;
  }
  if (view === 'tasks') return <KanbanBoard />;
  if (view === 'setup') return <SetupWorkspaceView />;
  if (view === 'settings') return <SettingsShell />;
  if (view === 'goals') return <GoalsView />;
  if (view === 'prd') return <PRDView />;
  return null;
}

function ChatDockPlaceholder() {
  const setChatDock = useStore(s => s.setChatDock);
  const openWorkspaceTab = useStore(s => s.openWorkspaceTab);

  return (
    <div className="empty">
      <div className="empty-inner">
        <div
          className="cap-icon"
          style={{
            margin: '0 auto 16px',
            width: 48,
            height: 48,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            color: 'var(--accent-fg)',
          }}
        >
          <Icon name="chat" size={22} />
        </div>
        <h2>Chat is docked to the sidebar</h2>
        <p>Open chat in the center or use the sidebar panel.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setChatDock('center');
            openWorkspaceTab('chat');
          }}
        >
          <Icon name="panel" size={14} /> Dock chat to center
        </button>
      </div>
    </div>
  );
}

function viewIcon(view: WorkspaceViewId): IconName {
  const map: Partial<Record<WorkspaceViewId, IconName>> = {
    chat: 'chat',
    tasks: 'kanban',
    task: 'list',
    settings: 'settings',
    setup: 'folder-open',
    goals: 'target',
    prd: 'list',
  };
  return map[view] ?? 'file';
}

export default function CoderWorkspace() {
  const workspaceTabs = useStore(s => s.workspaceTabs);
  const activeTabId = useStore(s => s.activeTabId);
  const closeWorkspaceTab = useStore(s => s.closeWorkspaceTab);
  const openWorkspaceTab = useStore(s => s.openWorkspaceTab);
  const setActiveTab = useStore(s => s.setActiveTabId);
  const chatDock = useStore(s => s.chatDock);
  const setChatDock = useStore(s => s.setChatDock);
  const goHome = useStore(s => s.goHome);
  const workspacePickerOpen = useStore(s => s.workspacePickerOpen);
  const setWorkspacePickerOpen = useStore(s => s.setWorkspacePickerOpen);
  const workspaces = useStore(s => s.workspaces);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);

  const sideOpen = useStore(s => s.sideOpen);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const activeTab = workspaceTabs.find(t => t.id === activeTabId) ?? workspaceTabs[0];
  const isSettings = activeTab?.view === 'settings';
  /** Grid rail width — user collapsed sidebar or settings mode */
  const gridCollapsed = isSettings || !sideOpen;
  const hasChatTab = workspaceTabs.some(t => t.view === 'chat');

  useEffect(() => {
    if (!addOpen) return;
    const onDown = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [addOpen]);

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);

  return (
    <div className="app">
      <TitleBar subtitle={activeWs?.name || 'Workspace'} showHome onHome={goHome} />
      <div
        className={`coder-workspace ${gridCollapsed ? 'collapsed' : ''} ${sideOpen && !isSettings ? 'side-expanded' : ''} ${chatDock === 'side' ? 'chat-docked-side' : ''}`}
      >
        <CoderSidebar forceCollapsed={isSettings} />
        <div className="center">
          <div className="tabbar">
            {workspaceTabs.map(t => (
              <button
                key={t.id}
                type="button"
                className={`tab ${activeTabId === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon name={viewIcon(t.view)} size={13} />
                <span className="tab-label">{t.label}</span>
                {t.closable && (
                  <span
                    className="x"
                    onClick={e => {
                      e.stopPropagation();
                      closeWorkspaceTab(t.id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && closeWorkspaceTab(t.id)}
                  >
                    <Icon name="x" size={11} />
                  </span>
                )}
              </button>
            ))}
            <div ref={addRef} style={{ position: 'relative' }}>
              <button type="button" className="tab-add" title="Open a new tab" onClick={() => setAddOpen(o => !o)}>
                <Icon name="plus" size={14} />
              </button>
              {addOpen && (
                <div className="popover" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: 240 }}>
                  <div className="lbl">Open a new tab</div>
                  {TAB_ADD_OPTIONS.map(opt => (
                    <div
                      key={opt.view}
                      className="item"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setAddOpen(false);
                        if (opt.view === 'chat') setChatDock('center');
                        openWorkspaceTab(opt.view);
                      }}
                      onKeyDown={e => e.key === 'Enter' && openWorkspaceTab(opt.view)}
                    >
                      <Icon name={opt.icon} size={14} />
                      <div>
                        <div>{opt.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="tabbar-right">
              {chatDock === 'center' && hasChatTab && (
                <button
                  type="button"
                  className="tb-iconbtn"
                  title="Dock chat to sidebar"
                  onClick={() => {
                    setChatDock('side');
                    const nonChat = workspaceTabs.find(t => t.view !== 'chat');
                    if (nonChat) setActiveTab(nonChat.id);
                  }}
                >
                  <Icon name="panel-right" size={15} />
                </button>
              )}
              {chatDock === 'side' && (
                <button
                  type="button"
                  className="tb-iconbtn"
                  title="Dock chat to center"
                  onClick={() => {
                    setChatDock('center');
                    openWorkspaceTab('chat');
                  }}
                >
                  <Icon name="panel" size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="tab-panel">
            {activeTab ? (
              <TabContent view={activeTab.view} taskId={activeTab.taskId} />
            ) : (
              <div className="empty">
                <div className="empty-inner">
                  <h2>No open tabs</h2>
                  <p>Open chat or tasks from the sidebar or home.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {workspacePickerOpen && (
        <WorkspacePickerModal
          onCancel={() => setWorkspacePickerOpen(false)}
          onReady={() => setWorkspacePickerOpen(false)}
        />
      )}
    </div>
  );
}
