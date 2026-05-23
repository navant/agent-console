import React from 'react';
import CollapsibleSection from './CollapsibleSection';
import { useStore } from '../../store/useStore';

function AgentAvatar({ agentId, size = 20 }: { agentId: string; size?: number }) {
  const agents = useStore(s => s.agents);
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return null;
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

export default function AgentsSection({ panel }: { panel?: boolean }) {
  const agents = useStore(s => s.agents);
  const selectedAgent = useStore(s => s.selectedAgent);
  const setSelectedAgent = useStore(s => s.setSelectedAgent);
  const setChatAgent = useStore(s => s.setChatAgent);
  const setModal = useStore(s => s.setModal);
  const expanded = useStore(s => s.expandedSections.agents ?? true);
  const toggleSection = useStore(s => s.toggleSection);
  const tasks = useStore(s => s.tasks);

  const runningAgentIds = new Set(
    tasks.filter(t => t.status === 'running').map(t => t.agent)
  );

  const body = (
    <>
      {panel && (
        <div className="panel-view-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setModal('agent')}>+ New agent</button>
        </div>
      )}
      {agents.map(agent => (
        <button
          key={`${agent.source}-${agent.id}`}
          className={'side-row' + (selectedAgent === agent.id ? ' is-selected' : '')}
          onClick={() => {
            setSelectedAgent(agent.id);
            setChatAgent(agent.id);
          }}
        >
          <AgentAvatar agentId={agent.id} />
          <span className="side-row-name">{agent.name}</span>
          <span className="side-row-meta">
            {runningAgentIds.has(agent.id) ? (
              <span className="dot pulse" style={{ background: 'var(--accent)' }} />
            ) : (
              <span className="source-chip">{agent.source === 'global' ? 'G' : 'W'}</span>
            )}
          </span>
        </button>
      ))}
    </>
  );

  if (panel) return <div className="side-list">{body}</div>;

  return (
    <CollapsibleSection
      label="Agents"
      count={agents.length}
      expanded={expanded}
      onToggle={() => toggleSection('agents')}
      action={
        <button className="icon-btn" title="New agent" onClick={() => setModal('agent')}>+</button>
      }
    >
      {body}
    </CollapsibleSection>
  );
}
