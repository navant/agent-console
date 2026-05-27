import React from 'react';
import Icon, { IconName } from '../common/Icon';

type Props = {
  title: string;
  subtitle?: string;
  icon: IconName;
  action?: React.ReactNode;
};

export default function SidePanelHeader({ title, subtitle, icon, action }: Props) {
  return (
    <div className="side-panel-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <Icon name={icon} size={13} style={{ color: 'var(--accent)' }} />
        <div style={{ minWidth: 0 }}>
          <div className="side-panel-title">{title}</div>
          {subtitle && <div className="side-panel-sub">{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}
