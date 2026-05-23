import React from 'react';
import CollapsibleSection from './CollapsibleSection';
import { useStore } from '../../store/useStore';

export default function TasksSection({ compact }: { compact?: boolean }) {
  const tasks = useStore(s => s.tasks);
  const selectedTaskId = useStore(s => s.selectedTaskId);
  const setSelectedTaskId = useStore(s => s.setSelectedTaskId);
  const setChatAgent = useStore(s => s.setChatAgent);
  const setShowTaskDetail = useStore(s => s.setShowTaskDetail);
  const openWorkspaceTab = useStore(s => s.openWorkspaceTab);
  const expanded = useStore(s => s.expandedSections.tasks ?? true);
  const toggleSection = useStore(s => s.toggleSection);

  const list = tasks.slice(0, compact ? 12 : tasks.length).map(task => (
    <button
      key={task.id}
      className={'side-row' + (selectedTaskId === task.id ? ' is-selected' : '')}
      onClick={() => {
        setSelectedTaskId(task.id);
        setShowTaskDetail(true);
        setChatAgent(task.agent);
        openWorkspaceTab('tasks');
      }}
    >
      <span className={'status-dot status-' + task.status} />
      <span className="side-row-name">{task.title}</span>
      {!compact && <span className="side-row-meta mono">{task.id}</span>}
    </button>
  ));

  if (compact) {
    return (
      <div className="side-compact-list">
        <div className="side-nav-hd">Quick tasks</div>
        {list}
        {tasks.length === 0 && <div className="side-empty">No tasks</div>}
      </div>
    );
  }

  return (
    <CollapsibleSection
      label="Tasks"
      count={tasks.length}
      expanded={expanded}
      onToggle={() => toggleSection('tasks')}
    >
      {list}
    </CollapsibleSection>
  );
}
