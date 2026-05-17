import React from 'react';
import { TaskConfig } from '../../types';
import { useStore } from '../../store/useStore';

interface TaskCardProps {
  task: TaskConfig;
  selected: boolean;
  onSelect: (id: string) => void;
  onAction: (id: string) => void;
}

function AgentAvatar({ agentId, size = 18 }: { agentId: string; size?: number }) {
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}m`;
  return 'now';
}

export default function TaskCard({ task, selected, onSelect, onAction }: TaskCardProps) {
  const isRunning = task.status === 'running';
  const age = timeAgo(task.createdAt);

  return (
    <div
      className={'task' + (selected ? ' is-selected' : '')}
      onClick={() => onSelect(task.id)}
    >
      <div className="task-hd">
        <span className="task-id">{task.id}</span>
        <span className="task-age">{age}</span>
      </div>
      <div className="task-title">{task.title}</div>
      <div className="task-ft">
        <div className="task-meta">
          <AgentAvatar agentId={task.agent} size={18} />
          <span className="task-meta-name">{task.agent}</span>
          <span className="task-meta-sep">/</span>
          <span className="task-meta-ws">{task.workspace}</span>
        </div>
        <button
          className={'task-run' + (isRunning ? ' is-running' : '')}
          onClick={e => {
            e.stopPropagation();
            onAction(task.id);
          }}
        >
          {isRunning ? (
            <>
              <span className="run-glyph">■</span>
              Stop
            </>
          ) : (
            <>
              <span className="run-glyph">▶</span>
              Run
            </>
          )}
        </button>
      </div>
      {task.session_id && (
        <div className="task-session">
          <span className="mono">{task.session_id}</span>
        </div>
      )}
    </div>
  );
}
