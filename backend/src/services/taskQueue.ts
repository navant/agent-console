import { getActiveWorkspace } from './fileStore';
import {
  executeTask,
  findNextTodoTask,
  isTaskRunnerBusy,
  TaskRunCallbacks,
} from './taskRunner';

let autoQueueEnabled = true;
let queueLock = false;
let callbacks: TaskRunCallbacks | null = null;

export function setTaskQueueCallbacks(cbs: TaskRunCallbacks): void {
  callbacks = cbs;
}

export function isAutoQueueEnabled(): boolean {
  return autoQueueEnabled;
}

export function setAutoQueue(enabled: boolean): void {
  autoQueueEnabled = enabled;
  if (enabled) void tick();
}

export async function tick(): Promise<void> {
  if (queueLock || isTaskRunnerBusy()) return;
  const cbs = callbacks;
  const activeWs = getActiveWorkspace();
  if (!cbs || !activeWs || !autoQueueEnabled) return;

  queueLock = true;
  try {
    const next = findNextTodoTask(activeWs.path);
    if (next) {
      await executeTask(next.id, activeWs.path, { nudge: false, source: 'queue' }, cbs);
    }
  } catch {
    // busy or error — next tick will retry
  } finally {
    queueLock = false;
    if (!isTaskRunnerBusy() && autoQueueEnabled) {
      setTimeout(() => void tick(), 2000);
    }
  }
}

export function onTaskCommentAdded(_taskId: string): void {
  void tick();
}

export function getAutomationState() {
  return { autoQueue: autoQueueEnabled };
}
