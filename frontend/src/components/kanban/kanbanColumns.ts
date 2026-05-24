import { TaskStatus } from '../../types';

export type ColumnId = 'todo' | 'running' | 'review' | 'confirm' | 'done' | 'archive';

export const COLUMNS: {
  id: ColumnId;
  label: string;
  hue: string;
  dropEnabled: boolean;
}[] = [
  { id: 'todo', label: 'Todo', hue: 'var(--muted)', dropEnabled: true },
  { id: 'running', label: 'Running', hue: 'var(--accent)', dropEnabled: false },
  { id: 'review', label: 'Review', hue: 'var(--amber)', dropEnabled: true },
  { id: 'confirm', label: 'Awaiting Confirmation', hue: '#8ab4d4', dropEnabled: true },
  { id: 'done', label: 'Done', hue: 'var(--green)', dropEnabled: true },
  { id: 'archive', label: 'Archive', hue: 'var(--fg-3)', dropEnabled: true },
];

export const MANUAL_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'review', label: 'Review' },
  { value: 'awaiting_confirmation', label: 'Awaiting Confirmation' },
  { value: 'done', label: 'Done' },
  { value: 'archive', label: 'Archive' },
];

export function columnToStatus(columnId: ColumnId): TaskStatus {
  if (columnId === 'confirm') return 'awaiting_confirmation';
  return columnId;
}

export function statusToColumn(status: TaskStatus): ColumnId {
  if (status === 'planned' || status === 'todo') return 'todo';
  if (status === 'awaiting_confirmation') return 'confirm';
  if (status === 'archive') return 'archive';
  return status;
}

export function normalizeStatusForColumn(status: TaskStatus, columnId: ColumnId): TaskStatus {
  const target = columnToStatus(columnId);
  if (target === 'todo' && status === 'planned') return 'todo';
  return target;
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return status === 'done' || status === 'archive';
}
