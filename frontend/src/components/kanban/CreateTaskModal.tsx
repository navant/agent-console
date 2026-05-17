import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { createTask } from '../../api/client';

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateTaskModal({ open, onClose }: CreateTaskModalProps) {
  const agents = useStore(s => s.agents);
  const workspaces = useStore(s => s.workspaces);
  const addTask = useStore(s => s.addTask);

  const [title, setTitle] = useState('');
  const [agentId, setAgentId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setAgentId(agents[0]?.id || '');
      setWorkspaceId(workspaces[0]?.id || '');
    }
  }, [open, agents, workspaces]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selectedAgent = agents.find(a => a.id === agentId);
  const valid = title.trim().length > 0 && agentId && workspaceId;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const task = await createTask({
        title: title.trim(),
        agent: agentId,
        workspace: workspaceId,
        description: description.trim(),
      });
      addTask(task);
      onClose();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 540 }}
        onMouseDown={e => e.stopPropagation()}
        data-screen-label="modal-new-task"
      >
        <header className="modal-hd">
          <div>
            <div className="modal-eyebrow">New task</div>
            <h2 className="modal-title">Create a task</h2>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="modal-body">
          <div className="form-grid">
            {/* Title */}
            <div className="field">
              <label className="field-lbl">
                <span>Title</span>
                <span className="field-hint">what should the agent do?</span>
              </label>
              <textarea
                className="text"
                rows={2}
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Refactor the authentication module"
              />
            </div>

            {/* Agent */}
            <div className="field">
              <label className="field-lbl">
                <span>Agent</span>
              </label>
              <div className="input-wrap">
                {selectedAgent && (
                  <span
                    className="input-avatar"
                    style={{
                      background: selectedAgent.tint + '33',
                      color: selectedAgent.tint,
                    }}
                  >
                    {selectedAgent.name.slice(0, 2)}
                  </span>
                )}
                <select
                  className="text"
                  value={agentId}
                  onChange={e => setAgentId(e.target.value)}
                  style={{ appearance: 'auto' }}
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Workspace */}
            <div className="field">
              <label className="field-lbl">
                <span>Workspace</span>
              </label>
              <select
                className="text"
                value={workspaceId}
                onChange={e => setWorkspaceId(e.target.value)}
                style={{ appearance: 'auto' }}
              >
                {workspaces.map(w => (
                  <option key={w.id} value={w.id}>{w.name} — {w.path}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="field">
              <label className="field-lbl">
                <span>Description</span>
                <span className="field-hint">passed as prompt · markdown</span>
              </label>
              <textarea
                className="text mono"
                rows={6}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detailed instructions for the agent. Supports markdown.&#10;&#10;- Read the existing code first&#10;- Make minimal changes&#10;- Write tests for new logic"
              />
            </div>
          </div>
        </div>

        <footer className="modal-ft">
          <div className="modal-ft-meta">
            {agentId && workspaceId && (
              <>
                <span className="muted">agent</span>
                <span className="mono">{agentId}</span>
                <span className="muted">·</span>
                <span className="muted">workspace</span>
                <span className="mono">{workspaceId}</span>
              </>
            )}
          </div>
          <div className="modal-ft-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!valid || submitting}
            >
              <span className="btn-glyph">+</span>
              {submitting ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
