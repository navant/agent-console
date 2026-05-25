import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  getPrdFiles,
  getPrdFile,
  savePrdFile,
  deletePrdFile,
  createPrd,
} from '../../api/client';
import { PrdFile } from '../../types';
import MarkdownEditor from '../common/MarkdownEditor';
import ImplementPrdModal from './ImplementPrdModal';
import { DEFAULT_PATH_SETTINGS } from '../../constants/paths';

export default function PRDView() {
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const pendingPrdPath = useStore(s => s.pendingPrdPath);
  const clearPendingPrdPath = useStore(s => s.clearPendingPrdPath);
  const pathSettings = useStore(s => s.pathSettings);

  const [files, setFiles] = useState<PrdFile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showImplement, setShowImplement] = useState(false);

  const loadList = () => {
    if (!activeWorkspaceId) return;
    getPrdFiles().then(setFiles).catch(() => setFiles([]));
  };

  useEffect(() => {
    loadList();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (pendingPrdPath) {
      openFile(pendingPrdPath);
      clearPendingPrdPath();
    }
  }, [pendingPrdPath]);

  const openFile = async (path: string) => {
    setSelected(path);
    setLoading(true);
    try {
      const res = await getPrdFile(path);
      setContent(res.content);
    } catch {
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await savePrdFile(selected, content);
      loadList();
    } finally {
      setSaving(false);
    }
  };

  const newPrd = async () => {
    const name = window.prompt('PRD filename (e.g. feature-auth)');
    if (!name) return;
    try {
      const file = await createPrd(name);
      loadList();
      openFile(file.path);
    } catch (err) {
      console.error('Failed to create PRD:', err);
      window.alert(`Failed to create PRD: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const implement = () => {
    if (!selected) return;
    setShowImplement(true);
  };

  const removePrd = async () => {
    if (!selected) return;
    const name = selected.split('/').pop() ?? selected;
    if (
      !window.confirm(
        `Delete "${name}"?\n\nThis removes the file from disk. Tasks that link to this PRD will keep their link but the file will be gone.`
      )
    ) {
      return;
    }
    try {
      await deletePrdFile(selected);
      setSelected(null);
      setContent('');
      loadList();
    } catch (err) {
      window.alert(`Failed to delete PRD: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const filtered = files.filter(f =>
    !search.trim() || f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!activeWorkspaceId) {
    return <div className="panel-view panel-view--empty"><p>Add a workspace first.</p></div>;
  }

  return (
    <div className="prd-view">
      <header className="panel-view-hd">
        <div>
          <h2>Planning</h2>
          <p className="muted">PRD specs in <span className="mono">{pathSettings?.prd ?? DEFAULT_PATH_SETTINGS.prd}</span></p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={newPrd}>+ New plan</button>
      </header>

      <div className="prd-view-body">
        <aside className="memory-tree">
          <div className="search memory-tree-search">
            <span className="search-glyph">⌕</span>
            <input placeholder="Search PRDs…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.map(f => (
            <button
              key={f.id}
              type="button"
              className={'memory-tree-item' + (selected === f.path ? ' is-active' : '')}
              onClick={() => openFile(f.path)}
            >
              <span className="memory-tree-icon">≡</span>
              <span className="memory-tree-name mono">{f.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="field-hint" style={{ padding: 8 }}>No PRD files — create one or add .md files to the prd folder.</p>
          )}
        </aside>

        <div className="prd-editor-pane">
          {selected ? (
            <>
              <div className="prd-editor-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={implement}>
                  ▶ Implement as task
                </button>
                <button type="button" className="btn btn-sm danger" onClick={removePrd}>
                  Delete PRD
                </button>
              </div>
              <MarkdownEditor
                path={selected}
                content={content}
                onChange={setContent}
                onSave={save}
                saving={saving}
                loading={loading}
              />
            </>
          ) : (
            <div className="memory-editor-empty">
              <p>Select a PRD or create a new one</p>
              <p className="muted">PRDs are markdown specs. Use “Implement as task” when you are ready to run one.</p>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <ImplementPrdModal
          open={showImplement}
          prdPath={selected}
          prdContent={content}
          onClose={() => setShowImplement(false)}
        />
      )}
    </div>
  );
}
