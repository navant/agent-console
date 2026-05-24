import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { getConfig, updatePathSettings } from '../../api/client';
import { PathSettings } from '../../types';
import { DEFAULT_PATH_SETTINGS } from '../../constants/paths';
import TaskTypeConfigPanel from '../settings/TaskTypeConfigPanel';

const FIELDS: { key: keyof PathSettings; label: string; hint: string }[] = [
  { key: 'prd', label: 'PRD', hint: 'Workspace-relative folder for PRD markdown files' },
  { key: 'tasks', label: 'Tasks', hint: 'Task folders (task.json, progress.txt)' },
  { key: 'agents', label: 'Agents (workspace)', hint: 'Workspace-local agent .md files' },
  { key: 'skills', label: 'Skills (workspace)', hint: 'Workspace-local skills' },
  { key: 'workflows', label: 'Workflows', hint: 'WORKFLOW.md definitions' },
  { key: 'memory', label: 'Memory', hint: 'Memory folder (markdown files)' },
  { key: 'globalAgents', label: 'Global agents', hint: 'Shared agents path (e.g. ~/.claude/agents)' },
  { key: 'globalSkills', label: 'Global skills', hint: 'Shared skills path (e.g. ~/.claude/skills)' },
];

type SettingsTab = 'paths' | 'task-types';

export default function SettingsView() {
  const pathSettings = useStore(s => s.pathSettings);
  const setPathSettings = useStore(s => s.setPathSettings);
  const [tab, setTab] = useState<SettingsTab>('paths');
  const [draft, setDraft] = useState<PathSettings>(pathSettings ?? DEFAULT_PATH_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  return (
    <div className="settings-view panel-view">
      <header className="panel-view-hd">
        <div>
          <h2>Settings</h2>
          <p className="muted">Paths and task type presets for this workspace.</p>
        </div>
      </header>

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
