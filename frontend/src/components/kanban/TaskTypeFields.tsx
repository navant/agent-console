import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { TaskTypeDef } from '../../types';
import {
  groupWorkflowsForSelect,
  workflowOptionLabel,
  workflowRunHint,
  findWorkflowById,
} from '../../utils/workflowOptions';

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
  const workflowGroups = groupWorkflowsForSelect(workflows);

  const isRalphLoop = workflowId === 'ralph-loop';
  const selectedType = taskTypeId ? taskTypes.find(t => t.id === taskTypeId) : null;
  const locked = !!selectedType;
  const agentLocked = locked && !!selectedType?.agent;
  const workflowLocked = locked && !!selectedType?.workflow;
  const skillsLocked = locked && (selectedType?.skills?.length ?? 0) > 0;
  const taskTypeDisabled = disabled || isRalphLoop;
  const skillsDisabled = disabled || isRalphLoop || skillsLocked;
  const showSkillSearch = skills.length >= 4 && !isRalphLoop;

  const filteredSkills = skillSearch.trim()
    ? skills.filter(s => {
        if (skillIds.includes(s.id)) return true;
        const hay = `${s.id} ${s.name} ${s.source}`.toLowerCase();
        return hay.includes(skillSearch.trim().toLowerCase());
      })
    : skills;

  const toggleSkill = (id: string) => {
    if (skillsDisabled) return;
    onSkillIdsChange(skillIds.includes(id) ? skillIds.filter(x => x !== id) : [...skillIds, id]);
  };

  const handleTypeChange = (id: string) => {
    if (isRalphLoop) return;
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

  const handleWorkflowChange = (id: string) => {
    onWorkflowChange(id);
    if (id === 'ralph-loop') {
      onTaskTypeChange('');
      onSkillIdsChange([]);
      onSkillSearchChange('');
    }
  };

  useEffect(() => {
    if (!isRalphLoop) return;
    if (taskTypeId) onTaskTypeChange('');
    if (skillIds.length > 0) onSkillIdsChange([]);
  }, [isRalphLoop, taskTypeId, skillIds.length, onTaskTypeChange, onSkillIdsChange]);

  const selectedAgent = agentId ? agents.find(a => a.id === agentId) : null;
  const selectedWorkflow = findWorkflowById(workflows, workflowId);
  const archonAvailable = workflows.some(w => w.source === 'archon');

  return (
    <>
      <div className={'field' + (taskTypeDisabled ? ' field--inactive' : '')}>
        <label className="field-lbl">
          <span>Task type</span>
          <span className="field-hint">
            {isRalphLoop ? 'not used with Ralph loop' : 'optional — applies configured agent & skills'}
          </span>
        </label>
        <select
          className="text"
          value={isRalphLoop ? '' : taskTypeId}
          onChange={e => handleTypeChange(e.target.value)}
          disabled={taskTypeDisabled}
        >
          <option value="">None (manual agent & skills)</option>
          {taskTypes.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}{t.default ? ' (default)' : ''}
            </option>
          ))}
        </select>
        {isRalphLoop ? (
          <span className="field-hint">
            Ralph loop uses the task <strong>plan</strong> (stories) and built-in workflow — not task-type presets.
          </span>
        ) : selectedType ? (
          <span className="field-hint">
            Using type config — agent and skills are set by <span className="mono">{selectedType.id}</span>
          </span>
        ) : null}
      </div>

      {showWorkflow && (
        <div className="field">
          <label className="field-lbl">
            <span>How to run</span>
            <span className="field-hint">single shot · ralph loop · archon</span>
          </label>
          <select
            className="text"
            value={workflowId}
            onChange={e => handleWorkflowChange(e.target.value)}
            disabled={disabled || workflowLocked}
          >
            {workflows.length === 0 && <option value="">Loading workflows…</option>}
            {workflowGroups.map(g => (
              <optgroup key={g.id} label={g.label}>
                {g.workflows.map(w => (
                  <option key={`${w.source}:${w.id}`} value={w.id}>
                    {workflowOptionLabel(w)}
                  </option>
                ))}
              </optgroup>
            ))}
            {!archonAvailable && workflows.length > 0 && (
              <optgroup label="Archon (not loaded)">
                <option value="" disabled>
                  Install archon CLI + Workflows → Setup workspace
                </option>
              </optgroup>
            )}
          </select>
          {selectedWorkflow && (
            <span className="field-hint">{workflowRunHint(selectedWorkflow)}</span>
          )}
          {isRalphLoop && (
            <span className="field-hint">
              On the task: <strong>PRD skill</strong> → PRD markdown, <strong>ralph skill</strong> → prd.json, then Run loop. Agent still applies.
            </span>
          )}
        </div>
      )}

      <div className="field">
        <label className="field-lbl">
          <span>Agent</span>
          <span className="field-hint">{agentLocked ? 'from task type' : 'optional persona'}</span>
        </label>
        <select
          className="text"
          value={agentId}
          onChange={e => onAgentChange(e.target.value)}
          disabled={disabled || agentLocked}
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

      <div className={'field' + (isRalphLoop ? ' field--inactive' : '')}>
        <label className="field-lbl">
          <span>Skills</span>
          <span className="field-hint">
            {isRalphLoop
              ? 'not used during Ralph loop'
              : skillsLocked
                ? 'from task type'
                : skillIds.length > 0
                  ? `${skillIds.length} selected`
                  : 'optional'}
          </span>
        </label>
        {isRalphLoop ? (
          <p className="field-hint">
            Use <span className="mono">prd</span> and <span className="mono">ralph</span> from the task planning panel — not as run-time skills here.
          </p>
        ) : skills.length === 0 ? (
          <p className="field-hint">No skills found</p>
        ) : (
          <>
            {showSkillSearch && !skillsLocked && (
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
            <div className={'chips skill-picker' + (skillsDisabled ? ' is-locked' : '')}>
              {filteredSkills.map(skill => {
                const on = skillIds.includes(skill.id);
                return (
                  <button
                    key={`${skill.source}-${skill.id}`}
                    type="button"
                    className={'chip' + (on ? ' is-on' : '')}
                    onClick={() => toggleSkill(skill.id)}
                    disabled={skillsDisabled}
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
