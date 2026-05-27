import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  addTaskComment,
  extractTaskQuestions,
  getTaskComments,
  getTaskMarkdown,
  getTaskPlan,
  getTaskProgress,
  runTask,
  runTaskPlanPhase,
  saveTaskMarkdown,
  wsManager,
} from '../../api/client';
import { isRalphLoopWorkflow } from '../../utils/workflowOptions';
import { getRalphRunBlockMessage } from '../../utils/ralphLoop';
import RalphPlanPanel from './RalphPlanPanel';
import TaskQuestionsPanel from './TaskQuestionsPanel';
import { findPendingQuestionsComment } from '../../utils/taskQuestions';
import MarkdownEditor from '../common/MarkdownEditor';
import Icon, { IconName } from '../common/Icon';
import { TaskComment, TaskStatus } from '../../types';
import { MANUAL_STATUSES } from './kanbanColumns';

interface TaskDetailProps {
  taskId: string | null;
  fullPage?: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveStatus?: (status: TaskStatus) => void;
  onEditPlan?: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function authorLabel(c: TaskComment): string {
  return c.authorName ?? (c.author === 'user' ? 'You' : c.author === 'agent' ? 'Agent' : 'System');
}

function statusPillClass(status: TaskStatus): string {
  if (status === 'running') return 'doing';
  if (status === 'planned' || status === 'todo') return 'todo';
  if (status === 'review' || status === 'awaiting_confirmation') return 'review';
  if (status === 'done') return 'done';
  if (status === 'archive') return 'todo';
  return 'todo';
}

function statusLabel(status: TaskStatus): string {
  if (status === 'awaiting_confirmation') return 'Awaiting confirmation';
  if (status === 'planned') return 'Planned';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

function activityIcon(c: TaskComment): IconName {
  if (c.kind === 'questions') return 'chat';
  if (c.kind === 'activity') return 'flag';
  if (c.author === 'agent') return 'sparkle';
  if (c.author === 'user') return 'user';
  return 'terminal';
}

export default function TaskDetail({
  taskId,
  fullPage,
  onClose,
  onEdit,
  onDelete,
  onMoveStatus,
  onEditPlan,
}: TaskDetailProps) {
  const tasks = useStore(s => s.tasks);
  const taskPlans = useStore(s => s.taskPlans);
  const setTaskPlan = useStore(s => s.setTaskPlan);
  const taskProgress = useStore(s => s.taskProgress);
  const taskComments = useStore(s => s.taskComments);
  const setTaskComments = useStore(s => s.setTaskComments);
  const appendTaskComment = useStore(s => s.appendTaskComment);
  const openPrdFile = useStore(s => s.openPrdFile);
  const openGoalFile = useStore(s => s.openGoalFile);
  const agents = useStore(s => s.agents);
  const updateTask = useStore(s => s.updateTask);
  const taskRunning = useStore(s => s.taskRunning);
  const setTaskRunning = useStore(s => s.setTaskRunning);
  const openWorkspaceTab = useStore(s => s.openWorkspaceTab);
  const setChatDock = useStore(s => s.setChatDock);
  const bindTaskChatContext = useStore(s => s.bindTaskChatContext);

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [taskMd, setTaskMd] = useState('');
  const [taskMdLoading, setTaskMdLoading] = useState(false);
  const [taskMdSaving, setTaskMdSaving] = useState(false);
  const [extractingQuestions, setExtractingQuestions] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const task = tasks.find(t => t.id === taskId);
  const progress = taskId ? taskProgress[taskId] : '';
  const comments = taskId ? (taskComments[taskId] ?? []) : [];
  const pendingQuestions = findPendingQuestionsComment(comments);
  const threadComments = comments.filter(c => c.kind !== 'questions');
  const lastAgentComment = [...comments].reverse().find(c => c.kind === 'comment' && c.author === 'agent');
  const canExtractQuestions =
    !pendingQuestions &&
    !!lastAgentComment?.body &&
    /\d+[.)]\s*\*\*[^*]+\*\*/.test(lastAgentComment.body);

  const extractQuestionsFromActivity = async () => {
    if (!taskId || extractingQuestions) return;
    setExtractingQuestions(true);
    try {
      await extractTaskQuestions(taskId);
      const r = await getTaskComments(taskId);
      setTaskComments(taskId, r.comments);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setExtractingQuestions(false);
    }
  };

  useEffect(() => {
    if (!taskId) return;
    getTaskProgress(taskId).then(r => {
      useStore.setState(s => ({
        taskProgress: { ...s.taskProgress, [taskId]: r.content },
      }));
    }).catch(() => {});
    getTaskComments(taskId).then(r => setTaskComments(taskId, r.comments)).catch(() => {});
  }, [taskId, setTaskComments]);

  const isRalphLoop = task ? isRalphLoopWorkflow(task.workflow) : false;
  const plan = taskId ? taskPlans[taskId] : undefined;
  const storyCount = plan?.userStories?.length ?? 0;
  const pendingStories = plan?.userStories?.filter(s => !s.passes).length ?? 0;

  useEffect(() => {
    if (!taskId || !isRalphLoop) return;
    getTaskPlan(taskId)
      .then(p => setTaskPlan(taskId, p))
      .catch(() => setTaskPlan(taskId, { userStories: [] }));
  }, [taskId, isRalphLoop, task?.status, task?.updatedAt, setTaskPlan]);

  useEffect(() => {
    if (!taskId || task?.status !== 'running') return;
    const interval = window.setInterval(() => {
      getTaskProgress(taskId).then(r => {
        useStore.setState(s => ({
          taskProgress: { ...s.taskProgress, [taskId]: r.content },
        }));
      }).catch(() => {});
      getTaskComments(taskId).then(r => setTaskComments(taskId, r.comments)).catch(() => {});
    }, 2500);
    return () => window.clearInterval(interval);
  }, [taskId, task?.status, setTaskComments]);

  useEffect(() => {
    if (!taskId) return;
    setTaskMdLoading(true);
    getTaskMarkdown(taskId)
      .then(r => setTaskMd(r.content))
      .catch(() => setTaskMd(''))
      .finally(() => setTaskMdLoading(false));
  }, [taskId, task?.status, task?.updatedAt]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'auto' });
  }, [threadComments.length]);

  if (!taskId || !task) return null;

  const isRunning = task.status === 'running' || taskRunning;
  const canNudge =
    !isRalphLoop && !isRunning && task.status !== 'done' && task.status !== 'archive';
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

  const ensureCanRun = (nudge = false): boolean => {
    if (!wsManager.isConnected) {
      window.alert('Not connected to the server. Wait a moment and try again.');
      return false;
    }
    const block = getRalphRunBlockMessage(task.workflow, storyCount, comments, nudge);
    if (block) {
      window.alert(block);
      return false;
    }
    return true;
  };

  const nudgeAgent = () => {
    if (!ensureCanRun(true)) return;
    setTaskRunning(true);
    runTask(task.id, true);
  };

  const runAgent = () => {
    if (!ensureCanRun(false)) return;
    setTaskRunning(true);
    runTask(task.id, false);
  };

  const continueAfterQuestions = () => {
    if (!wsManager.isConnected) {
      window.alert('Not connected to the server. Wait a moment and try again.');
      return;
    }
    setTaskRunning(true);
    if (isRalphLoop) {
      runTaskPlanPhase(task.id, 'write-prd');
    } else {
      runTask(task.id, true);
    }
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

  const header = (
    <header className="task-detail-hd">
      <div className="task-detail-hd-main">
        {fullPage && (
          <button type="button" className="btn btn-sm task-detail-back" onClick={onClose}>
            ✕ Close
          </button>
        )}
        <h3>{task.title}</h3>
      </div>
      <div className="task-detail-hd-actions">
        {onEdit && (
          <button className="btn btn-sm" onClick={onEdit}>Edit</button>
        )}
        {onDelete && (
          <button className="btn btn-sm danger" onClick={onDelete}>Delete</button>
        )}
        {!fullPage && (
          <button className="modal-x" onClick={onClose}>✕</button>
        )}
      </div>
    </header>
  );

  const meta = (
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
  );

  const actions = (
    <div className="task-detail-actions-row">
      {canNudge && (
        <button className="btn btn-sm btn-nudge" onClick={nudgeAgent} title="Send task + comments to agent now">
          ↻ Nudge
        </button>
      )}
      {!isRunning && task.status !== 'done' && task.status !== 'archive' && (
        <button className="btn btn-sm" onClick={runAgent}>▶ Run</button>
      )}
      {onMoveStatus && task.status !== 'done' && task.status !== 'archive' && (
        <>
          <button className="btn btn-sm" onClick={() => moveTo('done')}>✓ Done</button>
          <button className="btn btn-sm" onClick={() => moveTo('archive')}>Archive</button>
        </>
      )}
    </div>
  );

  const planSection =
    isRalphLoop && task ? (
      <RalphPlanPanel
        task={task}
        storyCount={storyCount}
        pendingStories={pendingStories}
        onEditPlan={onEditPlan}
        onRunningChange={setTaskRunning}
      />
    ) : null;

  const links = (
    <>
      {planSection}
      {task.prd && (
        <section className="task-detail-section">
          <div className="task-detail-section-hd">
            <span>PRD</span>
            <button className="btn btn-sm" onClick={() => openPrdFile(task.prd!)}>Open</button>
          </div>
          <p className="mono muted">{task.prd}</p>
        </section>
      )}
      {task.goal && (
        <section className="task-detail-section">
          <div className="task-detail-section-hd">
            <span>Goal</span>
            <button className="btn btn-sm" onClick={() => openGoalFile(task.goal!)}>Open</button>
          </div>
          <p className="mono muted">{task.goal}</p>
          {task.taskType === 'goals' && (
            <p className="field-hint">Runs via <span className="mono">/goal goals/{task.goal}</span> slash command.</p>
          )}
        </section>
      )}
    </>
  );

  const taskFile = (
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
  );

  const progressSection = (
    <section className="task-detail-section">
      <p className="task-detail-section-hd">Progress log</p>
      <pre className="progress-log mono">{progress || 'No progress yet.'}</pre>
    </section>
  );

  const questionsSection =
    pendingQuestions && task ? (
      <TaskQuestionsPanel
        taskId={taskId!}
        prdPath={task.prd}
        comment={pendingQuestions}
        isRunning={isRunning}
        onAnswered={() => {
          getTaskComments(taskId!).then(r => setTaskComments(taskId!, r.comments)).catch(() => {});
        }}
        onContinueRun={continueAfterQuestions}
        continueLabel={isRalphLoop ? 'Submit & run PRD skill' : undefined}
      />
    ) : null;

  const commentsSection = (
    <section className="task-detail-section task-comments-section">
      <div className="task-detail-section-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>Activity</span>
        {canExtractQuestions && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={extractingQuestions || isRunning}
            onClick={() => void extractQuestionsFromActivity()}
          >
            {extractingQuestions ? 'Extracting…' : 'Open as Q&A'}
          </button>
        )}
      </div>
      <div className="task-comments-thread" ref={threadRef}>
        {threadComments.length === 0 && (
          <p className="muted task-comments-empty">No comments yet — run the task or leave feedback for the agent.</p>
        )}
        {threadComments.map(c => (
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
  );

  const agentName = agents.find(a => a.id === task.agent)?.name ?? task.agent;
  const updatedLabel = formatTime(task.updatedAt);

  const openChatForTask = () => {
    void bindTaskChatContext(taskId);
    setChatDock('center');
    openWorkspaceTab('chat');
  };

  if (fullPage) {
    return (
      <div className="taskdetail">
        <div className="taskmain">
          <div className="taskdetail-badges">
            <span className={`status-pill ${statusPillClass(task.status)}`}>{statusLabel(task.status)}</span>
            <span className="taskdetail-tag">{task.workflow}</span>
            <span className="taskdetail-id mono">#{task.id}</span>
          </div>
          <h1>{task.title}</h1>
          <div className="meta-row">
            <span><Icon name="user" size={12} /> {agentName}</span>
            <span>•</span>
            <span>{task.type}</span>
            <span>•</span>
            <span>Updated {updatedLabel}</span>
          </div>

          {isRalphLoop && task && (
            <RalphPlanPanel
              task={task}
              storyCount={storyCount}
              pendingStories={pendingStories}
              onEditPlan={onEditPlan}
              onRunningChange={setTaskRunning}
            />
          )}

          {(task.description || taskMd) && (
            <>
              <h3>Description</h3>
              <p className="taskdetail-desc">
                {task.description || 'Edit task.md below for full details.'}
              </p>
            </>
          )}

          <h3>Task file</h3>
          <p className="taskdetail-desc muted">Status and metadata live in <span className="mono">task.md</span> on disk.</p>
          <MarkdownEditor
            path="task.md"
            content={taskMd}
            onChange={setTaskMd}
            onSave={saveTaskMd}
            saving={taskMdSaving}
            loading={taskMdLoading}
          />

          {task.prd && (
            <>
              <h3>PRD</h3>
              <button type="button" className="btn btn-sm" onClick={() => openPrdFile(task.prd!)}>
                <Icon name="file" size={12} /> Open {task.prd}
              </button>
            </>
          )}
          {task.goal && (
            <>
              <h3>Goal</h3>
              <button type="button" className="btn btn-sm" onClick={() => openGoalFile(task.goal!)}>
                <Icon name="target" size={12} /> Open {task.goal}
              </button>
              {task.taskType === 'goals' && (
                <p className="taskdetail-desc muted">
                  Runs via <span className="mono">/goal goals/{task.goal}</span>
                </p>
              )}
            </>
          )}

          <h3>Progress log</h3>
          <pre className="progress-log mono">{progress || 'No progress yet.'}</pre>

          {questionsSection}

          <div className="taskdetail-activity-hd">
            <h3>Activity</h3>
            {canExtractQuestions && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={extractingQuestions || isRunning}
                onClick={() => void extractQuestionsFromActivity()}
              >
                {extractingQuestions ? 'Extracting…' : 'Open as Q&A'}
              </button>
            )}
          </div>
          <div className="taskdetail-activity">
            {threadComments.length === 0 && (
              <p className="muted">No comments yet — run the task or leave feedback for the agent.</p>
            )}
            {threadComments.map(c => (
              <div key={c.id} className="taskdetail-activity-row">
                <div className="taskdetail-activity-ico">
                  <Icon name={activityIcon(c)} size={12} />
                </div>
                <div>
                  <div className="taskdetail-activity-text">
                    <strong>{authorLabel(c)}</strong> {c.body}
                  </div>
                  <div className="taskdetail-activity-time">{formatTime(c.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="task-comment-compose taskdetail-compose">
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
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={postComment}
                disabled={!draft.trim() || posting || isRunning}
              >
                {posting ? 'Posting…' : 'Comment'}
              </button>
            </div>
          </div>
        </div>

        <aside className="taskaside">
          {onMoveStatus && (
            <div className="group">
              <h4>Status</h4>
              <div className="val">
                <select
                  className="input"
                  value={statusSelectValue}
                  style={{ height: 30, fontSize: 12, padding: '0 8px', width: '100%' }}
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
              </div>
            </div>
          )}
          <div className="group">
            <h4>Agent</h4>
            <div className="val">
              <span className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{agentName.charAt(0).toUpperCase()}</span>
              {agentName}
            </div>
          </div>
          <div className="group">
            <h4>Workflow</h4>
            <div className="val"><Icon name="rocket" size={13} /> {task.workflow}</div>
          </div>
          {task.session_id && (
            <div className="group">
              <h4>Session</h4>
              <div className="val mono" style={{ fontSize: 11 }}>{task.session_id.slice(0, 12)}…</div>
            </div>
          )}
          {task.prd && (
            <div className="group">
              <h4>Linked PRD</h4>
              <div className="val" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
                <Icon name="file" size={13} /> {task.prd}
              </div>
            </div>
          )}

          <div className="taskaside-actions">
            <button type="button" className="btn btn-primary btn-block" onClick={openChatForTask}>
              <Icon name="chat" size={13} /> Open chat for this task
            </button>
            {canNudge && (
              <button type="button" className="btn btn-block" onClick={nudgeAgent}>
                <Icon name="refresh" size={13} /> Nudge agent
              </button>
            )}
            {!isRunning && task.status !== 'done' && task.status !== 'archive' && (
              <button type="button" className="btn btn-block" onClick={runAgent}>
                <Icon name="play" size={13} /> Run task
              </button>
            )}
            {onEdit && (
              <button type="button" className="btn btn-block" onClick={onEdit}>Edit task</button>
            )}
            {onMoveStatus && task.status !== 'done' && task.status !== 'archive' && (
              <>
                <button type="button" className="btn btn-block" onClick={() => moveTo('done')}>Mark done</button>
                <button type="button" className="btn btn-block" onClick={() => moveTo('archive')}>Archive</button>
              </>
            )}
            {onDelete && (
              <button type="button" className="btn btn-block danger" onClick={onDelete}>Delete task</button>
            )}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <aside className="task-detail">
      {header}
      {meta}
      {actions}
      {taskFile}
      {links}
      {questionsSection}
      {commentsSection}
      {progressSection}
    </aside>
  );
}
