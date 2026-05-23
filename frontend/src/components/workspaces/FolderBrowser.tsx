import React, { useEffect, useState } from 'react';
import { browseDirectory, BrowseResult } from '../../api/client';

interface FolderBrowserProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export default function FolderBrowser({ initialPath = '~', onSelect, onClose }: FolderBrowserProps) {
  const [current, setCurrent] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (p: string, fallback = false) => {
    setLoading(true);
    setError('');
    try {
      const result = await browseDirectory(p);
      setCurrent(result);
    } catch (err) {
      if (!fallback && p !== '~') {
        await load('~', true);
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(initialPath.replace(/\/$/, '') || '~');
  }, [initialPath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="folder-browser" onMouseDown={e => e.stopPropagation()}>
      <div className="folder-browser-hd">
        <span className="mono folder-browser-path">{current?.path ?? initialPath}</span>
        <button type="button" className="modal-x" onClick={onClose} aria-label="Close browser">✕</button>
      </div>

      {error && <div className="folder-browser-error">{error}</div>}

      <div className="folder-browser-body">
        {loading && <div className="folder-browser-loading">Loading…</div>}
        {!loading && current && (
          <>
            {current.parent !== current.path && (
              <button type="button" className="folder-row" onClick={() => load(current.parent)}>
                <span className="folder-glyph">↑</span>
                <span>..</span>
                <span className="folder-row-meta mono">{current.parent}</span>
              </button>
            )}
            {current.entries.length === 0 && (
              <div className="folder-browser-empty">No subfolders — select current folder below</div>
            )}
            {current.entries.map(entry => (
              <button
                key={entry.path}
                type="button"
                className="folder-row"
                onClick={() => load(entry.path)}
                onDoubleClick={() => onSelect(entry.path)}
              >
                <span className="folder-glyph">▸</span>
                <span>{entry.name}</span>
              </button>
            ))}
          </>
        )}
      </div>

      <footer className="folder-browser-ft">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!current || loading}
          onClick={() => current && onSelect(current.path)}
        >
          Select this folder
        </button>
      </footer>
    </div>
  );
}
