import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';

export default function WorkspaceSelector() {
  const workspaces = useStore(s => s.workspaces);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const workspaceSaving = useStore(s => s.workspaceSaving);
  const switchWorkspace = useStore(s => s.switchWorkspace);
  const loadAll = useStore(s => s.loadAll);
  const setModal = useStore(s => s.setModal);

  const active = workspaces.find(w => w.id === activeWorkspaceId);

  // Recover if store is out of sync with backend
  useEffect(() => {
    if (activeWorkspaceId && workspaces.length === 0) {
      loadAll();
    }
  }, [activeWorkspaceId, workspaces.length, loadAll]);

  return (
    <div className="ws-selector">
      <div className="ws-select-row">
        <select
          className="ws-select text"
          value={workspaces.some(w => w.id === activeWorkspaceId) ? (activeWorkspaceId ?? '') : ''}
          onChange={e => {
            if (e.target.value) switchWorkspace(e.target.value);
          }}
          disabled={workspaceSaving || workspaces.length === 0}
        >
          {workspaces.length === 0 && (
            <option value="">{workspaceSaving ? 'Loading…' : 'No workspaces'}</option>
          )}
          {workspaces.map(ws => (
            <option key={ws.id} value={ws.id}>{ws.name}</option>
          ))}
        </select>
        {workspaceSaving && <span className="spinner spinner--inline ws-spinner" title="Loading workspace" />}
        <button
          className="icon-btn"
          title="Add workspace"
          onClick={() => setModal('workspace')}
          disabled={workspaceSaving}
        >
          +
        </button>
      </div>
      {active && (
        <div className="ws-path mono">{active.path}</div>
      )}
    </div>
  );
}
