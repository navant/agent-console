import { runArchonWorkflow } from './archonStore';

let archonRunning = false;
let activeChild: { kill: (s?: NodeJS.Signals) => void } | null = null;

export function isArchonRunnerBusy(): boolean {
  return archonRunning;
}

export function stopArchonRunner(): void {
  if (activeChild) {
    activeChild.kill('SIGTERM');
    activeChild = null;
  }
  archonRunning = false;
}

export interface RunArchonOptions {
  taskId: string;
  workspacePath: string;
  workflowId: string;
  message: string;
  onOutput: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

export function runArchonTask(opts: RunArchonOptions): void {
  const { workspacePath, workflowId, message, onOutput, onDone, onError } = opts;
  archonRunning = true;

  runArchonWorkflow(workspacePath, workflowId, message, onOutput, child => {
    activeChild = child;
  })
    .then(({ code, stderr }) => {
      activeChild = null;
      archonRunning = false;
      if (code !== 0) {
        onError(stderr || `archon workflow run exited ${code}`);
        return;
      }
      onDone();
    })
    .catch(err => {
      activeChild = null;
      archonRunning = false;
      onError(err instanceof Error ? err.message : String(err));
    });
}
