import React, { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { HomeCapabilityId } from '../../types';
import { getSessions, SessionSummary } from '../../api/client';
import Icon, { IconName } from '../common/Icon';
import TitleBar from './TitleBar';
import WorkspacePickerModal from './WorkspacePickerModal';

const CAPABILITIES: {
  id: HomeCapabilityId;
  title: string;
  icon: IconName;
  desc: string;
  featured?: boolean;
}[] = [
  {
    id: 'chat',
    featured: true,
    title: 'Chat',
    icon: 'chat',
    desc: 'Talk to your agent. Plan, ask, run slash commands, and attach context from tasks.',
  },
  {
    id: 'tasks',
    title: 'Tasks',
    icon: 'kanban',
    desc: 'Hand off multi-step work. Track every job on the Kanban board.',
  },
  {
    id: 'setup',
    title: 'Setup workspace',
    icon: 'folder-open',
    desc: 'Register a folder and copy bundled agents, skills, and templates into it.',
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: 'settings',
    desc: 'Paths, task types, memory, agents, skills, and workflows.',
  },
  {
    id: 'goals',
    title: 'Goals',
    icon: 'target',
    desc: 'Goal markdown files and invoke-to-task flows.',
  },
  {
    id: 'prd',
    title: 'Planning',
    icon: 'list',
    desc: 'PRD documents, editing, and expand-with-skill to create tasks.',
  },
];

export default function StudioHome() {
  const openFromHome = useStore(s => s.openFromHome);
  const workspacePickerOpen = useStore(s => s.workspacePickerOpen);
  const setWorkspacePickerOpen = useStore(s => s.setWorkspacePickerOpen);
  const tasks = useStore(s => s.tasks);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);

  const [recentTab, setRecentTab] = useState<'chats' | 'tasks'>('chats');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  React.useEffect(() => {
    if (!activeWorkspaceId) return;
    getSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [activeWorkspaceId]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const taskRecents = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
        .slice(0, 6),
    [tasks],
  );

  const chatRecents = useMemo(() => sessions.slice(0, 6), [sessions]);

  const openCap = (cap: HomeCapabilityId) => {
    openFromHome(cap);
  };

  return (
    <div className="app">
      <TitleBar />
      <div className="studio">
        <div className="studio-head">
          <div>
            <h1>{greeting()}.</h1>
            <p className="sub">Pick a capability to start, or jump back into a recent session.</p>
          </div>
        </div>
        <div className="studio-body">
          <div className="section-label">Capabilities</div>
          <div className="cap-grid three">
            {CAPABILITIES.map(cap => (
              <button
                key={cap.id}
                type="button"
                className={`cap-card ${cap.featured ? 'featured' : ''}`}
                onClick={() => openCap(cap.id)}
              >
                <div className="cap-icon">
                  <Icon name={cap.icon} size={20} />
                </div>
                <div className="cap-title">{cap.title}</div>
                <p className="cap-desc">{cap.desc}</p>
                <div className="cap-cta">
                  Open {cap.title.toLowerCase()} <Icon name="arrow-right" size={12} />
                </div>
              </button>
            ))}
          </div>

          {activeWorkspaceId && (
            <>
              <div className="recents-head">
                <div className="section-label" style={{ margin: 0 }}>
                  Recent activity
                </div>
                <div className="recents-tabs">
                  {(
                    [
                      { id: 'chats' as const, label: 'Chats', icon: 'chat' as IconName },
                      { id: 'tasks' as const, label: 'Tasks', icon: 'kanban' as IconName },
                    ] as const
                  ).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={`rtab ${recentTab === t.id ? 'on' : ''}`}
                      onClick={() => setRecentTab(t.id)}
                    >
                      <Icon name={t.icon} size={13} /> {t.label}
                      <span className="rtab-count">
                        {t.id === 'chats' ? chatRecents.length : taskRecents.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="recents-list">
                {recentTab === 'chats' &&
                  (chatRecents.length === 0 ? (
                    <div className="recent-row muted">No recent chats</div>
                  ) : (
                    chatRecents.map(s => (
                      <div
                        key={s.sessionId}
                        className="recent-row"
                        onClick={() => openCap('chat')}
                        onKeyDown={e => e.key === 'Enter' && openCap('chat')}
                        role="button"
                        tabIndex={0}
                      >
                        <Icon name="chat" size={14} />
                        <div className="recent-title">{s.aiTitle || s.firstMessage || s.sessionId.slice(0, 12)}</div>
                        <span className="meta">{s.timestamp ? new Date(s.timestamp).toLocaleString() : ''}</span>
                        <Icon name="chevron" size={14} style={{ color: 'var(--fg-muted)' }} />
                      </div>
                    ))
                  ))}
                {recentTab === 'tasks' &&
                  (taskRecents.length === 0 ? (
                    <div className="recent-row muted">No tasks yet</div>
                  ) : (
                    taskRecents.map(t => (
                      <div
                        key={t.id}
                        className="recent-row"
                        onClick={() => openCap('tasks')}
                        onKeyDown={e => e.key === 'Enter' && openCap('tasks')}
                        role="button"
                        tabIndex={0}
                      >
                        <span className={`status-pill ${t.status === 'running' ? 'doing' : t.status === 'todo' || t.status === 'planned' ? 'todo' : t.status === 'done' ? 'done' : 'review'}`}>
                          {t.status}
                        </span>
                        <div className="recent-title">{t.title}</div>
                        <Icon name="chevron" size={14} style={{ color: 'var(--fg-muted)' }} />
                      </div>
                    ))
                  ))}
              </div>
            </>
          )}
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
