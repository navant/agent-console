import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { getTaskTypes, saveTaskTypes } from '../../api/client';
import { TaskTypeDef } from '../../types';

function emptyType(): TaskTypeDef {
  return {
    id: '',
    name: '',
    agent: '',
    skills: [],
    workflow: 'single-shot',
    default: false,
  };
}

export default function TaskTypeConfigPanel() {
  const agents = useStore(s => s.agents);
  const skills = useStore(s => s.skills);
  const workflows = useStore(s => s.workflows);
  const taskTypes = useStore(s => s.taskTypes);
  const setTaskTypes = useStore(s => s.setTaskTypes);

  const [draft, setDraft] = useState<TaskTypeDef[]>(taskTypes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getTaskTypes().then(r => {
      setTaskTypes(r.types);
      setDraft(r.types);
    }).catch(() => {});
  }, [setTaskTypes]);

  useEffect(() => {
    if (taskTypes.length) setDraft(taskTypes);
  }, [taskTypes]);

  const updateRow = (index: number, patch: Partial<TaskTypeDef>) => {
    setDraft(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const setDefault = (index: number) => {
    setDraft(prev => prev.map((row, i) => ({ ...row, default: i === index })));
  };

  const addType = () => setDraft(prev => [...prev, emptyType()]);

  const removeType = (index: number) => {
    setDraft(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSkill = (index: number, skillId: string) => {
    setDraft(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const has = row.skills.includes(skillId);
      return {
        ...row,
        skills: has ? row.skills.filter(s => s !== skillId) : [...row.skills, skillId],
      };
    }));
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const cleaned = draft
        .map(t => ({
          ...t,
          id: t.id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          name: t.name.trim() || t.id.trim(),
        }))
        .filter(t => t.id);
      const result = await saveTaskTypes(cleaned);
      setTaskTypes(result.types);
      setDraft(result.types);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="task-type-config">
      <p className="muted task-type-config-intro">
        Define task types (planning, review, implement, etc.) with default agent, skills, and workflow.
        Stored in <span className="mono">.claude/task-types.yaml</span> per workspace.
      </p>

      <div className="task-type-list">
        {draft.map((row, index) => (
          <article className="task-type-card" key={`${row.id}-${index}`}>
            <header className="task-type-card-hd">
              <label className="task-type-default">
                <input
                  type="radio"
                  name="task-type-default"
                  checked={!!row.default}
                  onChange={() => setDefault(index)}
                />
                Default
              </label>
              <button type="button" className="btn btn-sm" onClick={() => removeType(index)}>Remove</button>
            </header>

            <div className="form-grid task-type-card-grid">
              <div className="field">
                <label className="field-lbl"><span>ID</span></label>
                <input
                  className="text mono"
                  placeholder="planning"
                  value={row.id}
                  onChange={e => updateRow(index, { id: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-lbl"><span>Name</span></label>
                <input
                  className="text"
                  placeholder="Planning"
                  value={row.name}
                  onChange={e => updateRow(index, { name: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-lbl"><span>Agent</span></label>
                <select
                  className="text"
                  value={row.agent}
                  onChange={e => updateRow(index, { agent: e.target.value })}
                >
                  <option value="">Default (claude)</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-lbl"><span>Workflow</span></label>
                <select
                  className="text"
                  value={row.workflow}
                  onChange={e => updateRow(index, { workflow: e.target.value })}
                >
                  {workflows.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="field task-type-skills-field">
                <label className="field-lbl"><span>Skills</span></label>
                <div className="chips skill-picker">
                  {skills.map(skill => {
                    const on = row.skills.includes(skill.id);
                    return (
                      <button
                        key={`${skill.source}-${skill.id}`}
                        type="button"
                        className={'chip' + (on ? ' is-on' : '')}
                        onClick={() => toggleSkill(index, skill.id)}
                      >
                        <span className="chip-tick">{on ? '✓' : '○'}</span>
                        <span>{skill.name}</span>
                      </button>
                    );
                  })}
                  {skills.length === 0 && <span className="field-hint">No skills</span>}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <footer className="settings-ft">
        <button type="button" className="btn btn-sm" onClick={addType}>+ Add task type</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save task types'}
        </button>
        {saved && <span className="muted">Saved.</span>}
      </footer>
    </div>
  );
}
