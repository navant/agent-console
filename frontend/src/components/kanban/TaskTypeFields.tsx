import React from 'react';
import { useStore } from '../../store/useStore';
import { TaskTypeDef } from '../../types';

interface TaskTypeFieldsProps {
  taskTypeId: string;
  agentId: string;
  workflowId: string;
  skillIds: string[];
  onTaskTypeChange: (id: string) => void;
  onAgentChange: (id: string) => void;
  onWorkflowChange: (id: string) => void;
  onSkillIdsChange: (ids: string[]) => void;
  skillSearch: string;
  onSkillSearchChange: (q: string) => void;
  disabled?: boolean;
  showWorkflow?: boolean;
}

export function applyTaskTypeSelection(
  typeId: string,
  types: TaskTypeDef[]
): { agentId: string; workflowId: string; skillIds: string[] } | null {
  const def = types.find(t => t.id === typeId);
  if (!def) return null;
  return {
    agentId: def.agent,
    workflowId: def.workflow || 'single-shot',
    skillIds: [...def.skills],
  };
}

export default function TaskTypeFields({
  taskTypeId,
  agentId,
  workflowId,
  skillIds,
  onTaskTypeChange,
  onAgentChange,
  onWorkflowChange,
  onSkillIdsChange,
  skillSearch,
  onSkillSearchChange,
  disabled,
  showWorkflow = true,
}: TaskTypeFieldsProps) {
  const agents = useStore(s => s.agents);
  const skills = useStore(s => s.skills);
  const workflows = useStore(s => s.workflows);
  const taskTypes = useStore(s => s.taskTypes);

  const selectedType = taskTypeId ? taskTypes.find(t => t.id === taskTypeId) : null;
  const locked = !!selectedType;
  const showSkillSearch = skills.length >= 4;

  const filteredSkills = skillSearch.trim()
    ? skills.filter(s => {
        if (skillIds.includes(s.id)) return true;
        const hay = `${s.id} ${s.name} ${s.source}`.toLowerCase();
        return hay.includes(skillSearch.trim().toLowerCase());
      })
    : skills;

  const toggleSkill = (id: string) => {
    if (locked || disabled) return;
    onSkillIdsChange(skillIds.includes(id) ? skillIds.filter(x => x !== id) : [...skillIds, id]);
  };

  const handleTypeChange = (id: string) => {
    onTaskTypeChange(id);
    if (id) {
      const applied = applyTaskTypeSelection(id, taskTypes);
      if (applied) {
        onAgentChange(applied.agentId);
        onWorkflowChange(applied.workflowId);
        onSkillIdsChange(applied.skillIds);
      }
    }
  };

  const selectedAgent = agentId ? agents.find(a => a.id === agentId) : null;
  const selectedWorkflow = workflows.find(w => w.id === workflowId);

  return (
    <>
      <div className="field">
        <label className="field-lbl">
          <span>Task type</span>
          <span className="field-hint">optional — applies configured agent & skills</span>
        </label>
        <select
          className="text"
          value={taskTypeId}
          onChange={e => handleTypeChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">None (manual agent & skills)</option>
          {taskTypes.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}{t.default ? ' (default)' : ''}
            </option>
          ))}
        </select>
        {selectedType && (
          <span className="field-hint">
            Using type config — agent and skills are set by <span className="mono">{selectedType.id}</span>
          </span>
        )}
      </div>

      {showWorkflow && (
        <div className="field">
          <label className="field-lbl"><span>Workflow</span></label>
          <select
            className="text"
            value={workflowId}
            onChange={e => onWorkflowChange(e.target.value)}
            disabled={disabled || locked}
          >
            {workflows.length === 0 && <option value="">No workflows</option>}
            {workflows.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
            ))}
          </select>
          {selectedWorkflow && (
            <span className="field-hint">
              {selectedWorkflow.type === 'loop' ? 'Project task' : 'Simple task'}
            </span>
          )}
        </div>
      )}

      <div className="field">
        <label className="field-lbl">
          <span>Agent</span>
          <span className="field-hint">{locked ? 'from task type' : 'optional persona'}</span>
        </label>
        <select
          className="text"
          value={agentId}
          onChange={e => onAgentChange(e.target.value)}
          disabled={disabled || locked}
        >
          <option value="">Default (claude)</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.source})</option>
          ))}
        </select>
        {selectedAgent && (
          <span className="field-hint mono">{selectedAgent.model || 'default model'}</span>
        )}
      </div>

      <div className="field">
        <label className="field-lbl">
          <span>Skills</span>
          <span className="field-hint">
            {locked ? 'from task type' : skillIds.length > 0 ? `${skillIds.length} selected` : 'optional'}
          </span>
        </label>
        {skills.length === 0 ? (
          <p className="field-hint">No skills found</p>
        ) : (
          <>
            {showSkillSearch && !locked && (
              <div className="search skill-picker-search">
                <span className="search-glyph">⌕</span>
                <input
                  type="search"
                  placeholder="Search skills…"
                  value={skillSearch}
                  onChange={e => onSkillSearchChange(e.target.value)}
                  disabled={disabled}
                />
              </div>
            )}
            <div className={'chips skill-picker' + (locked ? ' is-locked' : '')}>
              {filteredSkills.map(skill => {
                const on = skillIds.includes(skill.id);
                return (
                  <button
                    key={`${skill.source}-${skill.id}`}
                    type="button"
                    className={'chip' + (on ? ' is-on' : '')}
                    onClick={() => toggleSkill(skill.id)}
                    disabled={disabled || locked}
                  >
                    <span className="chip-tick">{on ? '✓' : '○'}</span>
                    <span>{skill.name}</span>
                    <span className="source-chip">{skill.source === 'global' ? 'G' : 'W'}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
