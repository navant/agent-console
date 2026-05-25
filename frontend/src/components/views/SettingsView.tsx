import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { getConfig, updatePathSettings, setupHarness as runSetupHarness } from '../../api/client';
import { PathSettings } from '../../types';
import { DEFAULT_PATH_SETTINGS } from '../../constants/paths';
import TaskTypeConfigPanel from '../settings/TaskTypeConfigPanel';

const FIELDS: { key: keyof PathSettings; label: string; hint: string }[] = [
  { key: 'prd', label: 'PRD', hint: 'Workspace-relative folder for PRD markdown files' },
  { key: 'goals', label: 'Goals', hint: 'Workspace-relative folder for goal markdown files' },
  { key: 'tasks', label: 'Tasks', hint: 'Task folders (task.json, progress.txt)' },
  { key: 'agents', label: 'Agents (workspace)', hint: 'Workspace-local agent .md files' },
  { key: 'skills', label: 'Skills (workspace)', hint: 'Workspace-local skills' },
  { key: 'workflows', label: 'Workflows (workspace)', hint: 'Workspace-local WORKFLOW.md folders' },
  { key: 'memory', label: 'Memory', hint: 'Memory folder (markdown files)' },
  { key: 'globalAgents', label: 'Global agents', hint: 'Shared agents path (e.g. ~/.claude/agents)' },
  { key: 'globalSkills', label: 'Global skills', hint: 'Shared skills path (e.g. ~/.claude/skills)' },
  { key: 'globalWorkflows', label: 'Global workflows', hint: 'Shared workflows path (e.g. ~/.claude/workflows)' },
];

type SettingsTab = 'paths' | 'task-types';

export default function SettingsView() {
  const pathSettings = useStore(s => s.pathSettings);
  const setPathSettings = useStore(s => s.setPathSettings);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const workspaces = useStore(s => s.workspaces);
  const loadWorkspaceData = useStore(s => s.loadWorkspaceData);
  const [tab, setTab] = useState<SettingsTab>('paths');
  const [draft, setDraft] = useState<PathSettings>(pathSettings ?? DEFAULT_PATH_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [setupRunning, setSetupRunning] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  useEffect(() => {
    getConfig().then(c => {
      if (c.pathSettings) {
        setPathSettings(c.pathSettings);
        setDraft(c.pathSettings);
      }
    }).catch(() => {});
  }, [setPathSettings]);

  useEffect(() => {
    if (pathSettings) setDraft(pathSettings);
  }, [pathSettings]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updatePathSettings(draft);
      setPathSettings(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDraft({ ...DEFAULT_PATH_SETTINGS });
  };

  const runSetup = async () => {
    if (!activeWorkspaceId) {
      setSetupError('Add and select a workspace first.');
      return;
    }
    setSetupRunning(true);
    setSetupError(null);
    setSetupMessage(null);
    try {
      const result = await runSetupHarness();
      await loadWorkspaceData();
      const copied = result.agents.copied.length + result.skills.copied.length;
      const skipped = result.agents.skipped.length + result.skills.skipped.length;
      setSetupMessage(
        `Copied ${copied} item${copied === 1 ? '' : 's'} `
        + `(${result.agents.copied.length} agents, ${result.skills.copied.length} skills). `
        + `${skipped} already existed and were left unchanged.`
      );
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : String(err));
    } finally {
      setSetupRunning(false);
    }
  };

  return (
    <div className="settings-view panel-view">
      <header className="panel-view-hd">
        <div>
          <h2>Settings</h2>
          <p className="muted">Paths and task type presets for this workspace.</p>
        </div>
      </header>

      <section className="settings-setup-card">
        <div>
          <h3 className="settings-setup-title">Setup Coding Harness</h3>
          <p className="muted settings-setup-desc">
            Copy bundled agents and skills from app templates into
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
          {setupRunning ? 'Setting up…' : 'Setup Coding Harness'}
        </button>
        {setupMessage && <p className="settings-setup-msg">{setupMessage}</p>}
        {setupError && <p className="settings-setup-error">{setupError}</p>}
      </section>

      <nav className="settings-tabs">
        <button
          type="button"
          className={'btn btn-sm' + (tab === 'paths' ? ' is-on' : '')}
          onClick={() => setTab('paths')}
        >
          Paths
        </button>
        <button
          type="button"
          className={'btn btn-sm' + (tab === 'task-types' ? ' is-on' : '')}
          onClick={() => setTab('task-types')}
        >
          Task type config
        </button>
      </nav>

      {tab === 'paths' && (
        <>
          <div className="settings-form form-grid">
            {FIELDS.map(({ key, label, hint }) => (
              <div className="field" key={key}>
                <label className="field-lbl">
                  <span>{label}</span>
                  <span className="field-hint">{hint}</span>
                </label>
                <input
                  className="text mono"
                  value={draft[key]}
                  onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <footer className="settings-ft">
            <button type="button" className="btn btn-sm" onClick={reset}>Reset defaults</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save paths'}
            </button>
            {saved && <span className="muted">Saved — reload workspace data if paths changed.</span>}
          </footer>
        </>
      )}

      {tab === 'task-types' && <TaskTypeConfigPanel />}
    </div>
  );
}
