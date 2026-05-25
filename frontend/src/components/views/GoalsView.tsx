import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  getGoalFiles,
  getGoalFile,
  saveGoalFile,
  deleteGoalFile,
  createGoal,
} from '../../api/client';
import { GoalFile } from '../../types';
import MarkdownEditor from '../common/MarkdownEditor';
import InvokeGoalModal from './InvokeGoalModal';
import { DEFAULT_PATH_SETTINGS } from '../../constants/paths';

export default function GoalsView() {
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const pendingGoalPath = useStore(s => s.pendingGoalPath);
  const clearPendingGoalPath = useStore(s => s.clearPendingGoalPath);
  const pathSettings = useStore(s => s.pathSettings);

  const [files, setFiles] = useState<GoalFile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showInvoke, setShowInvoke] = useState(false);

  const loadList = () => {
    if (!activeWorkspaceId) return;
    getGoalFiles().then(setFiles).catch(() => setFiles([]));
  };

  useEffect(() => {
    loadList();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (pendingGoalPath) {
      openFile(pendingGoalPath);
      clearPendingGoalPath();
    }
  }, [pendingGoalPath]);

  const openFile = async (path: string) => {
    setSelected(path);
    setLoading(true);
    try {
      const res = await getGoalFile(path);
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
      await saveGoalFile(selected, content);
      loadList();
    } finally {
      setSaving(false);
    }
  };

  const newGoal = async () => {
    const name = window.prompt('Goal filename (e.g. ship-weekly-review)');
    if (!name) return;
    try {
      const file = await createGoal(name);
      loadList();
      openFile(file.path);
    } catch (err) {
      console.error('Failed to create goal:', err);
      window.alert(`Failed to create goal: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const invoke = () => {
    if (!selected) return;
    setShowInvoke(true);
  };

  const removeGoal = async () => {
    if (!selected) return;
    const name = selected.split('/').pop() ?? selected;
    if (
      !window.confirm(
        `Delete "${name}"?\n\nThis removes the file from disk. Tasks that link to this goal will keep their link but the file will be gone.`
      )
    ) {
      return;
    }
    try {
      await deleteGoalFile(selected);
      setSelected(null);
      setContent('');
      loadList();
    } catch (err) {
      window.alert(`Failed to delete goal: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const filtered = files.filter(f =>
    !search.trim() || f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!activeWorkspaceId) {
    return <div className="panel-view panel-view--empty"><p>Add a workspace first.</p></div>;
  }

  return (
    <div className="prd-view goals-view">
      <header className="panel-view-hd">
        <div>
          <h2>Goals</h2>
          <p className="muted">Markdown files in <span className="mono">{pathSettings?.goals ?? DEFAULT_PATH_SETTINGS.goals}</span></p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={newGoal}>+ New goal</button>
      </header>

      <div className="prd-view-body">
        <aside className="memory-tree">
          <div className="search memory-tree-search">
            <span className="search-glyph">⌕</span>
            <input placeholder="Search goals…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.map(f => (
            <button
              key={f.id}
              type="button"
              className={'memory-tree-item' + (selected === f.path ? ' is-active' : '')}
              onClick={() => openFile(f.path)}
            >
              <span className="memory-tree-icon">◎</span>
              <span className="memory-tree-name mono">{f.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="field-hint" style={{ padding: 8 }}>No goal files — create one or add .md files to the goals folder.</p>
          )}
        </aside>

        <div className="prd-editor-pane">
          {selected ? (
            <>
              <div className="prd-editor-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={invoke}>
                  ▶ Run as task
                </button>
                <button type="button" className="btn btn-sm danger" onClick={removeGoal}>
                  Delete goal
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
              <p>Select a goal or create a new one</p>
              <p className="muted">Goals are outcome-focused specs. Use “Run as task” to invoke via <span className="mono">/goal</span> slash command.</p>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <InvokeGoalModal
          open={showInvoke}
          goalPath={selected}
          goalContent={content}
          onClose={() => setShowInvoke(false)}
        />
      )}
    </div>
  );
}
