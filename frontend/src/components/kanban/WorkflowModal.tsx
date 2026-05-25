import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { createWorkflow } from '../../api/client';

const DEFAULT_BODY = `# {{task.id}} — {{task.title}}

{{storyDescription}}

## PRD

{{prdExcerpt}}

## Memory

{{memory}}
`;

interface WorkflowModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WorkflowModal({ open, onClose }: WorkflowModalProps) {
  const addWorkflow = useStore(s => s.setWorkflows);
  const workflows = useStore(s => s.workflows);
  const agents = useStore(s => s.agents);
  const skills = useStore(s => s.skills);
  const [name, setName] = useState('');
  const [agent, setAgent] = useState('');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setAgent('');
      setSkillIds([]);
      setBody(DEFAULT_BODY);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!name.trim() || submitting) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    const skillsBlock =
      skillIds.length > 0
        ? `skills:\n${skillIds.map(s => `  - ${s}`).join('\n')}`
        : 'skills: []';
    const content = `---\nname: ${name.trim()}\ntype: single\nagent: '${agent}'\n${skillsBlock}\ntask_type: implement\n---\n\n${body.trim()}\n`;
    setSubmitting(true);
    try {
      const wf = await createWorkflow({ id, name: name.trim(), type: 'single', agent, skills: skillIds, content });
      addWorkflow([...workflows, wf]);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 620 }} onMouseDown={e => e.stopPropagation()}>
        <header className="modal-hd">
          <h2 className="modal-title">New workflow</h2>
          <button className="modal-x" onClick={onClose}>✕</button>
        </header>
        <div className="modal-body form-grid">
          <div className="field">
            <label className="field-lbl"><span>Name</span></label>
            <input className="text" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-lbl"><span>Default agent</span></label>
            <select className="text" value={agent} onChange={e => setAgent(e.target.value)}>
              <option value="">None</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name || a.id}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-lbl"><span>Default skills</span></label>
            <div className="skill-chips">
              {skills.map(sk => (
                <label key={sk.id} className="chip">
                  <input
                    type="checkbox"
                    checked={skillIds.includes(sk.id)}
                    onChange={e => {
                      setSkillIds(prev =>
                        e.target.checked ? [...prev, sk.id] : prev.filter(id => id !== sk.id)
                      );
                    }}
                  />
                  {sk.name || sk.id}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-lbl"><span>Template body</span></label>
            <textarea className="text mono" rows={10} value={body} onChange={e => setBody(e.target.value)} />
            <p className="field-hint">Vars: {'{{task.*}}'}, {'{{prdExcerpt}}'}, {'{{storyDescription}}'}, {'{{memory}}'}</p>
          </div>
        </div>
        <footer className="modal-ft">
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>Create</button>
        </footer>
      </div>
    </div>
  );
}
