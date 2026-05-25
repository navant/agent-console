import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import {
  getWorkflows,
  getWorkflowFile,
  saveWorkflowFile,
  createWorkflow,
  getWorkflowDeps,
  setupWorkspaceStream,
  WorkflowDepsResponse,
  ArchonSetupStep,
  ArchonSetupResult,
  ArchonSetupStreamEvent,
} from '../../api/client';
import { WorkflowConfig } from '../../types';
import MarkdownEditor from '../common/MarkdownEditor';
type WorkflowKey = `${WorkflowConfig['source']}:${string}`;

const WORKSPACE_SETUP_PLAN: ArchonSetupStep[] = [
  { id: 'preflight', label: 'Preflight (claude, jq, git)', status: 'pending' },
  { id: 'ralph-scripts', label: 'Copy Ralph scripts (scripts/ralph/)', status: 'pending' },
  { id: 'ralph-workflow', label: 'Ralph loop workflow (.claude/workflows/)', status: 'pending' },
  { id: 'archon-scaffold', label: 'Archon .archon/ layout', status: 'pending' },
  { id: 'archon-project-setup', label: 'Archon project setup (--scope project)', status: 'pending' },
  { id: 'archon-validate', label: 'Validate Archon workflows', status: 'pending' },
  { id: 'archon-skill', label: 'Archon skill (.claude/skills/archon/)', status: 'pending' },
  { id: 'archon-discover', label: 'Discover Archon workflows', status: 'pending' },
];

const ARCHON_CLI_DOCS = 'https://archon.diy/reference/cli/';
const RALPH_REPO = 'https://github.com/snarktank/ralph';

type JobPhase = 'idle' | 'confirm' | 'running' | 'done';

function workflowKey(wf: Pick<WorkflowConfig, 'id' | 'source'>): WorkflowKey {
  return `${wf.source}:${wf.id}`;
}

function sourceLabel(source: WorkflowConfig['source']): string {
  if (source === 'archon') return 'A';
  if (source === 'builtin') return 'B';
  if (source === 'global') return 'G';
  return 'W';
}

function DepBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={'memory-dep-badge' + (ok ? ' memory-dep-badge--ok' : ' memory-dep-badge--no')}>
      {ok ? '✓' : '○'} {label}
    </span>
  );
}

export default function WorkflowsView() {
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const workspaces = useStore(s => s.workspaces);
  const loadWorkspaceData = useStore(s => s.loadWorkspaceData);

  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [deps, setDeps] = useState<WorkflowDepsResponse | null>(null);
  const [prereqOpen, setPrereqOpen] = useState(true);
  const [selected, setSelected] = useState<WorkflowKey | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [jobPhase, setJobPhase] = useState<JobPhase>('idle');
  const [jobSteps, setJobSteps] = useState<ArchonSetupStep[]>([]);
  const [jobLog, setJobLog] = useState<string[]>([]);
  const [jobResult, setJobResult] = useState<ArchonSetupResult | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [streamLive, setStreamLive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLPreElement>(null);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const jobBusy = jobPhase === 'running';

  const loadList = () => {
    if (!activeWorkspaceId) return;
    getWorkflows().then(setWorkflows).catch(() => setWorkflows([]));
    getWorkflowDeps().then(setDeps).catch(() => setDeps(null));
  };

  useEffect(() => {
    loadList();
  }, [activeWorkspaceId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [jobLog]);

  const openWorkflow = async (wf: WorkflowConfig) => {
    const key = workflowKey(wf);
    setSelected(key);
    setLoading(true);
    try {
      if (wf.source === 'archon') {
        setContent(
          `# ${wf.name}\n\n${wf.description ?? '_No description from Archon._'}\n\n---\n\n` +
            `**Run locally:** Agent Console executes this when a kanban task uses workflow \`${wf.id}\`:\n\n` +
            `\`\`\`bash\narchon workflow run ${wf.id}\n\`\`\`\n\n` +
            `See [Archon CLI](${ARCHON_CLI_DOCS}).`
        );
        return;
      }
      if (wf.id === 'ralph-loop' && wf.source === 'builtin') {
        setContent(
          `# ${wf.name}\n\n${wf.description ?? ''}\n\n---\n\n` +
            `Runs each pending story in the task plan until complete (max ${wf.max_iterations ?? 20} iterations).\n\n` +
            `**Shell loop:** \`./scripts/ralph/ralph.sh --tool claude\` after **Setup workflow in this workspace**.\n\n` +
            `[Ralph](${RALPH_REPO})`
        );
        return;
      }
      const fileSource =
        wf.source === 'builtin' ? 'builtin' : wf.source === 'global' ? 'global' : 'workspace';
      const res = await getWorkflowFile(wf.id, fileSource);
      setContent(res.content);
    } catch {
      setContent(wf.template ?? '');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!selected) return;
    const active = workflows.find(w => workflowKey(w) === selected);
    if (!active || active.source === 'archon' || active.source === 'builtin' || active.source === 'global') {
      return;
    }
    setSaving(true);
    try {
      await saveWorkflowFile(active.id, content);
      loadList();
      await loadWorkspaceData();
    } finally {
      setSaving(false);
    }
  };

  const newWorkflow = async () => {
    const name = window.prompt('Workflow folder name (workspace WORKFLOW.md)');
    if (!name) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    const body = `---\nname: ${name}\ntype: single\n---\n\n{{prompt}}\n`;
    await createWorkflow({ id, name, type: 'single', content: body });
    loadList();
    await loadWorkspaceData();
    openWorkflow({ id, name, type: 'single', skills: [], template: '', source: 'workspace' });
  };

  const resetJobUi = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setJobPhase('idle');
    setJobSteps([]);
    setJobLog([]);
    setJobResult(null);
    setJobError(null);
    setStreamLive(false);
  };

  const openConfirm = () => {
    if (!activeWorkspaceId) return;
    setJobPhase('confirm');
    setJobError(null);
    setJobResult(null);
  };

  const cancelJob = () => {
    if (jobBusy) {
      abortRef.current?.abort();
      setJobError('Cancelled.');
      setJobPhase('done');
      return;
    }
    resetJobUi();
  };

  const applyStreamEvent = (event: ArchonSetupStreamEvent) => {
    setStreamLive(true);
    if (event.type === 'plan') {
      setJobSteps(event.steps.map(s => ({ ...s, status: 'pending' as const })));
    } else if (event.type === 'step') {
      setJobSteps(prev => {
        const next = [...prev];
        const i = next.findIndex(s => s.id === event.step.id);
        if (i >= 0) next[i] = event.step;
        else next.push(event.step);
        return next;
      });
    } else if (event.type === 'log') {
      setJobLog(prev => [...prev.slice(-199), event.line]);
    } else if (event.type === 'done') {
      setJobResult(event.result);
      setJobSteps(event.result.steps);
    }
  };

  const confirmAndRun = async () => {
    if (!activeWorkspaceId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setJobPhase('running');
    setJobError(null);
    setJobResult(null);
    setJobSteps(WORKSPACE_SETUP_PLAN.map(s => ({ ...s })));
    setJobLog([]);
    setStreamLive(false);

    try {
      const result = await setupWorkspaceStream(applyStreamEvent, ac.signal);
      setJobResult(result);
      setJobPhase('done');
      if (!result.success) {
        const failed = result.steps.find(s => s.status === 'failed');
        setJobError(failed?.detail ?? 'Did not complete');
      } else {
        loadList();
        void loadWorkspaceData();
      }
    } catch (err) {
      setJobError(ac.signal.aborted ? 'Cancelled.' : err instanceof Error ? err.message : String(err));
      setJobPhase('done');
    } finally {
      abortRef.current = null;
    }
  };

  const completedCount = jobSteps.filter(s => ['ok', 'skipped'].includes(s.status)).length;
  const progressPct = jobSteps.length ? Math.round((completedCount / jobSteps.length) * 100) : 0;
  const allStepsSucceeded =
    jobSteps.length > 0 &&
    jobSteps.every(s => s.status === 'ok' || s.status === 'skipped') &&
    !jobSteps.some(s => s.status === 'failed' || s.status === 'running' || s.status === 'pending');

  const filtered = workflows.filter(w => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q);
  });

  const active = selected ? workflows.find(w => workflowKey(w) === selected) : null;
  const readOnly = !active || active.source !== 'workspace';
  const ws = deps?.status.workspace;

  if (!activeWorkspaceId) {
    return <div className="panel-view panel-view--empty"><p>Add a workspace first.</p></div>;
  }

  return (
    <div className="prd-view">
      <header className="panel-view-hd">
        <div>
          <h2>Workflows</h2>
          <p className="muted">
            Default: <span className="mono">single-shot</span> (Claude + task prompt).
            Built-in: <span className="mono">ralph-loop</span> · optional <span className="mono">Archon</span> when CLI is installed.
            {' '}
            <a href={RALPH_REPO} target="_blank" rel="noreferrer">Ralph</a>
            {' · '}
            <a href={ARCHON_CLI_DOCS} target="_blank" rel="noreferrer">Archon CLI</a>
          </p>
        </div>
        <div className="memory-header-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={jobBusy || jobPhase === 'confirm'}
            onClick={openConfirm}
          >
            Setup workflow in this workspace
          </button>
          <button type="button" className="btn btn-sm" onClick={newWorkflow}>+ Workspace WORKFLOW.md</button>
        </div>
      </header>

      <section className="memory-prereq-panel" style={{ marginBottom: 12 }}>
        <p className="field-lbl" style={{ margin: '0 0 8px' }}>Three ways to run a task</p>
        <ol className="muted" style={{ fontSize: 13, paddingLeft: 20, margin: 0 }}>
          <li>
            <strong>Single shot</strong> — one Claude Code run (prompt + memory + skills). Pick{' '}
            <span className="mono">single-shot</span> when creating the task.
          </li>
          <li>
            <strong>Ralph loop</strong> — repeated runs, one user story per iteration, until the task plan is done.
            Pick <span className="mono">ralph-loop</span>; generate a plan on the task first. Setup copies{' '}
            <span className="mono">scripts/ralph/</span> (<a href={RALPH_REPO} target="_blank" rel="noreferrer">snarktank/ralph</a>).
          </li>
          <li>
            <strong>Archon</strong> — any workflow from <span className="mono">archon workflow list</span> in this repo.
            Shown in the task dropdown when the Archon CLI is installed; use <strong>Setup workflow in this workspace</strong> for{' '}
            <span className="mono">.archon/</span> + project config.
          </li>
        </ol>
      </section>

      <section className="memory-prereq-panel">
        <button type="button" className="memory-prereq-toggle" onClick={() => setPrereqOpen(v => !v)}>
          {prereqOpen ? '▾' : '▸'} Prerequisites (install separately — Ralph + Archon)
        </button>
        {prereqOpen && deps && (
          <>
            <div className="memory-dep-badges">
              <DepBadge ok={deps.status.claude} label="claude CLI" />
              <DepBadge ok={deps.status.jq} label="jq" />
              <DepBadge ok={deps.status.archon} label="archon CLI" />
              {ws && (
                <>
                  <DepBadge ok={ws.gitRepo} label="git repo" />
                  <DepBadge ok={ws.ralphScripts} label="scripts/ralph/" />
                  <DepBadge ok={ws.ralphLoopWorkflow} label="ralph-loop" />
                  <DepBadge ok={ws.projectArchonDir} label=".archon/" />
                  <DepBadge ok={ws.projectEnvFile || ws.globalEnvFile} label="archon config" />
                  <DepBadge ok={(ws.workflowCount ?? 0) > 0} label={`${ws.workflowCount ?? 0} archon`} />
                </>
              )}
            </div>
            <ol className="muted" style={{ fontSize: 13, paddingLeft: 20 }}>
              {deps.installSteps.map(s => (
                <li key={s.id}>
                  <strong>{s.label}</strong> — <span className="mono">{s.command}</span>
                  {s.note ? <div>{s.note}</div> : null}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {jobPhase === 'confirm' && activeWorkspace && (
        <section className="memory-setup-panel memory-setup-confirm">
          <h3 className="memory-setup-confirm-title">Setup workflow in this workspace?</h3>
          <p className="muted">
            Workspace: <span className="mono">{activeWorkspace.path}</span>
          </p>
          <ul className="memory-setup-confirm-list muted">
            <li>
              Copy <span className="mono">templates/ralph</span> → <span className="mono">scripts/ralph/</span> (ralph.sh, CLAUDE.md, progress.txt, …)
            </li>
            <li>Install <span className="mono">.claude/workflows/ralph-loop/</span> for in-app Ralph loop runs</li>
            <li>
              Archon (if CLI installed): <span className="mono">.archon/workflows/</span>,{' '}
              <span className="mono">archon setup --spawn --scope project</span>, validate + refresh workflow list
            </li>
          </ul>
          <div className="memory-setup-confirm-actions">
            <button type="button" className="btn btn-primary" onClick={() => void confirmAndRun()}>
              Yes, continue
            </button>
            <button type="button" className="btn" onClick={cancelJob}>
              No
            </button>
          </div>
        </section>
      )}

      {(jobPhase === 'running' || jobPhase === 'done') && (
        <section className="memory-setup-panel">
          <div className="memory-setup-progress-hd">
            <span className="field-lbl">
              {jobBusy && !allStepsSucceeded
                ? 'Setting up workflows…'
                : jobResult?.success || allStepsSucceeded
                  ? 'Done'
                  : 'Finished with errors'}
            </span>
            {jobBusy && !allStepsSucceeded && (
              <button type="button" className="btn btn-sm" onClick={cancelJob}>
                Cancel
              </button>
            )}
            {jobPhase === 'done' && (
              <button type="button" className="btn btn-sm" onClick={resetJobUi}>
                Dismiss
              </button>
            )}
          </div>

          {jobBusy && (
            <div className="memory-setup-progress-bar" role="progressbar" aria-valuenow={progressPct}>
              <div className="memory-setup-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          )}

          {jobBusy && !streamLive && (
            <p className="field-hint muted" style={{ margin: '0 0 8px' }}>
              Contacting backend…
            </p>
          )}

          {jobError && <p className="memory-setup-error">{jobError}</p>}

          {jobSteps.length > 0 && (
            <ul className="memory-setup-steps">
              {jobSteps.map(step => (
                <li key={step.id} className={`memory-setup-step memory-setup-step--${step.status}`}>
                  <span className="memory-setup-step-icon" aria-hidden>
                    {step.status === 'ok' ? '✓' : step.status === 'failed' ? '✗' : step.status === 'skipped' ? '–' : '…'}
                  </span>
                  <span className="memory-setup-step-label">{step.label}</span>
                  {step.detail && <span className="memory-setup-step-detail muted">{step.detail}</span>}
                </li>
              ))}
            </ul>
          )}

          {jobResult?.hints && jobResult.hints.length > 0 && jobPhase === 'done' && (
            <ul className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              {jobResult.hints.map(h => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}

          {jobLog.length > 0 && (
            <pre ref={logEndRef} className="memory-setup-log">
              {jobLog.join('\n')}
            </pre>
          )}
        </section>
      )}

      <div className="prd-view-body">
        <aside className="memory-tree">
          <div className="search memory-tree-search">
            <span className="search-glyph">⌕</span>
            <input placeholder="Search workflows…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.map(wf => (
            <button
              key={workflowKey(wf)}
              type="button"
              className={'memory-tree-item' + (selected === workflowKey(wf) ? ' is-active' : '')}
              onClick={() => openWorkflow(wf)}
            >
              <span className="memory-tree-icon">{wf.source === 'archon' ? '⚡' : '→'}</span>
              <span className="memory-tree-name">{wf.name}</span>
              <span className="source-chip">{sourceLabel(wf.source)}</span>
            </button>
          ))}
        </aside>

        <div className="prd-editor-pane">
          {selected && active ? (
            <MarkdownEditor
              path={`${active.id}/WORKFLOW.md`}
              content={content}
              onChange={setContent}
              onSave={save}
              saving={saving}
              loading={loading}
              readOnly={readOnly}
            />
          ) : (
            <div className="memory-editor-empty">
              <p>Select a workflow</p>
              <p className="muted">B = built-in (single-shot, ralph-loop) · A = Archon · W = workspace</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
