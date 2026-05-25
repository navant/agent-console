import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  getWorkflows,
  getWorkflowFile,
  saveWorkflowFile,
  createWorkflow,
} from '../../api/client';
import { WorkflowConfig } from '../../types';
import MarkdownEditor from '../common/MarkdownEditor';
import { DEFAULT_PATH_SETTINGS } from '../../constants/paths';

type WorkflowKey = `${WorkflowConfig['source']}:${string}`;

function workflowKey(wf: Pick<WorkflowConfig, 'id' | 'source'>): WorkflowKey {
  return `${wf.source}:${wf.id}`;
}

export default function WorkflowsView() {
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const pathSettings = useStore(s => s.pathSettings);
  const loadWorkspaceData = useStore(s => s.loadWorkspaceData);

  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [selected, setSelected] = useState<WorkflowKey | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const loadList = () => {
    if (!activeWorkspaceId) return;
    getWorkflows().then(setWorkflows).catch(() => setWorkflows([]));
  };

  useEffect(() => {
    loadList();
  }, [activeWorkspaceId]);

  const openWorkflow = async (wf: WorkflowConfig) => {
    const key = workflowKey(wf);
    setSelected(key);
    setLoading(true);
    try {
      const res = await getWorkflowFile(wf.id, wf.source);
      setContent(res.content);
    } catch {
      setContent(wf.template ?? '');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!selected || selected.startsWith('global:')) return;
    const id = selected.split(':')[1];
    setSaving(true);
    try {
      await saveWorkflowFile(id, content);
      loadList();
      await loadWorkspaceData();
    } finally {
      setSaving(false);
    }
  };

  const newWorkflow = async () => {
    const name = window.prompt('Workflow folder name (e.g. ralph-loop)');
    if (!name) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    const body = `---\nname: ${name}\ntype: single\n---\n\n{{prompt}}\n\nWorkspace memory:\n{{memory}}\n`;
    await createWorkflow({ id, name, type: 'single', content: body });
    loadList();
    await loadWorkspaceData();
    openWorkflow({ id, name, type: 'single', template: '', source: 'workspace' });
  };

  const filtered = workflows.filter(w => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q);
  });

  const active = selected ? workflows.find(w => workflowKey(w) === selected) : null;
  const readOnly = active?.source === 'global';

  if (!activeWorkspaceId) {
    return <div className="panel-view panel-view--empty"><p>Add a workspace first.</p></div>;
  }

  return (
    <div className="prd-view">
      <header className="panel-view-hd">
        <div>
          <h2>Workflows</h2>
          <p className="muted">
            <span className="mono">{pathSettings?.workflows ?? DEFAULT_PATH_SETTINGS.workflows}</span>
            {' · '}
            global <span className="mono">{pathSettings?.globalWorkflows ?? DEFAULT_PATH_SETTINGS.globalWorkflows}</span>
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={newWorkflow}>+ New workflow</button>
      </header>

      <div className="prd-view-body">
        <aside className="memory-tree">
          <div className="search memory-tree-search">
            <span className="search-glyph">⌕</span>
            <input placeholder="Search workflows…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.map(wf => (
            <button
              key={workflowKey(wf)}
              type="button"
              className={'memory-tree-item' + (selected === workflowKey(wf) ? ' is-active' : '')}
              onClick={() => openWorkflow(wf)}
            >
              <span className="memory-tree-icon">{wf.type === 'loop' ? '↻' : '→'}</span>
              <span className="memory-tree-name">{wf.name}</span>
              <span className="source-chip">{wf.source === 'global' ? 'G' : 'W'}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="field-hint" style={{ padding: 8 }}>
              No workflows — add folders with WORKFLOW.md under the workflows paths.
            </p>
          )}
        </aside>

        <div className="prd-editor-pane">
          {selected && active ? (
            <>
              {readOnly && (
                <p className="field-hint prd-editor-actions">
                  Global workflow — read-only. Copy to workspace workflows to edit.
                </p>
              )}
              <MarkdownEditor
                path={`${active.id}/WORKFLOW.md`}
                content={content}
                onChange={setContent}
                onSave={save}
                saving={saving}
                loading={loading}
                readOnly={readOnly}
              />
            </>
          ) : (
            <div className="memory-editor-empty">
              <p>Select a workflow</p>
              <p className="muted">Each workflow is a folder with WORKFLOW.md on disk.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
