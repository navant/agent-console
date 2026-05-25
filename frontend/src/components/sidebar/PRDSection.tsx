import React from 'react';
import CollapsibleSection from './CollapsibleSection';
import { useStore } from '../../store/useStore';

export default function PRDSection({ panel }: { panel?: boolean }) {
  const expanded = useStore(s => s.expandedSections.prd ?? false);
  const toggleSection = useStore(s => s.toggleSection);
  const openWorkspaceTab = useStore(s => s.openWorkspaceTab);

  const body = (
    <div className="side-empty">
      <p>PRDs live under Planning.</p>
      <button type="button" className="btn btn-sm" onClick={() => openWorkspaceTab('prd')}>
        Open Planning
      </button>
    </div>
  );

  if (panel) return <div className="side-list">{body}</div>;

  return (
    <CollapsibleSection
      label="PRD"
      expanded={expanded}
      onToggle={() => toggleSection('prd')}
    >
      {body}
    </CollapsibleSection>
  );
}
