import React from 'react';
import CollapsibleSection from './CollapsibleSection';
import { useStore } from '../../store/useStore';

export default function SkillsSection({ panel }: { panel?: boolean }) {
  const skills = useStore(s => s.skills);
  const selectedSkills = useStore(s => s.selectedSkills);
  const toggleSkillSelection = useStore(s => s.toggleSkillSelection);
  const previewSkillId = useStore(s => s.previewSkillId);
  const setPreviewSkillId = useStore(s => s.setPreviewSkillId);
  const expanded = useStore(s => s.expandedSections.skills ?? false);
  const toggleSection = useStore(s => s.toggleSection);

  const preview = skills.find(s => s.id === previewSkillId);

  const body = (
    <>
      {skills.map(skill => (
        <div key={`${skill.source}-${skill.id}`} className="side-skill-row">
          <input
            type="checkbox"
            checked={selectedSkills.includes(skill.id)}
            onChange={() => toggleSkillSelection(skill.id)}
            title="Select for next task"
          />
          <button
            className={'side-row side-row--quiet' + (previewSkillId === skill.id ? ' is-selected' : '')}
            onClick={() => setPreviewSkillId(previewSkillId === skill.id ? null : skill.id)}
          >
            <span className="skill-glyph">◇</span>
            <span className="side-row-name">{skill.name}</span>
            <span className="source-chip">{skill.source === 'global' ? 'G' : 'W'}</span>
          </button>
        </div>
      ))}
      {preview && (
        <pre className="skill-preview mono">{preview.content.slice(0, 800)}{preview.content.length > 800 ? '…' : ''}</pre>
      )}
    </>
  );

  if (panel) return <div className="side-list">{body}</div>;

  return (
    <CollapsibleSection
      label="Skills"
      count={skills.length}
      expanded={expanded}
      onToggle={() => toggleSection('skills')}
    >
      {body}
    </CollapsibleSection>
  );
}
