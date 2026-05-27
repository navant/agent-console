import React from 'react';
import { useStore } from '../../store/useStore';
import { getSessions, getSessionMessages, SessionSummary } from '../../api/client';
import Icon from '../common/Icon';
import ChatPanel from '../chat/ChatPanel';
import SidePanelHeader from './SidePanelHeader';
import SidebarWorkspacePicker from './SidebarWorkspacePicker';
import { TaskStatus } from '../../types';

type Props = {
  forceCollapsed?: boolean;
};

function taskStatusDot(status: TaskStatus): string {
  if (status === 'running') return 'doing';
  if (status === 'planned' || status === 'todo') return 'todo';
  if (status === 'review' || status === 'awaiting_confirmation') return 'review';
  if (status === 'done') return 'done';
  return 'todo';
}

export default function CoderSidebar({ forceCollapsed = false }: Props) {
  const sideOpen = useStore(s => s.sideOpen);
  const setSideOpen = useStore(s => s.setSideOpen);
  const sidePanel = useStore(s => s.sidePanel);
  const setSidePanel = useStore(s => s.setSidePanel);
  const chatDock = useStore(s => s.chatDock);
  const setChatDock = useStore(s => s.setChatDock);
  const tasks = useStore(s => s.tasks);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const openWorkspaceTab = useStore(s => s.openWorkspaceTab);
  const openTaskTab = useStore(s => s.openTaskTab);
  const goHome = useStore(s => s.goHome);
  const setCurrentSessionId = useStore(s => s.setCurrentSessionId);
  const setSelectedTaskId = useStore(s => s.setSelectedTaskId);
  const setChatAgent = useStore(s => s.setChatAgent);
  const clearMessages = useStore(s => s.clearMessages);
  const addMessage = useStore(s => s.addMessage);
  const setChatSkillBootstrap = useStore(s => s.setChatSkillBootstrap);
  const currentSessionId = useStore(s => s.currentSessionId);

  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);

  React.useEffect(() => {
    if (!activeWorkspaceId) return;
    getSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [activeWorkspaceId]);

  const resumeSession = async (s: SessionSummary) => {
    const linkedTask = tasks.find(t => t.session_id === s.sessionId);
    setChatDock('center');
    openWorkspaceTab('chat');
    clearMessages();
    if (linkedTask) {
      setSelectedTaskId(linkedTask.id);
      setChatAgent(linkedTask.agent);
      setChatSkillBootstrap((linkedTask.skills?.length ?? 0) > 0);
    } else {
      setSelectedTaskId(null);
      setChatSkillBootstrap(false);
    }
    setCurrentSessionId(s.sessionId);
    try {
      const history = await getSessionMessages(s.sessionId);
      history.forEach(m => {
        addMessage({ type: m.type, text: m.text, tool: m.tool, input: m.input });
      });
    } catch {
      addMessage({ type: 'system', text: `Could not load session ${s.sessionId.slice(0, 8)}…` });
    }
  };

  const openRail = (panel: 'chats' | 'tasks') => {
    setSidePanel(panel);
    if (forceCollapsed) {
      openWorkspaceTab(panel === 'chats' ? 'chat' : 'tasks');
      return;
    }
    setSideOpen(true);
  };

  if (forceCollapsed || !sideOpen) {
    return (
      <aside className={`sidebar collapsed ${chatDock === 'side' ? 'has-docked-chat' : ''}`}>
        <div className="side-rail">
          <button
            type="button"
            className="rail-btn"
            title={forceCollapsed ? 'Expand in a tab' : 'Expand sidebar'}
            onClick={() => !forceCollapsed && setSideOpen(true)}
          >
            <Icon name="panel-right" size={16} />
          </button>
          <button
            type="button"
            className={`rail-btn ${sidePanel === 'chats' ? 'active' : ''}`}
            title="Chats"
            onClick={() => openRail('chats')}
          >
            <Icon name="chat" size={16} />
          </button>
          <button
            type="button"
            className={`rail-btn ${sidePanel === 'tasks' ? 'active' : ''}`}
            title="Tasks"
            onClick={() => openRail('tasks')}
          >
            <Icon name="kanban" size={16} />
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="rail-btn"
            title="Settings"
            onClick={() => openWorkspaceTab('settings')}
          >
            <Icon name="settings" size={16} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={`sidebar ${chatDock === 'side' ? 'sidebar--chat-docked' : ''}`}>
      <div className="side-head">
        <SidebarWorkspacePicker />
        <button type="button" className="tb-iconbtn" title="Collapse" onClick={() => setSideOpen(false)}>
          <Icon name="panel" size={14} />
        </button>
      </div>

      <div className="side-tabs">
        <button
          type="button"
          className={`side-tab ${sidePanel === 'chats' ? 'active' : ''}`}
          onClick={() => setSidePanel('chats')}
        >
          <Icon name="chat" size={12} /> <span className="side-tab-label">Chats</span>
          <span className="count">{sessions.length > 99 ? '99+' : sessions.length}</span>
        </button>
        <button
          type="button"
          className={`side-tab ${sidePanel === 'tasks' ? 'active' : ''}`}
          onClick={() => setSidePanel('tasks')}
        >
          <Icon name="kanban" size={12} /> <span className="side-tab-label">Tasks</span>
          <span className="count">{tasks.length > 99 ? '99+' : tasks.length}</span>
        </button>
      </div>

      <div className="side-body">
        {chatDock === 'side' ? (
          <div className="sidebar-docked-chat sidebar-docked-chat--fill">
            <ChatPanel embedded />
          </div>
        ) : sidePanel === 'chats' ? (
          <div className="list">
            <SidePanelHeader
              title="Chats"
              subtitle={`${sessions.length} conversation${sessions.length === 1 ? '' : 's'}`}
              icon="chat"
              action={
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setChatDock('center');
                    openWorkspaceTab('chat');
                  }}
                >
                  <Icon name="plus" size={11} /> New
                </button>
              }
            />
            {sessions.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--fg-muted)' }}>
                No sessions yet. Start a new chat in the main panel.
              </div>
            ) : (
              sessions.map(s => (
                <div
                  key={s.sessionId}
                  className={`list-item ${currentSessionId === s.sessionId ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => void resumeSession(s)}
                  onKeyDown={e => e.key === 'Enter' && void resumeSession(s)}
                >
                  <div className="title">{s.aiTitle || s.firstMessage || s.sessionId.slice(0, 12)}</div>
                  <div className="sub">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      {s.sessionId.slice(0, 10)}…
                    </span>
                    {s.timestamp && (
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="history" size={10} />
                        {new Date(s.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="list">
            <SidePanelHeader
              title="Tasks"
              subtitle={`${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
              icon="kanban"
              action={
                <button type="button" className="btn btn-sm" onClick={() => openWorkspaceTab('tasks')}>
                  <Icon name="expand" size={11} /> Board
                </button>
              }
            />
            {tasks.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--fg-muted)' }}>
                No tasks yet.
              </div>
            ) : (
              tasks.slice(0, 30).map(t => (
                <div
                  key={t.id}
                  className="list-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => openTaskTab(t.id)}
                  onKeyDown={e => e.key === 'Enter' && openTaskTab(t.id)}
                >
                  <div className="title">{t.title}</div>
                  <div className="sub">
                    <span className={`dot ${taskStatusDot(t.status)}`} />
                    <span style={{ textTransform: 'capitalize' }}>{t.status.replace(/_/g, ' ')}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      {t.id}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="side-foot">
        <button type="button" className="tb-iconbtn" title="Home" onClick={goHome}>
          <Icon name="home" size={14} />
        </button>
      </div>
    </aside>
  );
}
