import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { getMemory, getMemoryFile, saveMemoryFile } from '../../api/client';
import { MemoryFileEntry } from '../../types';

function scopeLabel(scope: MemoryFileEntry['scope']): string {
  if (scope === 'wiki') return 'wiki';
  if (scope === 'agent') return 'agent';
  return 'workspace';
}

export default function MemoryView() {
  const memory = useStore(s => s.memory);
  const setMemory = useStore(s => s.setMemory);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);

  const [files, setFiles] = useState<MemoryFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    getMemory().then(m => {
      setMemory(m);
      setFiles(m.files ?? []);
    }).catch(() => {});
  }, [activeWorkspaceId, setMemory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files.filter(f => !f.isDir);
    return files.filter(f => {
      if (f.isDir) return false;
      return `${f.name} ${f.path} ${f.scope}`.toLowerCase().includes(q);
    });
  }, [files, search]);

  const treeByScope = useMemo(() => {
    const groups: Record<string, MemoryFileEntry[]> = { workspace: [], wiki: [], agent: [] };
    filtered.forEach(f => groups[f.scope]?.push(f));
    return groups;
  }, [filtered]);

  const openFile = async (file: MemoryFileEntry) => {
    if (file.isDir) return;
    setLoading(true);
    setSelectedPath(file.path);
    setSelectedAgentId(file.agentId);
    try {
      const res = await getMemoryFile(file.path, file.agentId);
      setContent(res.content);
    } catch {
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!selectedPath) return;
    setSaving(true);
    try {
      const updated = await saveMemoryFile(selectedPath, content, selectedAgentId);
      setMemory(updated);
      setFiles(updated.files ?? []);
    } finally {
      setSaving(false);
    }
  };

  if (!activeWorkspaceId) {
    return (
      <div className="panel-view panel-view--empty">
        <p>Add a workspace to manage memory files.</p>
      </div>
    );
  }

  return (
    <div className="memory-view">
      <header className="panel-view-hd">
        <div>
          <h2>Memory</h2>
          <p className="muted">
            Tier: {memory?.tier ?? 'simple'} · files under <span className="mono">.claude/</span>
          </p>
        </div>
      </header>

      <div className="memory-view-body">
        <aside className="memory-tree">
          <div className="search memory-tree-search">
            <span className="search-glyph">⌕</span>
            <input
              placeholder="Search memory files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {(['workspace', 'wiki', 'agent'] as const).map(scope => {
            const items = treeByScope[scope];
            if (items.length === 0) return null;
            return (
              <div key={scope} className="memory-tree-group">
                <div className="memory-tree-group-hd">{scope}</div>
                {items.map(file => (
                  <button
                    key={file.id}
                    type="button"
                    className={
                      'memory-tree-item' +
                      (selectedPath === file.path && selectedAgentId === file.agentId ? ' is-active' : '')
                    }
                    onClick={() => openFile(file)}
                  >
                    <span className="memory-tree-icon">◇</span>
                    <span className="memory-tree-name mono">{file.name}</span>
                  </button>
                ))}
              </div>
            );
          })}

          {files.length === 0 && (
            <p className="field-hint" style={{ padding: '8px 10px' }}>
              No memory files yet. Create <span className="mono">.claude/memory.md</span> or a <span className="mono">wiki/</span> folder.
            </p>
          )}
        </aside>

        <div className="memory-editor">
          {selectedPath ? (
            <>
              <div className="memory-editor-hd">
                <span className="mono">{selectedPath}</span>
                <span className="source-chip">{scopeLabel(
                  files.find(f => f.path === selectedPath)?.scope ?? 'workspace'
                )}</span>
                <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || loading}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              {loading ? (
                <p className="muted memory-editor-loading">Loading…</p>
              ) : (
                <textarea
                  className="text mono memory-editor-area"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />
              )}
            </>
          ) : (
            <div className="memory-editor-empty">
              <p>Select a memory file from the tree</p>
              <p className="muted">Workspace memory, wiki pages, and agent memory files appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
