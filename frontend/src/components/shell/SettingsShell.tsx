import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import Icon, { IconName } from '../common/Icon';
import MemoryView from '../views/MemoryView';
import AgentsView from '../views/AgentsView';
import SkillsView from '../views/SkillsView';
import WorkflowsView from '../views/WorkflowsView';
import PathsSettingsPanel from './PathsSettingsPanel';
import AppearanceSettings from './AppearanceSettings';
import WorkspaceSelector from '../sidebar/WorkspaceSelector';

const SETTINGS_SECTIONS: {
  group: string;
  items: { id: string; title: string; icon: IconName }[];
}[] = [
  {
    group: 'Workspace',
    items: [
      { id: 'workspaces', title: 'Workspaces', icon: 'folder' },
      { id: 'paths', title: 'Paths', icon: 'folder-open' },
      { id: 'task-types', title: 'Task types', icon: 'list' },
    ],
  },
  {
    group: 'Capabilities',
    items: [
      { id: 'memory', title: 'Memory', icon: 'book' },
      { id: 'agents', title: 'Agents', icon: 'user' },
      { id: 'skills', title: 'Skills', icon: 'rocket' },
      { id: 'workflows', title: 'Workflows', icon: 'refresh' },
    ],
  },
  {
    group: 'Other',
    items: [{ id: 'appearance', title: 'Appearance', icon: 'sun' }],
  },
];

export default function SettingsShell() {
  const settingsSection = useStore(s => s.settingsSection);
  const setSettingsSection = useStore(s => s.setSettingsSection);
  const setModal = useStore(s => s.setModal);

  const active = settingsSection || 'paths';

  useEffect(() => {
    if (!settingsSection) setSettingsSection('paths');
  }, [settingsSection, setSettingsSection]);

  return (
    <div className="settings">
      <aside className="settings-nav">
        <div className="settings-nav-head">
          <Icon name="settings" size={14} />
          <span>Settings</span>
        </div>
        <div className="settings-nav-body">
          {SETTINGS_SECTIONS.map(grp => (
            <div key={grp.group} className="settings-group">
              <div className="settings-group-label">{grp.group}</div>
              {grp.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-item ${active === item.id ? 'active' : ''}`}
                  onClick={() => setSettingsSection(item.id)}
                >
                  <Icon name={item.icon} size={14} />
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <div className="settings-main">
        {active === 'workspaces' && (
          <div className="settings-embed">
            <h3 style={{ marginTop: 0 }}>Workspaces</h3>
            <p className="muted">Switch or add a workspace folder.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <WorkspaceSelector />
              <button type="button" className="btn btn-primary" onClick={() => setModal('workspace')}>
                <Icon name="plus" size={14} /> Add workspace
              </button>
            </div>
          </div>
        )}
        {(active === 'paths' || active === 'task-types') && (
          <PathsSettingsPanel section={active} />
        )}
        {active === 'memory' && <MemoryView />}
        {active === 'agents' && <AgentsView />}
        {active === 'skills' && <SkillsView />}
        {active === 'workflows' && <WorkflowsView />}
        {active === 'appearance' && <AppearanceSettings />}
      </div>
    </div>
  );
}
