import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { createTask, getPrdFiles } from '../../api/client';
import { PrdFile } from '../../types';
import TaskTypeFields from './TaskTypeFields';
import { isRalphLoopWorkflow } from '../../utils/workflowOptions';

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (taskId: string, openPlanEditor: boolean) => void;
}

export default function CreateTaskModal({ open, onClose, onCreated }: CreateTaskModalProps) {
  const workflows = useStore(s => s.workflows);
  const taskTypes = useStore(s => s.taskTypes);
  const selectedSkills = useStore(s => s.selectedSkills);
  const addTask = useStore(s => s.addTask);
  const loadWorkspaceData = useStore(s => s.loadWorkspaceData);

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
    if (open) {
      void loadWorkspaceData();
      setTitle('');
      setDescription('');
      setTaskTypeId('');
      setAgentId('');
      setWorkflowId('single-shot');
      setSkillIds([...selectedSkills]);
      setSkillSearch('');
      setPrdPath('');
      getPrdFiles().then(setPrds).catch(() => setPrds([]));
    }
  }, [open, selectedSkills, loadWorkspaceData]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selectedWorkflow = workflows.find(w => w.id === workflowId);
  const valid = title.trim().length > 0 && (workflowId || taskTypeId);

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const task = await createTask({
        title: title.trim(),
        agent: agentId,
        workflow: workflowId,
        skills: skillIds,
        description: description.trim(),
        prd: prdPath || undefined,
        taskType: taskTypeId || undefined,
      });
      addTask(task);
      onClose();
      onCreated?.(task.id, isRalphLoopWorkflow(workflowId));
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 560 }} onMouseDown={e => e.stopPropagation()}>
        <header className="modal-hd">
          <div>
            <div className="modal-eyebrow">New task</div>
            <h2 className="modal-title">Create a task</h2>
          </div>
          <button className="modal-x" onClick={onClose}>✕</button>
        </header>

        <div className="modal-body">
          <div className="form-grid">
            <div className="field">
              <label className="field-lbl"><span>Title</span></label>
              <textarea className="text" rows={2} autoFocus value={title} onChange={e => setTitle(e.target.value)} />
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
            />

            <div className="field">
              <label className="field-lbl">
                <span>PRD</span>
                <span className="field-hint">optional — markdown spec from prd folder</span>
              </label>
              <select className="text mono" value={prdPath} onChange={e => setPrdPath(e.target.value)}>
                <option value="">None</option>
                {prds.map(p => (
                  <option key={p.id} value={p.path}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-lbl">
                <span>Notes</span>
                <span className="field-hint">short task instructions only — not chat logs</span>
              </label>
              <textarea className="text mono" rows={5} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <p className="field-hint muted" style={{ margin: 0 }}>
              New tasks stay in <strong>Todo</strong>. Move to <strong>Planned</strong> (or click Run) to execute.
              Auto-queue only picks <strong>Planned</strong> tasks.
            </p>
          </div>
        </div>

        <footer className="modal-ft">
          <div className="modal-ft-meta muted">
            Simple task
            {selectedWorkflow?.agent ? ` · agent ${selectedWorkflow.agent}` : ''}
            {selectedWorkflow?.skills?.length ? ` · skills ${selectedWorkflow.skills.join(', ')}` : ''}
            {taskTypeId && ` · ${taskTypes.find(t => t.id === taskTypeId)?.name ?? taskTypeId}`}
          </div>
          <div className="modal-ft-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!valid || submitting}>
              {submitting ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
