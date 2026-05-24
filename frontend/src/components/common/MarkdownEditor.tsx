import React, { useState } from 'react';
import { marked } from 'marked';

interface MarkdownEditorProps {
  path: string;
  content: string;
  onChange: (content: string) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  loading?: boolean;
}

export default function MarkdownEditor({
  path,
  content,
  onChange,
  onSave,
  saving,
  loading,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const html = marked.parse(content || '_Empty document_', { async: false }) as string;

  return (
    <div className="md-editor">
      <header className="md-editor-hd">
        <span className="mono md-editor-path">{path}</span>
        <div className="md-editor-actions">
          <button
            type="button"
            className={'btn btn-sm' + (mode === 'view' ? ' is-on' : '')}
            onClick={() => setMode('view')}
          >
            View
          </button>
          <button
            type="button"
            className={'btn btn-sm' + (mode === 'edit' ? ' is-on' : '')}
            onClick={() => setMode('edit')}
          >
            Edit
          </button>
          {mode === 'edit' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </header>
      {loading ? (
        <p className="muted md-editor-loading">Loading…</p>
      ) : mode === 'edit' ? (
        <textarea
          className="text mono md-editor-textarea"
          value={content}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <div className="md-editor-preview prose" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}
