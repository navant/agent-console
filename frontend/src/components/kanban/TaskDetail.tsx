import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { confirmTask, getTaskPlan, getTaskProgress, rejectTask } from '../../api/client';

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
}

export default function TaskDetail({ taskId, onClose }: TaskDetailProps) {
  const tasks = useStore(s => s.tasks);
  const taskPlans = useStore(s => s.taskPlans);
  const taskProgress = useStore(s => s.taskProgress);
  const setTaskPlan = useStore(s => s.setTaskPlan);
  const setModal = useStore(s => s.setModal);
  const updateTask = useStore(s => s.updateTask);

  const task = tasks.find(t => t.id === taskId);
  const plan = taskId ? taskPlans[taskId] : null;
  const progress = taskId ? taskProgress[taskId] : '';

  useEffect(() => {
    if (!taskId || task?.type !== 'project') return;
    if (taskPlans[taskId]) return;
    getTaskPlan(taskId).then(p => setTaskPlan(taskId, p)).catch(() => {});
  }, [taskId, task?.type, taskPlans, setTaskPlan]);

  useEffect(() => {
    if (!taskId) return;
    getTaskProgress(taskId).then(r => {
      useStore.setState(s => ({
        taskProgress: { ...s.taskProgress, [taskId]: r.content },
      }));
    }).catch(() => {});
  }, [taskId]);

  if (!taskId || !task) return null;

  const total = plan?.userStories.length ?? 0;
  const done = plan?.userStories.filter(s => s.passes).length ?? 0;

  return (
    <aside className="task-detail">
      <header className="task-detail-hd">
        <h3>{task.title}</h3>
        <button className="modal-x" onClick={onClose}>✕</button>
      </header>

      <div className="task-detail-meta mono">
        {task.id} · {task.workflow} · {task.type}
      </div>

      {task.type === 'project' && total > 0 && (
        <div className="story-progress">
          <div className="story-progress-bar" style={{ width: `${(done / total) * 100}%` }} />
          <span>{done}/{total} stories</span>
        </div>
      )}

      {task.type === 'project' && (
        <section className="task-detail-section">
          <div className="task-detail-section-hd">
            <span>Stories</span>
            <button className="btn btn-sm" onClick={() => setModal('plan')}>Edit plan</button>
          </div>
          {plan?.userStories.map(s => (
            <div key={s.id} className={'story-row' + (s.passes ? ' is-pass' : '')}>
              <span>{s.passes ? '✓' : '○'}</span>
              <span>{s.title}</span>
            </div>
          ))}
        </section>
      )}

      {task.status === 'awaiting_confirmation' && (
        <section className="task-detail-section task-detail-actions">
          <p className="task-detail-section-hd">Confirmation</p>
          <p className="muted">Review the run, then approve or send back to todo.</p>
          <div className="task-confirm-btns">
            <button
              className="btn btn-primary"
              onClick={async () => {
                const updated = await confirmTask(task.id);
                updateTask(updated);
              }}
            >
              ✓ Approve → Done
            </button>
            <button
              className="btn"
              onClick={async () => {
                const updated = await rejectTask(task.id);
                updateTask(updated);
              }}
            >
              ↩ Reject → Todo
            </button>
          </div>
        </section>
      )}

      <section className="task-detail-section">
        <p className="task-detail-section-hd">Progress</p>
        <pre className="progress-log mono">{progress || 'No progress yet.'}</pre>
      </section>
    </aside>
  );
}
