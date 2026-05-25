import React, { useState } from 'react';
import CollapsibleSection from './CollapsibleSection';
import { useStore } from '../../store/useStore';
import { saveAgentMemory } from '../../api/client';

export default function MemorySection() {
  const memory = useStore(s => s.memory);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const expanded = useStore(s => s.expandedSections.memory ?? false);
  const toggleSection = useStore(s => s.toggleSection);
  const setMemory = useStore(s => s.setMemory);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const saveAgent = async (agentId: string, content: string) => {
    const updated = await saveAgentMemory(agentId, content);
    setMemory(updated);
    setEditingAgent(null);
  };

  return (
    <CollapsibleSection
      label="Memory"
      expanded={expanded}
      onToggle={() => toggleSection('memory')}
    >
      {!activeWorkspaceId && (
        <div className="side-empty">Add a workspace to view memory</div>
      )}
      {activeWorkspaceId && !memory && (
        <div className="side-empty">Loading memory…</div>
      )}
      {memory && (
        <div className="side-panel-content">
          <div className="field">
            <label className="field-lbl">
              <span>Memory</span>
              <span className="muted"> · MEMORY.md</span>
            </label>
            <textarea
              className="text mono side-editor"
              rows={4}
              readOnly
              value={memory.workspace.content || '_Empty — run Refresh summaries in the Memory tab._'}
            />
            <p className="muted side-hint">Updated by claude-mem. Edit in the Memory tab or run a session.</p>
          </div>
          {memory.agents.length > 0 && (
            <div className="side-sub-list">
              <div className="side-sub-hd">Agents</div>
              {memory.agents.map(a => (
                <div key={a.id} className="side-memory-agent">
                  <button
                    className="side-row side-row--quiet"
                    onClick={() => {
                      setEditingAgent(editingAgent === a.id ? null : a.id);
                      setDraft(a.content);
                    }}
                  >
                    <span className="side-row-name">{a.name}</span>
                    <span className="side-row-meta side-row-meta--faint">edit</span>
                  </button>
                  {editingAgent === a.id && (
                    <textarea
                      className="text mono side-editor"
                      rows={3}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onBlur={() => saveAgent(a.id, draft)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
