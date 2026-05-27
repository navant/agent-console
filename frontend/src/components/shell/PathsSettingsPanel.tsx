import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { getConfig, updatePathSettings } from '../../api/client';
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

type Props = { section: 'paths' | 'task-types' };

export default function PathsSettingsPanel({ section }: Props) {
  const pathSettings = useStore(s => s.pathSettings);
  const setPathSettings = useStore(s => s.setPathSettings);
  const [draft, setDraft] = useState<PathSettings>(pathSettings ?? DEFAULT_PATH_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getConfig()
      .then(c => {
        if (c.pathSettings) {
          setPathSettings(c.pathSettings);
          setDraft(c.pathSettings);
        }
      })
      .catch(() => {});
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

  const reset = () => setDraft({ ...DEFAULT_PATH_SETTINGS });

  if (section === 'task-types') {
    return (
      <div className="settings-embed">
        <TaskTypeConfigPanel />
      </div>
    );
  }

  return (
    <div className="settings-embed">
      <div className="settings-form form-grid">
        {FIELDS.map(({ key, label, hint }) => (
          <div className="field" key={key}>
            <label className="field-lbl">
              <span>{label}</span>
              <span className="field-hint">{hint}</span>
            </label>
            <input
              className="input mono"
              value={draft[key]}
              onChange={e => setDraft({ ...draft, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <footer className="settings-ft" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          Reset defaults
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save paths'}
        </button>
        {saved && <span className="muted">Saved.</span>}
      </footer>
    </div>
  );
}
