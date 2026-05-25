import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  getPrdFiles,
  getPrdFile,
  savePrdFile,
  deletePrdFile,
  createPrd,
  createTask,
} from '../../api/client';
import { PrdFile } from '../../types';
import MarkdownEditor from '../common/MarkdownEditor';
import { DEFAULT_PATH_SETTINGS } from '../../constants/paths';

export default function PRDView() {
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const pendingPrdPath = useStore(s => s.pendingPrdPath);
  const clearPendingPrdPath = useStore(s => s.clearPendingPrdPath);
  const pathSettings = useStore(s => s.pathSettings);
  const addTask = useStore(s => s.addTask);
  const openTaskTab = useStore(s => s.openTaskTab);
  const loadWorkspaceData = useStore(s => s.loadWorkspaceData);

  const [files, setFiles] = useState<PrdFile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [expanding, setExpanding] = useState(false);

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
      window.alert(`Failed to create PRD: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const expandWithPrdSkill = async () => {
    if (!selected) return;
    setExpanding(true);
    try {
      const task = await createTask({
        title: `Expand PRD: ${selected.split('/').pop()}`,
        workflow: 'single-shot',
        skills: ['prd'],
        prd: selected,
        description:
          'Use the **prd** skill to interview, explore the codebase if needed, and expand this PRD into a full spec. Save updates to the linked PRD file under .claude/prd/. Do not implement code yet.',
      });
      addTask(task);
      await loadWorkspaceData();
      openTaskTab(task.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setExpanding(false);
    }
  };

  const removePrd = async () => {
    if (!selected) return;
    const name = selected.split('/').pop() ?? selected;
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await deletePrdFile(selected);
      setSelected(null);
      setContent('');
      loadList();
    } catch (err) {
      window.alert(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
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
          <p className="muted">
            PRD markdown in <span className="mono">{pathSettings?.prd ?? DEFAULT_PATH_SETTINGS.prd}</span>.
            Use <strong>Expand with PRD skill</strong> to deepen a spec (creates a task that invokes the prd skill).
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={newPrd}>+ New PRD</button>
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
        </aside>

        <div className="prd-editor-pane">
          {selected ? (
            <>
              <div className="prd-editor-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void expandWithPrdSkill()}
                  disabled={expanding}
                >
                  {expanding ? 'Creating task…' : 'Expand with PRD skill'}
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
              <p>Select or create a PRD</p>
              <p className="muted">Run the task with the prd skill, or pick an Archon workflow on a kanban card for multi-step execution.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
