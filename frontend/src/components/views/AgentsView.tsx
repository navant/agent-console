import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { getAgents, getAgentFile, saveAgentFile, createAgentFile } from '../../api/client';
import { AgentConfig } from '../../types';
import MarkdownEditor from '../common/MarkdownEditor';
import { DEFAULT_PATH_SETTINGS } from '../../constants/paths';

type AgentKey = `${AgentConfig['source']}:${string}`;

function agentKey(agent: Pick<AgentConfig, 'id' | 'source'>): AgentKey {
  return `${agent.source}:${agent.id}`;
}

function AgentAvatar({ agent, size = 18 }: { agent: AgentConfig; size?: number }) {
  const tint = agent.tint || '#7aa7d4';
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: tint + '33',
        color: tint,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {agent.name.slice(0, 2)}
    </span>
  );
}

export default function AgentsView() {
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const pathSettings = useStore(s => s.pathSettings);
  const setChatAgent = useStore(s => s.setChatAgent);
  const setSelectedAgent = useStore(s => s.setSelectedAgent);
  const loadWorkspaceData = useStore(s => s.loadWorkspaceData);

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selected, setSelected] = useState<AgentKey | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const loadList = () => {
    if (!activeWorkspaceId) return;
    getAgents().then(setAgents).catch(() => setAgents([]));
  };

  useEffect(() => {
    loadList();
  }, [activeWorkspaceId]);

  const openAgent = async (agent: AgentConfig) => {
    const key = agentKey(agent);
    setSelected(key);
    setSelectedAgent(agent.id);
    setChatAgent(agent.id);
    setLoading(true);
    try {
      const res = await getAgentFile(agent.id, agent.source);
      setContent(res.content);
    } catch {
      setContent(agent.soul ?? '');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!selected || selected.startsWith('global:')) return;
    const id = selected.split(':')[1];
    setSaving(true);
    try {
      await saveAgentFile(id, content);
      loadList();
      await loadWorkspaceData();
    } finally {
      setSaving(false);
    }
  };

  const newAgent = async () => {
    const name = window.prompt('Agent id (e.g. reviewer)');
    if (!name) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    const body = `---\nname: ${name}\nmodel: claude-sonnet-4-6\ntools:\n  - Bash\n  - Read\n  - Write\n  - Edit\nmemory: true\n---\n\nYou are ${name}.\n`;
    const created = await createAgentFile(id, body);
    loadList();
    await loadWorkspaceData();
    openAgent(created);
  };

  const filtered = agents.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
  });

  const active = selected ? agents.find(a => agentKey(a) === selected) : null;
  const readOnly = active?.source === 'global';

  if (!activeWorkspaceId) {
    return <div className="panel-view panel-view--empty"><p>Add a workspace first.</p></div>;
  }

  return (
    <div className="prd-view">
      <header className="panel-view-hd">
        <div>
          <h2>Agents</h2>
          <p className="muted">
            <span className="mono">{pathSettings?.agents ?? DEFAULT_PATH_SETTINGS.agents}</span>
            {' · '}
            global <span className="mono">{pathSettings?.globalAgents ?? DEFAULT_PATH_SETTINGS.globalAgents}</span>
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={newAgent}>+ New agent</button>
      </header>

      <div className="prd-view-body">
        <aside className="memory-tree">
          <div className="search memory-tree-search">
            <span className="search-glyph">⌕</span>
            <input placeholder="Search agents…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.map(agent => (
            <button
              key={agentKey(agent)}
              type="button"
              className={'memory-tree-item file-tree-item-with-avatar' + (selected === agentKey(agent) ? ' is-active' : '')}
              onClick={() => openAgent(agent)}
            >
              <AgentAvatar agent={agent} size={18} />
              <span className="memory-tree-name">{agent.name}</span>
              <span className="source-chip">{agent.source === 'global' ? 'G' : 'W'}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="field-hint" style={{ padding: 8 }}>
              No agents — add .md files under the agents paths.
            </p>
          )}
        </aside>

        <div className="prd-editor-pane">
          {selected && active ? (
            <>
              {readOnly && (
                <p className="field-hint prd-editor-actions">
                  Global agent — read-only. Copy to workspace agents to edit.
                </p>
              )}
              <MarkdownEditor
                path={`${active.id}.md`}
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
              <p>Select an agent</p>
              <p className="muted">Each agent is a markdown file with YAML frontmatter and a soul body.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
