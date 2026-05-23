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
      title={agent.name}
    >
      {agent.name.slice(0, 2)}
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
  const taskPlans = useStore(s => s.taskPlans);
  const plan = taskPlans[task.id];
  const total = plan?.userStories.length ?? 0;
  const done = plan?.userStories.filter(s => s.passes).length ?? 0;

  return (
    <div
      className={'task' + (selected ? ' is-selected' : '')}
      onClick={() => onSelect(task.id)}
    >
      <div className="task-hd">
        <span className="task-id">{task.id}</span>
        <span className="workflow-badge">{task.workflow}</span>
        <span className="task-age">{age}</span>
      </div>
      <div className="task-title">{task.title}</div>
      {task.type === 'project' && total > 0 && (
        <div className="task-story-bar">
          <div className="task-story-fill" style={{ width: `${(done / total) * 100}%` }} />
          <span className="task-story-label">{done}/{total}</span>
        </div>
      )}
      <div className="task-ft">
        <div className="task-meta">
          {task.agent ? (
            <>
              <AgentAvatar agentId={task.agent} size={18} />
              <span className="task-meta-name">{task.agent}</span>
            </>
          ) : (
            <span className="task-meta-name muted">default agent</span>
          )}
          {task.skills.length > 0 && (
            <span className="task-skills-badge mono">{task.skills.length} skill{task.skills.length === 1 ? '' : 's'}</span>
          )}
          {task.type === 'project' && task.status === 'todo' && (
            <span className="needs-plan">needs plan</span>
          )}
        </div>
        <button
          className={'task-run' + (isRunning ? ' is-running' : '')}
          onClick={e => {
            e.stopPropagation();
            onAction(task.id);
          }}
        >
          {isRunning ? '■ Stop' : '▶ Run'}
        </button>
      </div>
    </div>
  );
}
