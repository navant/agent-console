import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { setupConsole as runSetupConsole } from '../../api/client';
import Icon from '../common/Icon';
import WorkspaceSelector from '../sidebar/WorkspaceSelector';

export default function SetupWorkspaceView() {
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const workspaces = useStore(s => s.workspaces);
  const loadWorkspaceData = useStore(s => s.loadWorkspaceData);
  const setModal = useStore(s => s.setModal);

  const [setupRunning, setSetupRunning] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  const runSetup = async () => {
    if (!activeWorkspaceId) {
      setSetupError('Add and select a workspace first.');
      return;
    }
    setSetupRunning(true);
    setSetupError(null);
    setSetupMessage(null);
    try {
      const result = await runSetupConsole();
      await loadWorkspaceData();
      const copied = result.agents.copied.length + result.skills.copied.length;
      const skipped = result.agents.skipped.length + result.skills.skipped.length;
      setSetupMessage(
        `Copied ${copied} item${copied === 1 ? '' : 's'} `
        + `(${result.agents.copied.length} agents, ${result.skills.copied.length} skills). `
        + `${skipped} already existed and were left unchanged.`,
      );
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : String(err));
    } finally {
      setSetupRunning(false);
    }
  };

  return (
    <div className="panel-view setup-workspace-view" style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <header className="panel-view-hd">
        <div>
          <h2>Setup workspace</h2>
          <p className="muted">
            Register a project folder and copy bundled agents and skills from app templates.
          </p>
        </div>
      </header>

      <section className="settings-setup-card" style={{ marginBottom: 20 }}>
        <div className="section-label">Workspace</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <WorkspaceSelector />
          <button type="button" className="btn btn-ghost" onClick={() => setModal('workspace')}>
            <Icon name="plus" size={14} /> Add
          </button>
        </div>
      </section>

      <section className="settings-setup-card">
        <div>
          <h3 className="settings-setup-title">Copy templates</h3>
          <p className="muted settings-setup-desc">
            Copy bundled agents and skills into
            {activeWorkspace ? (
              <> <span className="mono">{activeWorkspace.path}</span></>
            ) : (
              ' the active workspace'
            )}
            . Existing files are never overwritten.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void runSetup()}
          disabled={setupRunning || !activeWorkspaceId}
        >
          {setupRunning ? 'Setting up…' : 'Run setup'}
        </button>
        {setupMessage && <p className="settings-setup-msg">{setupMessage}</p>}
        {setupError && <p className="settings-setup-error">{setupError}</p>}
      </section>
    </div>
  );
}
