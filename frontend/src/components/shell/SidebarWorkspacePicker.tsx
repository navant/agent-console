import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import Icon from '../common/Icon';

function basename(path: string): string {
  const parts = path.replace(/\/$/, '').split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export default function SidebarWorkspacePicker() {
  const workspaces = useStore(s => s.workspaces);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const workspaceSaving = useStore(s => s.workspaceSaving);
  const switchWorkspace = useStore(s => s.switchWorkspace);
  const setModal = useStore(s => s.setModal);
  const setWorkspacePickerOpen = useStore(s => s.setWorkspacePickerOpen);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = workspaces.find(w => w.id === activeWorkspaceId);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (id: string) => {
    setOpen(false);
    if (id !== activeWorkspaceId) void switchWorkspace(id);
  };

  return (
    <div className="side-head-ws" ref={ref} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button
        type="button"
        className="side-ws"
        title={active?.path || 'Select workspace'}
        onClick={() => setOpen(o => !o)}
        disabled={workspaceSaving}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Icon name="folder" size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div className="name">{active?.name || 'Select workspace'}</div>
          <div className="path">
            {active ? basename(active.path) : workspaces.length === 0 ? 'No workspace' : 'Choose folder…'}
          </div>
        </div>
        <Icon name="chev-down" size={12} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
      </button>

      {open && (
        <div className="popover" style={{ top: 'calc(100% + 4px)', left: 0, right: 0, minWidth: 0 }} role="listbox">
          <div className="lbl">Workspaces</div>
          {workspaces.length === 0 && (
            <div className="item" role="option" onClick={() => { setOpen(false); setWorkspacePickerOpen(true); }}>
              <Icon name="folder-open" size={14} />
              <div>
                <div>Choose workspace folder</div>
                <span className="desc">Required to use chat and tasks</span>
              </div>
            </div>
          )}
          {workspaces.map(ws => (
            <div
              key={ws.id}
              className={`item ${ws.id === activeWorkspaceId ? 'sel' : ''}`}
              role="option"
              aria-selected={ws.id === activeWorkspaceId}
              onClick={() => pick(ws.id)}
              onKeyDown={e => e.key === 'Enter' && pick(ws.id)}
              tabIndex={0}
            >
              <Icon name="folder" size={14} style={{ color: 'var(--accent)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{ws.name}</div>
                <span className="desc mono" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ws.path}
                </span>
              </div>
              {ws.id === activeWorkspaceId && <Icon name="check" size={13} />}
            </div>
          ))}
          <div className="sep" />
          <div
            className="item"
            role="option"
            onClick={() => {
              setOpen(false);
              setModal('workspace');
            }}
            onKeyDown={e => e.key === 'Enter' && setModal('workspace')}
            tabIndex={0}
          >
            <Icon name="plus" size={14} />
            <div>Add workspace</div>
          </div>
        </div>
      )}
    </div>
  );
}
