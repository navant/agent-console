import React from 'react';
import { TaskConfig } from '../../types';
import { useStore } from '../../store/useStore';
import { runTaskPlanPhase, wsManager } from '../../api/client';
import { DEFAULT_PATH_SETTINGS } from '../../constants/paths';

interface RalphPlanPanelProps {
  task: TaskConfig;
  storyCount: number;
  pendingStories: number;
  onEditPlan?: () => void;
  onRunningChange: (running: boolean) => void;
}

export default function RalphPlanPanel({
  task,
  storyCount,
  pendingStories,
  onEditPlan,
  onRunningChange,
}: RalphPlanPanelProps) {
  const pathSettings = useStore(s => s.pathSettings);
  const openPrdFile = useStore(s => s.openPrdFile);
  const setTaskRunning = useStore(s => s.setTaskRunning);
  const taskRunning = useStore(s => s.taskRunning);
  const isRunning = task.status === 'running' || taskRunning;

  const prdDir = pathSettings?.prd ?? DEFAULT_PATH_SETTINGS.prd;
  const tasksDir = pathSettings?.tasks ?? DEFAULT_PATH_SETTINGS.tasks;
  const planPath = `${tasksDir.replace(/^\.\//, '')}/${task.id}/prd.json`;

  const startPhase = (phase: 'write-prd' | 'convert-ralph') => {
    if (!wsManager.isConnected) {
      window.alert('Not connected to the server. Wait a moment and try again.');
      return;
    }
    if (isRunning) return;
    setTaskRunning(true);
    onRunningChange(true);
    runTaskPlanPhase(task.id, phase);
  };

  return (
    <section className="task-detail-section ralph-plan-panel">
      <p className="task-detail-section-hd">Ralph loop — planning</p>
      <p className="field-hint" style={{ marginBottom: 12 }}>
        Use the real skills in order: <span className="mono">prd</span> → markdown PRD, then{' '}
        <span className="mono">ralph</span> → <span className="mono">prd.json</span>, then ▶ Run loop.
        Open comments and Q&amp;A do <strong>not</strong> trigger a normal Run — use these steps.
      </p>

      <ol className="ralph-plan-steps">
        <li className="ralph-plan-step">
          <div className="ralph-plan-step-hd">
            <strong>1. Write PRD</strong>
            <span className="field-hint mono">prd skill</span>
          </div>
          <p className="field-hint">
            {task.prd ? (
              <>
                Linked: <span className="mono">{task.prd}</span> in <span className="mono">{prdDir}</span>
              </>
            ) : (
              <>Creates <span className="mono">{prdDir}/prd-…md</span> and links it to this task.</>
            )}
          </p>
          <div className="ralph-plan-step-actions">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={isRunning}
              onClick={() => startPhase('write-prd')}
            >
              Run PRD skill
            </button>
            {task.prd && (
              <button type="button" className="btn btn-sm" onClick={() => openPrdFile(task.prd!)}>
                Open PRD
              </button>
            )}
          </div>
        </li>

        <li className="ralph-plan-step">
          <div className="ralph-plan-step-hd">
            <strong>2. Build plan</strong>
            <span className="field-hint mono">ralph skill</span>
          </div>
          <p className="field-hint">
            Converts the PRD into <span className="mono">{planPath}</span>
            {storyCount > 0
              ? ` · ${storyCount} stories (${pendingStories} pending)`
              : ' · no stories yet'}
          </p>
          <div className="ralph-plan-step-actions">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={isRunning || !task.prd}
              onClick={() => startPhase('convert-ralph')}
              title={!task.prd ? 'Link or create a PRD first' : undefined}
            >
              Run ralph skill
            </button>
            {onEditPlan && (
              <button type="button" className="btn btn-sm" disabled={isRunning} onClick={onEditPlan}>
                Edit stories
              </button>
            )}
          </div>
        </li>

        <li className="ralph-plan-step">
          <div className="ralph-plan-step-hd">
            <strong>3. Run loop</strong>
            <span className="field-hint mono">implement</span>
          </div>
          <p className="field-hint">
            One Claude run per pending story until the plan is done (use ▶ Run in the header).
          </p>
        </li>
      </ol>
    </section>
  );
}
