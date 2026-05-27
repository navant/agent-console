import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import Icon from '../common/Icon';

type Props = {
  onCancel: () => void;
  onReady: () => void;
};

export default function WorkspacePickerModal({ onCancel, onReady }: Props) {
  const workspaces = useStore(s => s.workspaces);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const switchWorkspace = useStore(s => s.switchWorkspace);
  const setModal = useStore(s => s.setModal);
  const pendingHomeCap = useStore(s => s.pendingHomeCap);
  const openFromHome = useStore(s => s.openFromHome);
  const setPendingHomeCap = useStore(s => s.setPendingHomeCap);

  const initialIdx = Math.max(
    0,
    workspaces.findIndex(w => w.id === activeWorkspaceId),
  );
  const [sel, setSel] = useState(initialIdx >= 0 ? initialIdx : 0);

  const pick = async () => {
    const ws = workspaces[sel];
    if (!ws) {
      setModal('workspace');
      onCancel();
      return;
    }
    if (ws.id !== activeWorkspaceId) {
      await switchWorkspace(ws.id);
    }
    const cap = pendingHomeCap;
    setPendingHomeCap(null);
    onReady();
    if (cap) {
      openFromHome(cap);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Select a workspace</h2>
          <p>Choose a project folder before opening a capability.</p>
        </div>
        <div className="modal-body">
          {workspaces.length === 0 ? (
            <p className="muted" style={{ padding: '12px 0' }}>
              No workspaces yet. Add one to continue.
            </p>
          ) : (
            workspaces.map((f, i) => (
              <div
                key={f.id}
                className={`folder-row ${i === sel ? 'sel' : ''}`}
                onClick={() => setSel(i)}
                onKeyDown={e => e.key === 'Enter' && setSel(i)}
                role="button"
                tabIndex={0}
              >
                <Icon name="folder" size={16} className="ico" />
                <div>
                  <div style={{ fontWeight: 500 }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{f.id}</div>
                </div>
                <div className="path">{f.path}</div>
              </div>
            ))
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={() => setModal('workspace')}>
            <Icon name="plus" size={14} /> Add workspace
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={workspaces.length === 0}
            onClick={() => void pick()}
          >
            Open workspace <Icon name="arrow-right" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
