import React from 'react';
import { useStore } from '../../store/useStore';
import Icon from '../common/Icon';

type Props = {
  subtitle?: string;
  showHome?: boolean;
  onHome?: () => void;
};

export default function TitleBar({ subtitle, showHome, onHome }: Props) {
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const wsConnected = useStore(s => s.wsConnected);
  const workspaces = useStore(s => s.workspaces);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);

  const active = workspaces.find(w => w.id === activeWorkspaceId);

  return (
    <div className="titlebar">
      <div className="tb-traffic">
        <div className="tb-light red" />
        <div className="tb-light amber" />
        <div className="tb-light green" />
      </div>
      <div className="tb-brand">
        <div className="tb-brand-mark" />
        <span>Agent Console</span>
      </div>
      <div className="tb-title">{subtitle || active?.name || ''}</div>
      <div className="tb-actions">
        <span
          className="status-pill"
          style={{
            fontSize: 10,
            padding: '2px 8px',
            background: wsConnected ? 'var(--accent-soft)' : 'var(--bg-3)',
            color: wsConnected ? 'var(--accent)' : 'var(--fg-muted)',
          }}
          title={wsConnected ? 'WebSocket connected' : 'Connecting…'}
        >
          {wsConnected ? 'live' : '…'}
        </span>
        {showHome && onHome && (
          <button type="button" className="tb-iconbtn" onClick={onHome} title="Home">
            <Icon name="home" size={15} />
          </button>
        )}
        <button
          type="button"
          className="tb-iconbtn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
        </button>
      </div>
    </div>
  );
}
