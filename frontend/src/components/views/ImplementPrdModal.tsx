import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { implementPrd } from '../../api/client';
import TaskTypeFields, { applyTaskTypeSelection } from '../kanban/TaskTypeFields';

function titleFromPrd(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
}

function defaultImplementTypeId(types: { id: string; default?: boolean }[]): string {
  return types.find(t => t.id === 'implement')?.id
    ?? types.find(t => t.default)?.id
    ?? '';
}

interface ImplementPrdModalProps {
  open: boolean;
  prdPath: string;
  prdContent: string;
  onClose: () => void;
  onCreated?: (taskId: string) => void;
}

export default function ImplementPrdModal({
  open,
  prdPath,
  prdContent,
  onClose,
  onCreated,
}: ImplementPrdModalProps) {
  const workflows = useStore(s => s.workflows);
  const taskTypes = useStore(s => s.taskTypes);
  const addTask = useStore(s => s.addTask);
  const openWorkspaceTab = useStore(s => s.openWorkspaceTab);

  const [title, setTitle] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const name = prdPath.split('/').pop() ?? prdPath;
    setTitle(titleFromPrd(prdContent, name));
    const typeId = defaultImplementTypeId(taskTypes);
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
      setWorkflowId(workflows[0]?.id || 'single-shot');
      setSkillIds([]);
    }
    setSkillSearch('');
  }, [open, prdPath, prdContent, workflows, taskTypes]);

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
      const task = await implementPrd({
        prdPath,
        title: title.trim(),
        agent: agentId,
        workflow: workflowId,
        skills: skillIds,
        taskType: taskTypeId || undefined,
      });
      addTask(task);
      onClose();
      onCreated?.(task.id);
      openWorkspaceTab('tasks');
    } catch (err) {
      console.error('Failed to implement PRD as task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 560 }} onMouseDown={e => e.stopPropagation()}>
        <header className="modal-hd">
          <div>
            <div className="modal-eyebrow">Implement PRD</div>
            <h2 className="modal-title">Create task from PRD</h2>
            <p className="field-hint mono">{prdPath}</p>
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
            {selectedWorkflow?.type === 'loop' ? 'Creates project task' : 'Creates simple task'}
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
