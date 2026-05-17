import React from 'react';
import { useStore } from '../../store/useStore';

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={pulse ? 'dot pulse' : 'dot'}
      style={{ background: color }}
    />
  );
}

function AgentAvatar({ agentId, size = 22 }: { agentId: string; size?: number }) {
  const agents = useStore(s => s.agents);
  const agent = agents.find(a => a.id === agentId);
  if (!agent) return null;
  const initials = agent.name.slice(0, 2);
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: agent.tint + '33',
        color: agent.tint,
        fontSize: Math.round(size * 0.42),
      }}
      title={agent.name}
    >
      {initials}
    </span>
  );
}

function SidebarSection({
  label,
  count,
  children,
  action,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="side-sect">
      <div className="side-sect-hd">
        <span>{label}</span>
        <span className="side-sect-meta">
          <span className="count">{count}</span>
          {action}
        </span>
      </div>
      <div className="side-list">{children}</div>
    </div>
  );
}

export default function Sidebar() {
  const agents = useStore(s => s.agents);
  const workspaces = useStore(s => s.workspaces);
  const skills = useStore(s => s.skills);
  const tasks = useStore(s => s.tasks);
  const selectedAgent = useStore(s => s.selectedAgent);
  const setSelectedAgent = useStore(s => s.setSelectedAgent);
  const setChatAgent = useStore(s => s.setChatAgent);
  const setModal = useStore(s => s.setModal);
  const wsConnected = useStore(s => s.wsConnected);

  const runningAgentIds = new Set(
    tasks.filter(t => t.status === 'running').map(t => t.agent)
  );

  return (
    <aside className="sidebar" data-screen-label="sidebar">
      <div className="brand">
        <div className="brand-mark">◆</div>
        <div className="brand-text">
          <div className="brand-title">Agent Control</div>
          <div className="brand-sub">
            localhost:3000 · {wsConnected ? 'connected' : 'connecting…'}
          </div>
        </div>
      </div>

      <SidebarSection
        label="Agents"
        count={agents.length}
        action={
          <button
            className="icon-btn"
            title="New agent"
            onClick={() => setModal('agent')}
          >
            +
          </button>
        }
      >
        {agents.map(agent => (
          <button
            key={agent.id}
            className={'side-row' + (selectedAgent === agent.id ? ' is-selected' : '')}
            onClick={() => {
              setSelectedAgent(agent.id);
              setChatAgent(agent.id);
            }}
          >
            <AgentAvatar agentId={agent.id} size={20} />
            <span className="side-row-name">{agent.name}</span>
            <span className="side-row-meta">
              {runningAgentIds.has(agent.id) ? (
                <Dot color="var(--accent)" pulse />
              ) : (
                <span className="model-chip">{agent.model.split('-')[1]}</span>
              )}
            </span>
          </button>
        ))}
      </SidebarSection>

      <SidebarSection
        label="Workspaces"
        count={workspaces.length}
        action={
          <button
            className="icon-btn"
            title="New workspace"
            onClick={() => setModal('workspace')}
          >
            +
          </button>
        }
      >
        {workspaces.map(ws => (
          <button key={ws.id} className="side-row">
            <span className="folder-glyph">▸</span>
            <span className="side-row-name">{ws.name}</span>
            <span className="side-row-path">{ws.path}</span>
          </button>
        ))}
      </SidebarSection>

      <SidebarSection label="Skills" count={skills.length}>
        {skills.map(skill => (
          <button key={skill.id} className="side-row side-row--quiet">
            <span className="skill-glyph">◇</span>
            <span className="side-row-name">{skill.name}</span>
            <span className="side-row-meta side-row-meta--faint">read-only</span>
          </button>
        ))}
      </SidebarSection>

      <div className="side-footer">
        <span>claude · agent-control-panel</span>
        <span className="ok-dot">●</span>
      </div>
    </aside>
  );
}
