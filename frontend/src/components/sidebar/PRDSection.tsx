import React, { useEffect } from 'react';
import CollapsibleSection from './CollapsibleSection';
import { useStore } from '../../store/useStore';
import { getTaskPlan } from '../../api/client';

export default function PRDSection({ panel }: { panel?: boolean }) {
  const selectedTaskId = useStore(s => s.selectedTaskId);
  const tasks = useStore(s => s.tasks);
  const taskPlans = useStore(s => s.taskPlans);
  const setTaskPlan = useStore(s => s.setTaskPlan);
  const expanded = useStore(s => s.expandedSections.prd ?? false);
  const toggleSection = useStore(s => s.toggleSection);
  const setModal = useStore(s => s.setModal);

  const task = tasks.find(t => t.id === selectedTaskId);
  const plan = selectedTaskId ? taskPlans[selectedTaskId] : null;

  useEffect(() => {
    if (!selectedTaskId || task?.type !== 'project') return;
    if (taskPlans[selectedTaskId]) return;
    getTaskPlan(selectedTaskId).then(p => setTaskPlan(selectedTaskId, p)).catch(() => {});
  }, [selectedTaskId, task?.type, taskPlans, setTaskPlan]);

  const body = (
    <>
      {panel && selectedTaskId && task?.type === 'project' && (
        <div className="panel-view-actions">
          <button className="btn btn-sm" onClick={() => setModal('plan')}>Edit plan</button>
        </div>
      )}
      {!selectedTaskId && (
        <div className="side-empty">Select a project task</div>
      )}
      {selectedTaskId && task?.type !== 'project' && (
        <div className="side-empty">Simple task — no PRD</div>
      )}
      {plan && plan.userStories.length === 0 && (
        <div className="side-empty">
          <button className="btn btn-sm" onClick={() => setModal('plan')}>Create plan</button>
        </div>
      )}
      {plan?.userStories.map(story => (
        <div key={story.id} className="side-row side-row--quiet">
          <span className={story.passes ? 'story-pass' : 'story-pending'}>
            {story.passes ? '✓' : '○'}
          </span>
          <span className="side-row-name">{story.title}</span>
        </div>
      ))}
    </>
  );

  if (panel) return <div className="side-list">{body}</div>;

  return (
    <CollapsibleSection
      label="PRD"
      count={plan?.userStories.length}
      expanded={expanded}
      onToggle={() => toggleSection('prd')}
      action={
        selectedTaskId && task?.type === 'project' ? (
          <button className="icon-btn" title="Edit plan" onClick={() => setModal('plan')}>✎</button>
        ) : undefined
      }
    >
      {body}
    </CollapsibleSection>
  );
}
