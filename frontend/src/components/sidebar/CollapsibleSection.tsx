import React from 'react';

interface CollapsibleSectionProps {
  label: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  label,
  count,
  expanded,
  onToggle,
  action,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="side-sect">
      <div className="side-sect-hd-row">
        <button className="side-sect-toggle" onClick={onToggle} type="button">
          <span className="side-sect-chevron">{expanded ? '▾' : '▸'}</span>
          <span className="side-sect-label">{label}</span>
          {count !== undefined && <span className="count">{count}</span>}
        </button>
        {action}
      </div>
      {expanded && <div className="side-list">{children}</div>}
    </div>
  );
}
