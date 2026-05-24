import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  addTaskComment,
  getTaskComments,
  getTaskMarkdown,
  getTaskProgress,
  runTask,
  saveTaskMarkdown,
} from '../../api/client';
import MarkdownEditor from '../common/MarkdownEditor';
import { TaskComment, TaskStatus } from '../../types';
import { MANUAL_STATUSES } from './kanbanColumns';

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
  onEdit?: () => void;
  onMoveStatus?: (status: TaskStatus) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function authorLabel(c: TaskComment): string {
  return c.authorName ?? (c.author === 'user' ? 'You' : c.author === 'agent' ? 'Agent' : 'System');
}

export default function TaskDetail({ taskId, onClose, onEdit, onMoveStatus }: TaskDetailProps) {
  const tasks = useStore(s => s.tasks);
  const taskProgress = useStore(s => s.taskProgress);
  const taskComments = useStore(s => s.taskComments);
  const setTaskComments = useStore(s => s.setTaskComments);
  const appendTaskComment = useStore(s => s.appendTaskComment);
  const openPrdFile = useStore(s => s.openPrdFile);
  const updateTask = useStore(s => s.updateTask);
  const running = useStore(s => s.running);
  const setRunning = useStore(s => s.setRunning);
  const continueTaskInChat = useStore(s => s.continueTaskInChat);

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [taskMd, setTaskMd] = useState('');
  const [taskMdLoading, setTaskMdLoading] = useState(false);
  const [taskMdSaving, setTaskMdSaving] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const task = tasks.find(t => t.id === taskId);
  const progress = taskId ? taskProgress[taskId] : '';
  const comments = taskId ? (taskComments[taskId] ?? []) : [];

  useEffect(() => {
    if (!taskId) return;
    getTaskProgress(taskId).then(r => {
      useStore.setState(s => ({
        taskProgress: { ...s.taskProgress, [taskId]: r.content },
      }));
    }).catch(() => {});
    getTaskComments(taskId).then(r => setTaskComments(taskId, r.comments)).catch(() => {});
  }, [taskId, setTaskComments]);

  useEffect(() => {
    if (!taskId) return;
    setTaskMdLoading(true);
    getTaskMarkdown(taskId)
      .then(r => setTaskMd(r.content))
      .catch(() => setTaskMd(''))
      .finally(() => setTaskMdLoading(false));
  }, [taskId, task?.status, task?.updatedAt]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [comments.length]);

  if (!taskId || !task) return null;

  const isRunning = task.status === 'running' || running;
  const canNudge = !isRunning && task.status !== 'done' && task.status !== 'archive';
  const statusSelectValue =
    task.status === 'planned' ? 'todo' : task.status === 'running' ? 'running' : task.status;

  const postComment = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const comment = await addTaskComment(taskId, text);
      appendTaskComment(taskId, comment);
      setDraft('');
    } finally {
      setPosting(false);
    }
  };

  const nudgeAgent = () => {
    setRunning(true);
    runTask(task.id, true);
  };

  const runAgent = () => {
    setRunning(true);
    runTask(task.id, false);
  };

  const saveTaskMd = async () => {
    if (!taskId || taskMdSaving) return;
    setTaskMdSaving(true);
    try {
      const result = await saveTaskMarkdown(taskId, taskMd);
      setTaskMd(result.content);
      updateTask(result.task);
    } finally {
      setTaskMdSaving(false);
    }
  };

  const moveTo = (status: TaskStatus) => {
    onMoveStatus?.(status);
  };

  return (
    <aside className="task-detail">
      <header className="task-detail-hd">
        <h3>{task.title}</h3>
        <div className="task-detail-hd-actions">
          {onEdit && (
            <button className="btn btn-sm" onClick={onEdit}>Edit</button>
          )}
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>
      </header>

      <div className="task-detail-meta mono">
        {task.id} · {task.workflow}
        {onMoveStatus && (
          <label className="task-status-select">
            <span>Status</span>
            <select
              value={statusSelectValue}
              onChange={e => {
                const next = e.target.value as TaskStatus;
                if (next !== 'running') onMoveStatus(next);
              }}
            >
              {task.status === 'running' && <option value="running">Running</option>}
              {MANUAL_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="task-detail-actions-row">
        {task.session_id && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void continueTaskInChat(task.id)}
            title={`Resume session ${task.session_id.slice(0, 8)}…`}
          >
            💬 Continue in chat
          </button>
        )}
        {canNudge && (
          <button className="btn btn-sm btn-nudge" onClick={nudgeAgent} title="Send task + comments to agent now">
            ↻ Nudge agent
          </button>
        )}
        {!isRunning && task.status !== 'done' && task.status !== 'archive' && (
          <button className="btn btn-sm" onClick={runAgent}>▶ Run (manual)</button>
        )}
        {onMoveStatus && task.status !== 'done' && task.status !== 'archive' && (
          <>
            <button className="btn btn-sm" onClick={() => moveTo('done')}>✓ Done</button>
            <button className="btn btn-sm" onClick={() => moveTo('archive')}>Archive</button>
          </>
        )}
      </div>

      <section className="task-detail-section">
        <p className="task-detail-section-hd">Task file</p>
        <p className="muted task-detail-hint">Status and metadata live in <span className="mono">task.md</span> on disk.</p>
        <MarkdownEditor
          path="task.md"
          content={taskMd}
          onChange={setTaskMd}
          onSave={saveTaskMd}
          saving={taskMdSaving}
          loading={taskMdLoading}
        />
      </section>

      {task.prd && (
        <section className="task-detail-section">
          <div className="task-detail-section-hd">
            <span>PRD</span>
            <button className="btn btn-sm" onClick={() => openPrdFile(task.prd!)}>Open</button>
          </div>
          <p className="mono muted">{task.prd}</p>
        </section>
      )}

      <section className="task-detail-section task-comments-section">
        <p className="task-detail-section-hd">Activity</p>
        <div className="task-comments-thread" ref={threadRef}>
          {comments.length === 0 && (
            <p className="muted task-comments-empty">No comments yet — run the task or leave feedback for the agent.</p>
          )}
          {comments.map(c => (
            <article
              key={c.id}
              className={
                'task-comment' +
                (c.author === 'user' ? ' is-user' : '') +
                (c.author === 'agent' ? ' is-agent' : '') +
                (c.kind === 'activity' ? ' is-activity' : '')
              }
            >
              <header className="task-comment-hd">
                <span className="task-comment-author">{authorLabel(c)}</span>
                <time className="task-comment-time mono">{formatTime(c.createdAt)}</time>
              </header>
              <div className="task-comment-body">{c.body}</div>
            </article>
          ))}
        </div>

        <div className="task-comment-compose">
          <textarea
            className="text task-comment-input"
            rows={3}
            placeholder="Leave a comment for the agent…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                postComment();
              }
            }}
            disabled={isRunning}
          />
          <div className="task-comment-compose-ft">
            <span className="field-hint">⌘/Ctrl + Enter to post</span>
            <button className="btn btn-primary btn-sm" onClick={postComment} disabled={!draft.trim() || posting || isRunning}>
              {posting ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>
      </section>

      <section className="task-detail-section">
        <p className="task-detail-section-hd">Progress log</p>
        <pre className="progress-log mono">{progress || 'No progress yet.'}</pre>
      </section>
    </aside>
  );
}
