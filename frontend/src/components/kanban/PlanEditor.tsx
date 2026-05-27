import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { getTaskPlan, saveTaskPlan, generateTaskPlan, updateTask as apiUpdateTask } from '../../api/client';
import { isRalphLoopWorkflow } from '../../utils/workflowOptions';
import { PlanConfig, UserStory } from '../../types';

interface PlanEditorProps {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
}

function emptyStory(i: number): UserStory {
  return {
    id: `US-${String(i).padStart(3, '0')}`,
    title: '',
    description: '',
    acceptanceCriteria: [''],
    priority: i,
    passes: false,
  };
}

export default function PlanEditor({ open, taskId, onClose }: PlanEditorProps) {
  const tasks = useStore(s => s.tasks);
  const setTaskPlan = useStore(s => s.setTaskPlan);
  const updateTask = useStore(s => s.updateTask);
  const taskPlans = useStore(s => s.taskPlans);

  const task = tasks.find(t => t.id === taskId);
  const [plan, setPlan] = useState<PlanConfig>({ userStories: [] });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !taskId) return;
    const cached = taskPlans[taskId];
    if (cached) {
      setPlan(cached);
      return;
    }
    getTaskPlan(taskId).then(p => {
      setPlan(p);
      setTaskPlan(taskId, p);
    }).catch(() => setPlan({ userStories: [] }));
  }, [open, taskId, taskPlans, setTaskPlan]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !taskId || !task) return null;

  const story = plan.userStories[selectedIdx];

  const updateStory = (patch: Partial<UserStory>) => {
    const stories = [...plan.userStories];
    stories[selectedIdx] = { ...stories[selectedIdx], ...patch };
    setPlan({ userStories: stories });
  };

  const addStory = () => {
    const stories = [...plan.userStories, emptyStory(plan.userStories.length + 1)];
    setPlan({ userStories: stories });
    setSelectedIdx(stories.length - 1);
  };

  const deleteStory = (idx: number) => {
    const stories = plan.userStories.filter((_, i) => i !== idx);
    setPlan({ userStories: stories });
    setSelectedIdx(Math.max(0, idx - 1));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const generated = await generateTaskPlan(taskId);
      setPlan(generated);
    } catch (err) {
      window.alert(
        `Plan generation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveTaskPlan(taskId, plan);
      setTaskPlan(taskId, saved);
      const needsPlan =
        isRalphLoopWorkflow(task.workflow) || task.type === 'project';
      if (needsPlan && task.status === 'todo' && saved.userStories.length > 0) {
        const updated = await apiUpdateTask(taskId, { status: 'planned' });
        updateTask(updated);
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal plan-editor" style={{ width: 900 }} onMouseDown={e => e.stopPropagation()}>
        <header className="modal-hd">
          <div>
            <div className="modal-eyebrow">Plan · {task.title}</div>
            <h2 className="modal-title">User stories</h2>
          </div>
          <div className="modal-hd-actions">
            <button className="btn" onClick={handleGenerate} disabled={generating} title="Headless Claude — does not use prd/ralph skills">
              {generating ? 'Generating…' : 'Quick generate (no skills)'}
            </button>
            <button className="modal-x" onClick={onClose}>✕</button>
          </div>
        </header>

        <div className="plan-editor-body">
          <div className="plan-stories-list">
            {plan.userStories.map((s, i) => (
              <button
                key={s.id}
                className={'side-row' + (selectedIdx === i ? ' is-selected' : '')}
                onClick={() => setSelectedIdx(i)}
              >
                <span>{s.passes ? '✓' : '○'}</span>
                <span className="side-row-name">{s.title || s.id}</span>
              </button>
            ))}
            <button className="btn btn-sm" onClick={addStory}>+ Add story</button>
          </div>

          {story && (
            <div className="plan-story-editor form-grid">
              <div className="field">
                <label className="field-lbl"><span>Title</span></label>
                <input className="text" value={story.title} onChange={e => updateStory({ title: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-lbl"><span>Description</span></label>
                <textarea className="text" rows={4} value={story.description} onChange={e => updateStory({ description: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-lbl"><span>Acceptance criteria</span></label>
                {story.acceptanceCriteria.map((c, ci) => (
                  <input
                    key={ci}
                    className="text"
                    value={c}
                    onChange={e => {
                      const ac = [...story.acceptanceCriteria];
                      ac[ci] = e.target.value;
                      updateStory({ acceptanceCriteria: ac });
                    }}
                  />
                ))}
                <button
                  className="btn btn-sm"
                  onClick={() => updateStory({ acceptanceCriteria: [...story.acceptanceCriteria, ''] })}
                >
                  + criterion
                </button>
              </div>
              <button className="btn btn-sm danger" onClick={() => deleteStory(selectedIdx)}>Delete story</button>
            </div>
          )}
        </div>

        <footer className="modal-ft">
          <div className="modal-ft-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save plan'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
