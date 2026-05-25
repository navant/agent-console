import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { invokeGoal, runTask } from '../../api/client';
import TaskTypeFields, { applyTaskTypeSelection } from '../kanban/TaskTypeFields';
import { TaskTypeDef } from '../../types';

function titleFromGoal(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
}

function defaultGoalsTypeId(types: TaskTypeDef[]): string {
  return types.find(t => t.id === 'goals')?.id
    ?? types.find(t => t.name.toLowerCase() === 'goals')?.id
    ?? types.find(t => t.default)?.id
    ?? types[0]?.id
    ?? '';
}

function goalsTaskTitle(goalTitle: string, taskType: TaskTypeDef | undefined): string {
  const isGoals =
    taskType?.id === 'goals' || taskType?.name.toLowerCase() === 'goals';
  if (!isGoals) return goalTitle;
  if (/^goal:/i.test(goalTitle.trim())) return goalTitle;
  return `Goal: ${goalTitle}`;
}

interface InvokeGoalModalProps {
  open: boolean;
  goalPath: string;
  goalContent: string;
  onClose: () => void;
  onCreated?: (taskId: string) => void;
}

export default function InvokeGoalModal({
  open,
  goalPath,
  goalContent,
  onClose,
  onCreated,
}: InvokeGoalModalProps) {
  const workflows = useStore(s => s.workflows);
  const taskTypes = useStore(s => s.taskTypes);
  const addTask = useStore(s => s.addTask);
  const setRunning = useStore(s => s.setRunning);
  const openTaskTab = useStore(s => s.openTaskTab);

  const [title, setTitle] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const name = goalPath.split('/').pop() ?? goalPath;
    const typeId = defaultGoalsTypeId(taskTypes);
    const typeDef = taskTypes.find(t => t.id === typeId);
    setTitle(goalsTaskTitle(titleFromGoal(goalContent, name), typeDef));
    setTaskTypeId(typeId);
    if (typeId) {
      const applied = applyTaskTypeSelection(typeId, taskTypes);
      if (applied) {
        setAgentId(applied.agentId);
        setWorkflowId(applied.workflowId);
        setSkillIds(applied.skillIds);
      }
    } else {
      setAgentId('');
      setWorkflowId(workflows.find(w => w.id === 'single-shot')?.id ?? workflows[0]?.id ?? 'single-shot');
      setSkillIds([]);
    }
    setSkillSearch('');
  }, [open, goalPath, goalContent, workflows, taskTypes]);

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
      const task = await invokeGoal({
        goalPath,
        title: title.trim(),
        agent: agentId,
        workflow: workflowId,
        skills: skillIds,
        taskType: taskTypeId || undefined,
      });
      addTask(task);
      onClose();
      onCreated?.(task.id);
      openTaskTab(task.id);
      runTask(task.id);
      setRunning(true);
    } catch (err) {
      console.error('Failed to invoke goal as task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 560 }} onMouseDown={e => e.stopPropagation()}>
        <header className="modal-hd">
          <div>
            <div className="modal-eyebrow">Run goal</div>
            <h2 className="modal-title">Create goals task</h2>
            <p className="field-hint mono">{goalPath}</p>
            <p className="field-hint">Runs <span className="mono">/goal goals/…</span> via Claude slash command.</p>
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
          </div>
        </div>

        <footer className="modal-ft">
          <div className="modal-ft-meta muted">
            Slash command task
            {taskTypeId && ` · ${taskTypes.find(t => t.id === taskTypeId)?.name ?? taskTypeId}`}
            {selectedWorkflow && ` · ${selectedWorkflow.name}`}
          </div>
          <div className="modal-ft-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!valid || submitting}>
              {submitting ? 'Creating…' : 'Create & run task'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
