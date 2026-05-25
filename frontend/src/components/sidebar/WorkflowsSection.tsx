import React from 'react';
import CollapsibleSection from './CollapsibleSection';
import { useStore } from '../../store/useStore';

export default function WorkflowsSection({ panel }: { panel?: boolean }) {
  const workflows = useStore(s => s.workflows);
  const setModal = useStore(s => s.setModal);
  const expanded = useStore(s => s.expandedSections.workflows ?? false);
  const toggleSection = useStore(s => s.toggleSection);

  const body = (
    <>
      {panel && (
        <div className="panel-view-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setModal('workflow')}>+ Workflow</button>
        </div>
      )}
      {workflows.map(wf => (
        <button key={wf.id} className="side-row side-row--quiet">
          <span className="skill-glyph">→</span>
          <span className="side-row-name">{wf.name}</span>
          <span className="side-row-meta side-row-meta--faint">
            {wf.agent || wf.skills?.length ? [wf.agent, ...(wf.skills ?? [])].filter(Boolean).join(' · ') : wf.id}
          </span>
        </button>
      ))}
    </>
  );

  if (panel) return <div className="side-list">{body}</div>;

  return (
    <CollapsibleSection
      label="Workflows"
      count={workflows.length}
      expanded={expanded}
      onToggle={() => toggleSection('workflows')}
      action={
        <button className="icon-btn" title="New workflow" onClick={() => setModal('workflow')}>+</button>
      }
    >
      {body}
    </CollapsibleSection>
  );
}
