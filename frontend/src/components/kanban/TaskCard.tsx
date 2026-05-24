import React from 'react';
import { TaskConfig } from '../../types';
import { useStore } from '../../store/useStore';

interface TaskCardProps {
  task: TaskConfig;
  selected: boolean;
  dragging?: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onContinueInChat?: (id: string, e: React.MouseEvent) => void;
  onNudge?: (id: string, e: React.MouseEvent) => void;
  onAction: (id: string) => void;
  onDragStart?: (taskId: string, e: React.DragEvent) => void;
  onDragEnd?: () => void;
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

export default function TaskCard({
  task, selected, dragging, onSelect, onEdit, onContinueInChat, onNudge, onAction, onDragStart, onDragEnd,
}: TaskCardProps) {
  const taskTypes = useStore(s => s.taskTypes);
  const isRunning = task.status === 'running';
  const isInactive = task.status === 'done' || task.status === 'archive';
  const canNudge = !isRunning && !isInactive;
  const age = timeAgo(task.createdAt);

  return (
    <div
      className={'task' + (selected ? ' is-selected' : '') + (dragging ? ' is-dragging' : '')}
      draggable
      onDragStart={e => onDragStart?.(task.id, e)}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => onSelect(task.id)}
    >
      <span className="task-drag-hint" title="Drag to move">⠿</span>
      <div className="task-hd">
        <span className="task-id">{task.id}</span>
        <span className="workflow-badge">{task.workflow}</span>
        {task.taskType && (
          <span className="task-type-badge" title="Task type">
            {taskTypes.find(t => t.id === task.taskType)?.name ?? task.taskType}
          </span>
        )}
        <span className="task-age">{age}</span>
      </div>
      <div className="task-title">{task.title}</div>
      {task.prd && (
        <div className="task-prd-badge mono" title={task.prd}>PRD</div>
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
        </div>
        <div className="task-actions">
          {task.session_id && onContinueInChat && (
            <button
              className="task-chat"
              onClick={e => onContinueInChat(task.id, e)}
              title="Continue in chat with active session"
            >
              💬 Chat
            </button>
          )}
          <button
            className="task-edit"
            onClick={e => {
              e.stopPropagation();
              onEdit(task.id);
            }}
          >
            ✎ Edit
          </button>
          {canNudge && onNudge && (
            <button
              className="task-nudge"
              onClick={e => onNudge(task.id, e)}
              title="Nudge agent to continue this task"
            >
              ↻ Nudge
            </button>
          )}
          {!isInactive && (
            <button
              className={'task-run' + (isRunning ? ' is-running' : '')}
              onClick={e => {
                e.stopPropagation();
                onAction(task.id);
              }}
            >
              {isRunning ? '■ Stop' : '▶ Run'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
