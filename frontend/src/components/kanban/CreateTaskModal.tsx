import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { createTask } from '../../api/client';

const DEFAULT_AGENT = '';

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (taskId: string, isProject: boolean) => void;
}

export default function CreateTaskModal({ open, onClose, onCreated }: CreateTaskModalProps) {
  const agents = useStore(s => s.agents);
  const skills = useStore(s => s.skills);
  const workflows = useStore(s => s.workflows);
  const selectedSkills = useStore(s => s.selectedSkills);
  const addTask = useStore(s => s.addTask);
  const setModal = useStore(s => s.setModal);

  const [title, setTitle] = useState('');
  const [agentId, setAgentId] = useState(DEFAULT_AGENT);
  const [workflowId, setWorkflowId] = useState('');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setAgentId(DEFAULT_AGENT);
      setWorkflowId(workflows[0]?.id || 'single-shot');
      setSkillIds([...selectedSkills]);
      setSkillSearch('');
    }
  }, [open, workflows, selectedSkills]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const showSkillSearch = skills.length >= 4;

  const filteredSkills = useMemo(() => {
    const q = skillSearch.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(s => {
      if (skillIds.includes(s.id)) return true;
      const hay = `${s.id} ${s.name} ${s.source}`.toLowerCase();
      return hay.includes(q);
    });
  }, [skills, skillSearch, skillIds]);

  if (!open) return null;

  const selectedAgent = agentId ? agents.find(a => a.id === agentId) : null;
  const selectedWorkflow = workflows.find(w => w.id === workflowId);
  const valid = title.trim().length > 0 && workflowId;

  const toggleSkill = (id: string) => {
    setSkillIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const task = await createTask({
        title: title.trim(),
        agent: agentId,
        workflow: workflowId,
        skills: skillIds,
        description: description.trim(),
      });
      addTask(task);
      onClose();
      if (task.type === 'project') {
        onCreated?.(task.id, true);
        setModal('plan');
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 560 }} onMouseDown={e => e.stopPropagation()}>
        <header className="modal-hd">
          <div>
            <div className="modal-eyebrow">New task</div>
            <h2 className="modal-title">Create a task</h2>
          </div>
          <button className="modal-x" onClick={onClose}>✕</button>
        </header>

        <div className="modal-body">
          <div className="form-grid">
            <div className="field">
              <label className="field-lbl"><span>Title</span></label>
              <textarea className="text" rows={2} autoFocus value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div className="field">
              <label className="field-lbl">
                <span>Agent</span>
                <span className="field-hint">optional persona</span>
              </label>
              <select className="text" value={agentId} onChange={e => setAgentId(e.target.value)}>
                <option value="">Default (claude)</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.source})</option>
                ))}
              </select>
              {selectedAgent && (
                <span className="field-hint mono">{selectedAgent.model || 'default model'}</span>
              )}
            </div>

            <div className="field">
              <label className="field-lbl"><span>Workflow</span></label>
              <select className="text" value={workflowId} onChange={e => setWorkflowId(e.target.value)}>
                {workflows.length === 0 && (
                  <option value="">No workflows — add a workspace first</option>
                )}
                {workflows.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                ))}
              </select>
              {selectedWorkflow && (
                <span className="field-hint">
                  {selectedWorkflow.type === 'loop'
                    ? 'Project task — requires a plan after creation'
                    : 'Simple task — runs prompt directly'}
                </span>
              )}
            </div>

            <div className="field">
              <label className="field-lbl">
                <span>Skills</span>
                <span className="field-hint">
                  {skillIds.length > 0 ? `${skillIds.length} selected` : 'optional — prepended to prompt'}
                </span>
              </label>
              {skills.length === 0 ? (
                <p className="field-hint">No skills found in global or workspace .claude/skills/</p>
              ) : (
                <>
                  {showSkillSearch && (
                    <div className="search skill-picker-search">
                      <span className="search-glyph">⌕</span>
                      <input
                        type="search"
                        placeholder="Search skills…"
                        value={skillSearch}
                        onChange={e => setSkillSearch(e.target.value)}
                        aria-label="Search skills"
                      />
                    </div>
                  )}
                  <div className="chips skill-picker">
                    {filteredSkills.map(skill => {
                      const on = skillIds.includes(skill.id);
                      return (
                        <button
                          key={`${skill.source}-${skill.id}`}
                          type="button"
                          className={'chip' + (on ? ' is-on' : '')}
                          onClick={() => toggleSkill(skill.id)}
                        >
                          <span className="chip-tick">{on ? '✓' : '○'}</span>
                          <span>{skill.name}</span>
                          <span className="source-chip">{skill.source === 'global' ? 'G' : 'W'}</span>
                        </button>
                      );
                    })}
                  </div>
                  {showSkillSearch && skillSearch.trim() && filteredSkills.length === 0 && (
                    <p className="field-hint">No skills match “{skillSearch.trim()}”</p>
                  )}
                  {showSkillSearch && skillSearch.trim() && filteredSkills.length > 0 && filteredSkills.length < skills.length && (
                    <p className="field-hint">
                      Showing {filteredSkills.length} of {skills.length}
                      {skillIds.length > 0 && ' · selected skills always shown'}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="field">
              <label className="field-lbl">
                <span>Description</span>
                <span className="field-hint">prompt for simple · context for plan generation</span>
              </label>
              <textarea className="text mono" rows={5} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
        </div>

        <footer className="modal-ft">
          <div className="modal-ft-meta muted">
            {selectedWorkflow?.type === 'loop' ? 'Creates project task' : 'Creates simple task'}
            {skillIds.length > 0 && ` · ${skillIds.length} skill${skillIds.length === 1 ? '' : 's'}`}
          </div>
          <div className="modal-ft-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!valid || submitting}>
              {submitting ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
