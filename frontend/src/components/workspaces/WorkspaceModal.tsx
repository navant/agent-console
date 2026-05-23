import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import FolderBrowser from './FolderBrowser';

interface WorkspaceModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WorkspaceModal({ open, onClose }: WorkspaceModalProps) {
  const registerWorkspace = useStore(s => s.registerWorkspace);
  const workspaceSaving = useStore(s => s.workspaceSaving);

  const [name, setName] = useState('');
  const [path, setPath] = useState('~');
  const [description, setDescription] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setPath('~');
      setDescription('');
      setShowBrowser(false);
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !workspaceSaving) {
        if (showBrowser) setShowBrowser(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, showBrowser, workspaceSaving]);

  if (!open) return null;

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const valid = slug && path.trim().length > 2;
  const pathParts = path.replace(/^~\/?/, '').split('/').filter(Boolean);
  const busy = workspaceSaving;

  const handleFolderSelect = (selected: string) => {
    setPath(selected);
    setShowBrowser(false);
    if (!name.trim()) {
      const folderName = selected.replace(/\/$/, '').split('/').pop() ?? '';
      if (folderName && folderName !== '~') setName(folderName);
    }
  };

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const submit = async () => {
    if (!valid || busy) return;
    setError('');
    try {
      await registerWorkspace({
        id: slug,
        name: name.trim() || slug,
        path: path.trim(),
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={handleClose}>
      <div
        className={'modal' + (busy ? ' is-busy' : '')}
        style={{ width: 520 }}
        onMouseDown={e => e.stopPropagation()}
        data-screen-label="modal-new-workspace"
      >
        {busy && (
          <div className="modal-loading" aria-live="polite">
            <span className="spinner" />
            <span>Adding workspace…</span>
          </div>
        )}

        <header className="modal-hd">
          <div>
            <div className="modal-eyebrow">New workspace</div>
            <h2 className="modal-title">Add a workspace</h2>
          </div>
          <button className="modal-x" onClick={handleClose} aria-label="Close" disabled={busy}>✕</button>
        </header>

        <div className="modal-body">
          <div className="form-grid">
            <div className="field">
              <label className="field-lbl">
                <span>Name</span>
                <span className="field-hint mono">{slug || 'lowercase, kebab-case'}</span>
              </label>
              <div className="input-wrap">
                <span className="input-glyph">▸</span>
                <input
                  className="text"
                  autoFocus={!showBrowser && !busy}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. my-app"
                  disabled={busy}
                />
              </div>
            </div>

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
                  placeholder="~/Code/my-app"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowBrowser(true)}
                  disabled={busy}
                >
                  Browse…
                </button>
              </div>
              <div className="path-preview">
                <span className="path-crumb mono">~</span>
                {pathParts.map((seg, i) => (
                  <React.Fragment key={i}>
                    <span className="path-sep">/</span>
                    <span className={'path-crumb mono' + (i === pathParts.length - 1 ? ' is-last' : '')}>
                      {seg}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

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
                disabled={busy}
              />
            </div>

            {error && <p className="form-error">{error}</p>}
          </div>
        </div>

        {showBrowser && !busy && (
          <div className="folder-browser-overlay">
            <FolderBrowser
              initialPath={path.trim().replace(/\/$/, '') || '~'}
              onSelect={handleFolderSelect}
              onClose={() => setShowBrowser(false)}
            />
          </div>
        )}

        {!showBrowser && (
          <footer className="modal-ft">
            <div className="modal-ft-meta">
              <span className="muted">claude --add-dir</span>
              <span className="mono">{path || '<path>'}</span>
            </div>
            <div className="modal-ft-actions">
              <button className="btn" onClick={handleClose} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={!valid || busy}>
                {busy ? (
                  <>
                    <span className="spinner spinner--inline" />
                    Adding…
                  </>
                ) : (
                  <>
                    <span className="btn-glyph">+</span>
                    Add workspace
                  </>
                )}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
