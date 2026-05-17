import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { createWorkspace } from '../../api/client';

interface WorkspaceModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WorkspaceModal({ open, onClose }: WorkspaceModalProps) {
  const addWorkspace = useStore(s => s.addWorkspace);

  const [name, setName] = useState('');
  const [path, setPath] = useState('~/code/');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setName(''); setPath('~/code/'); setDescription(''); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const valid = slug && path.trim().length > 2;

  const pathParts = path.replace(/^~\/?/, '').split('/').filter(Boolean);

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const workspace = await createWorkspace({
        id: slug,
        name: slug,
        path: path.trim(),
        description: description.trim() || undefined,
      });
      addWorkspace(workspace);
      onClose();
    } catch (err) {
      console.error('Failed to create workspace:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 520 }}
        onMouseDown={e => e.stopPropagation()}
        data-screen-label="modal-new-workspace"
      >
        <header className="modal-hd">
          <div>
            <div className="modal-eyebrow">New workspace</div>
            <h2 className="modal-title">Add a workspace</h2>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="modal-body">
          <div className="form-grid">
            {/* Name */}
            <div className="field">
              <label className="field-lbl">
                <span>Name</span>
                <span className="field-hint mono">{slug || 'lowercase, kebab-case'}</span>
              </label>
              <div className="input-wrap">
                <span className="input-glyph">▸</span>
                <input
                  className="text"
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. my-app"
                />
              </div>
            </div>

            {/* Path */}
            <div className="field">
              <label className="field-lbl">
                <span>Path</span>
                <span className="field-hint">absolute or ~ home</span>
              </label>
              <div className="input-wrap">
                <span className="input-glyph mono">$</span>
                <input
                  className="text mono"
                  value={path}
                  onChange={e => setPath(e.target.value)}
                  placeholder="~/code/my-app"
                />
                <button type="button" className="input-action">Browse…</button>
              </div>
              <div className="path-preview">
                <span className="path-crumb mono">~</span>
                {pathParts.map((seg, i) => (
                  <React.Fragment key={i}>
                    <span className="path-sep">/</span>
                    <span
                      className={'path-crumb mono' + (i === pathParts.length - 1 ? ' is-last' : '')}
                    >
                      {seg}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="field">
              <label className="field-lbl">
                <span>Description</span>
                <span className="field-hint">optional</span>
              </label>
              <textarea
                className="text"
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What lives here?"
              />
            </div>
          </div>
        </div>

        <footer className="modal-ft">
          <div className="modal-ft-meta">
            <span className="muted">claude --add-dir</span>
            <span className="mono">{path || '<path>'}</span>
          </div>
          <div className="modal-ft-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!valid || submitting}
            >
              <span className="btn-glyph">+</span>
              {submitting ? 'Adding…' : 'Add workspace'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
