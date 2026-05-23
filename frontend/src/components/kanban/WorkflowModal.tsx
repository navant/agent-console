import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { createWorkflow } from '../../api/client';

interface WorkflowModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WorkflowModal({ open, onClose }: WorkflowModalProps) {
  const addWorkflow = useStore(s => s.setWorkflows);
  const workflows = useStore(s => s.workflows);
  const [name, setName] = useState('');
  const [type, setType] = useState<'loop' | 'single'>('single');
  const [template, setTemplate] = useState('{{prompt}}\n\nWorkspace memory:\n{{memory}}');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setType('single');
      setTemplate('{{prompt}}\n\nWorkspace memory:\n{{memory}}');
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const wf = await createWorkflow({ name, type, template });
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
            <label className="field-lbl"><span>Type</span></label>
            <select className="text" value={type} onChange={e => setType(e.target.value as 'loop' | 'single')}>
              <option value="single">single</option>
              <option value="loop">loop</option>
            </select>
          </div>
          <div className="field">
            <label className="field-lbl"><span>Template</span></label>
            <textarea className="text mono" rows={10} value={template} onChange={e => setTemplate(e.target.value)} />
          </div>
        </div>
        <footer className="modal-ft">
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>Create</button>
        </footer>
      </div>
    </div>
  );
}
