import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { getPrdFiles, getTask, updateTask as updateTaskApi } from '../../api/client';
import { PrdFile } from '../../types';
import TaskTypeFields from './TaskTypeFields';

interface EditTaskModalProps {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
}

export default function EditTaskModal({ open, taskId, onClose }: EditTaskModalProps) {
  const tasks = useStore(s => s.tasks);
  const updateTask = useStore(s => s.updateTask);

  const task = tasks.find(t => t.id === taskId);

  const [title, setTitle] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [prdPath, setPrdPath] = useState('');
  const [prds, setPrds] = useState<PrdFile[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !taskId) return;
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    setTitle(t.title);
    setTaskTypeId(t.taskType ?? '');
    setAgentId(t.agent);
    setWorkflowId(t.workflow);
    setPrdPath(t.prd ?? '');
    setSkillIds([...t.skills]);
    setSkillSearch('');
    getPrdFiles().then(setPrds).catch(() => setPrds([]));
    getTask(taskId)
      .then(full => setDescription(full.prompt ?? full.description ?? ''))
      .catch(() => setDescription(t.description ?? ''));
  }, [open, taskId, tasks]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !task) return null;

  const valid = title.trim().length > 0 && (workflowId || taskTypeId);
  const isRunning = task.status === 'running';

  const submit = async () => {
    if (!valid || submitting || isRunning) return;
    setSubmitting(true);
    try {
      const updated = await updateTaskApi(task.id, {
        title: title.trim(),
        agent: agentId,
        workflow: workflowId,
        skills: skillIds,
        prd: prdPath || undefined,
        description: description.trim(),
        taskType: taskTypeId,
      });
      updateTask(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 560 }} onMouseDown={e => e.stopPropagation()}>
        <header className="modal-hd">
          <div>
            <div className="modal-eyebrow">Edit task</div>
            <h2 className="modal-title">{task.id}</h2>
          </div>
          <button className="modal-x" onClick={onClose}>✕</button>
        </header>

        <div className="modal-body">
          {isRunning && (
            <p className="field-hint" style={{ marginBottom: 12 }}>
              Stop the run before editing this task.
            </p>
          )}
          <div className="form-grid">
            <div className="field">
              <label className="field-lbl"><span>Title</span></label>
              <textarea
                className="text"
                rows={2}
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={isRunning}
              />
            </div>

            <TaskTypeFields
              taskTypeId={taskTypeId}
              agentId={agentId}
              workflowId={workflowId}
              skillIds={skillIds}
              onTaskTypeChange={setTaskTypeId}
              onAgentChange={setAgentId}
              onWorkflowChange={setWorkflowId}
              onSkillIdsChange={setSkillIds}
              skillSearch={skillSearch}
              onSkillSearchChange={setSkillSearch}
              disabled={isRunning}
            />

            <div className="field">
              <label className="field-lbl">
                <span>PRD</span>
                <span className="field-hint">optional</span>
              </label>
              <select className="text mono" value={prdPath} onChange={e => setPrdPath(e.target.value)} disabled={isRunning}>
                <option value="">None</option>
                {prds.map(p => (
                  <option key={p.id} value={p.path}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-lbl">
                <span>Notes</span>
                <span className="field-hint">extra context</span>
              </label>
              <textarea
                className="text mono"
                rows={5}
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={isRunning}
              />
            </div>
          </div>
        </div>

        <footer className="modal-ft">
          <div className="modal-ft-meta muted">
            {task.status} · {task.type}{task.taskType ? ` · ${task.taskType}` : ''}
          </div>
          <div className="modal-ft-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!valid || submitting || isRunning}>
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
