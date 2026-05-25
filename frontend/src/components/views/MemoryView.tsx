import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import {
  getMemory,
  getMemoryFile,
  getMemoryDeps,
  saveMemoryFile,
  setupMemoryStream,
  refreshMemoryStream,
  MemorySetupResult,
  MemorySetupStep,
  MemoryDependencyStatus,
  MemoryDependencyInstallStep,
} from '../../api/client';
import { MemoryFileEntry } from '../../types';
import MarkdownEditor from '../common/MarkdownEditor';
import { DEFAULT_PATH_SETTINGS } from '../../constants/paths';

const SESSION_MEMORY_PATH = 'MEMORY.md';
const CODEGRAPH_SUMMARY_PATH = 'codegraph-summary.md';

const TREE_GROUPS: { key: string; title: string; match: (f: MemoryFileEntry) => boolean }[] = [
  { key: 'generated', title: 'Memory (refresh)', match: f => f.kind === 'generated' },
  { key: 'folder', title: '.claude/memory/ folder', match: f => f.kind === 'folder' },
  { key: 'wiki', title: 'Wiki', match: f => f.scope === 'wiki' },
  { key: 'agent', title: 'Agents', match: f => f.scope === 'agent' },
];

const SETUP_PLAN: MemorySetupStep[] = [
  { id: 'preflight', label: 'Preflight (claude, jq)', status: 'pending' },
  { id: 'codegraph-init', label: 'CodeGraph init in workspace', status: 'pending' },
  { id: 'bridge', label: 'Memory bridge (hook + settings)', status: 'pending' },
  { id: 'claude-md', label: 'CLAUDE.md @-import', status: 'pending' },
  { id: 'tier', label: 'Agent Console memory tier', status: 'pending' },
];

const REFRESH_PLAN: MemorySetupStep[] = [
  { id: 'preflight', label: 'Preflight (bridge, tools)', status: 'pending' },
  { id: 'codegraph-sync', label: 'CodeGraph sync index', status: 'pending' },
  { id: 'codegraph-summary', label: 'CodeGraph project summary', status: 'pending' },
  { id: 'claude-mem-memory', label: 'claude-mem → MEMORY.md', status: 'pending' },
];

type JobPhase = 'idle' | 'confirm' | 'running' | 'done';
type JobMode = 'setup' | 'refresh';

function DepBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={'memory-dep-badge' + (ok ? ' memory-dep-badge--ok' : ' memory-dep-badge--no')}>
      {ok ? '✓' : '○'} {label}
    </span>
  );
}

export default function MemoryView() {
  const memory = useStore(s => s.memory);
  const setMemory = useStore(s => s.setMemory);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const workspaces = useStore(s => s.workspaces);
  const pathSettings = useStore(s => s.pathSettings);

  const [files, setFiles] = useState<MemoryFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deps, setDeps] = useState<MemoryDependencyStatus | null>(null);
  const [installSteps, setInstallSteps] = useState<MemoryDependencyInstallStep[]>([]);
  const [prereqOpen, setPrereqOpen] = useState(true);

  const [jobMode, setJobMode] = useState<JobMode | null>(null);
  const [jobPhase, setJobPhase] = useState<JobPhase>('idle');
  const [jobSteps, setJobSteps] = useState<MemorySetupStep[]>([]);
  const [jobLog, setJobLog] = useState<string[]>([]);
  const [jobResult, setJobResult] = useState<MemorySetupResult | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [streamLive, setStreamLive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLPreElement>(null);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const jobBusy = jobPhase === 'running';
  const selectedFile = files.find(
    f => f.path === selectedPath && f.agentId === selectedAgentId
  );
  const isReadOnlyFile = selectedFile?.readOnly ?? (
    selectedPath === SESSION_MEMORY_PATH || selectedPath === CODEGRAPH_SUMMARY_PATH
  );

  const reloadMemory = useCallback(() => {
    if (!activeWorkspaceId) return;
    getMemory().then(m => {
      setMemory(m);
      setFiles(m.files ?? []);
    }).catch(() => {});
    getMemoryDeps().then(r => {
      setDeps(r.status);
      setInstallSteps(r.installSteps);
    }).catch(() => {});
  }, [activeWorkspaceId, setMemory]);

  useEffect(() => {
    reloadMemory();
  }, [reloadMemory]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [jobLog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files.filter(f => !f.isDir);
    return files.filter(f => {
      if (f.isDir) return false;
      return `${f.name} ${f.path} ${f.scope}`.toLowerCase().includes(q);
    });
  }, [files, search]);

  const treeGroups = useMemo(() => {
    return TREE_GROUPS.map(g => ({
      ...g,
      items: filtered.filter(g.match),
    })).filter(g => g.items.length > 0);
  }, [filtered]);

  const openFile = async (file: MemoryFileEntry) => {
    if (file.isDir) return;
    setLoading(true);
    setSelectedPath(file.path);
    setSelectedAgentId(file.agentId);
    try {
      const res = await getMemoryFile(file.path, file.agentId);
      setContent(res.content);
    } catch {
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!selectedPath || isReadOnlyFile) return;
    setSaving(true);
    try {
      const updated = await saveMemoryFile(selectedPath, content, selectedAgentId);
      setMemory(updated);
      setFiles(updated.files ?? []);
    } finally {
      setSaving(false);
    }
  };

  const resetJobUi = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setJobMode(null);
    setJobPhase('idle');
    setJobSteps([]);
    setJobLog([]);
    setJobResult(null);
    setJobError(null);
    setStreamLive(false);
  };

  const openConfirm = (mode: JobMode) => {
    if (!activeWorkspaceId) return;
    setJobMode(mode);
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

  const applyStreamEvent = (event: import('../../api/client').MemorySetupStreamEvent) => {
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
    if (!activeWorkspaceId || !jobMode) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setJobPhase('running');
    setJobError(null);
    setJobResult(null);
    setJobSteps((jobMode === 'setup' ? SETUP_PLAN : REFRESH_PLAN).map(s => ({ ...s })));
    setJobLog([]);
    setStreamLive(false);

    const stream = jobMode === 'setup' ? setupMemoryStream : refreshMemoryStream;

    try {
      const result = await stream(applyStreamEvent, ac.signal);
      setJobResult(result);
      setJobPhase('done');
      if (!result.success) {
        const failed = result.steps.find(s => s.status === 'failed');
        setJobError(failed?.detail ?? 'Did not complete');
      } else {
        reloadMemory();
        if (result.steps.some(s => s.id === 'claude-mem-memory' && s.status === 'ok')) {
          setSelectedPath(SESSION_MEMORY_PATH);
          const res = await getMemoryFile(SESSION_MEMORY_PATH);
          setContent(res.content);
        }
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

  useEffect(() => {
    if (jobPhase !== 'running' || !allStepsSucceeded) return;
    setJobPhase('done');
    setJobResult(prev => prev ?? {
      success: true,
      workspacePath: activeWorkspace?.path ?? '',
      steps: jobSteps,
      log: jobLog.join('\n'),
      hints: ['Setup complete. Use **Refresh summaries** for MEMORY.md and codegraph-summary.md.'],
      memoryTier: 'claude-mem',
    });
    reloadMemory();
  }, [jobPhase, allStepsSucceeded, jobSteps, jobLog, activeWorkspace?.path, reloadMemory]);

  if (!activeWorkspaceId) {
    return (
      <div className="panel-view panel-view--empty">
        <p>Add a workspace to manage memory files.</p>
      </div>
    );
  }

  return (
    <div className="memory-view">
      <header className="panel-view-hd">
        <div>
          <h2>Memory</h2>
          <p className="muted">
            Tier: {memory?.tier ?? 'simple'}
            {deps && (
              <> · claude-mem {deps.claudeMemWorker ? `:${deps.claudeMemPort ?? '?'}` : 'off'}</>
            )}
            {' · '}
            <span className="mono">{pathSettings?.memory ?? DEFAULT_PATH_SETTINGS.memory}</span>
          </p>
        </div>
        <div className="memory-header-actions">
          <button
            type="button"
            className="btn btn-sm"
            disabled={jobBusy || jobPhase === 'confirm'}
            onClick={() => openConfirm('setup')}
          >
            Setup workspace
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={jobBusy || jobPhase === 'confirm' || !deps?.bridgeInstalled}
            title={!deps?.bridgeInstalled ? 'Run Setup workspace first' : undefined}
            onClick={() => openConfirm('refresh')}
          >
            Refresh summaries
          </button>
        </div>
      </header>

      <section className="memory-prereq-panel">
        <button
          type="button"
          className="memory-prereq-toggle"
          onClick={() => setPrereqOpen(v => !v)}
        >
          {prereqOpen ? '▾' : '▸'} Prerequisites (install separately — not from this app)
        </button>
        {prereqOpen && (
          <>
            {deps && (
              <div className="memory-dep-badges">
                <DepBadge ok={deps.codegraphMcp} label="CodeGraph MCP" />
                <DepBadge ok={deps.codegraphProject} label=".codegraph/" />
                <DepBadge ok={deps.claudeMemWorker} label="claude-mem worker" />
                <DepBadge ok={deps.bridgeInstalled} label="bridge" />
                <DepBadge ok={deps.claude} label="claude CLI" />
                <DepBadge ok={deps.jq} label="jq" />
              </div>
            )}
            <ol className="memory-prereq-steps">
              {installSteps.map(step => (
                <li key={step.id}>
                  <strong>{step.title}</strong>
                  <ul>
                    {step.commands.map(cmd => (
                      <li key={cmd}><code className="mono">{cmd}</code></li>
                    ))}
                  </ul>
                  <p className="muted">{step.note}</p>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {jobPhase === 'confirm' && activeWorkspace && jobMode && (
        <section className="memory-setup-panel memory-setup-confirm">
          <h3 className="memory-setup-confirm-title">
            {jobMode === 'setup' ? 'Setup workspace memory?' : 'Refresh memory summaries?'}
          </h3>
          <p className="muted">
            Workspace: <span className="mono">{activeWorkspace.path}</span>
          </p>
          {jobMode === 'setup' ? (
            <ul className="memory-setup-confirm-list muted">
              <li>Run <span className="mono">codegraph init -i</span> in this workspace (needs CodeGraph installed globally)</li>
              <li>Copy memory bridge: <span className="mono">.claude/hooks/sync-memory.sh</span> + hook in settings</li>
              <li>Append <span className="mono">@.claude/MEMORY.md</span> to <span className="mono">CLAUDE.md</span></li>
            </ul>
          ) : (
            <ul className="memory-setup-confirm-list muted">
              <li>
                Sync CodeGraph index → write <span className="mono">codegraph-summary.md</span> (Memory tab →
                Generated; also inlined via <span className="mono">CLAUDE.md</span> after refresh)
              </li>
              <li>Run claude-mem bridge → regenerate <span className="mono">MEMORY.md</span> (needs worker + <span className="mono">claude</span>)</li>
            </ul>
          )}
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
                ? (jobMode === 'setup' ? 'Setting up workspace…' : 'Refreshing summaries…')
                : (jobResult?.success || allStepsSucceeded)
                  ? 'Done'
                  : 'Finished with errors'}
            </span>
            {jobBusy && !allStepsSucceeded && (
              <button type="button" className="btn btn-sm" onClick={cancelJob}>
                Cancel
              </button>
            )}
            {(jobPhase === 'done' || allStepsSucceeded) && (
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
                    {step.status === 'running' ? '◐' : step.status === 'ok' ? '✓' : step.status === 'skipped' ? '−' : step.status === 'failed' ? '✕' : '○'}
                  </span>
                  <span className="memory-setup-step-label">{step.label}</span>
                  <span className="memory-setup-step-status">{step.status}</span>
                  {step.detail && <span className="memory-setup-step-detail muted">{step.detail}</span>}
                </li>
              ))}
            </ul>
          )}

          {(jobLog.length > 0
            || jobSteps.some(s => s.status === 'running')
            || jobPhase === 'done') && (
            <pre className="memory-setup-log mono" ref={logEndRef}>
              {jobLog.length > 0
                ? jobLog.join('\n')
                : jobPhase === 'done'
                  ? (jobResult?.success
                    ? 'Finished (no command output this run).'
                    : '')
                  : `${jobSteps.find(s => s.status === 'running')!.label}…`}
            </pre>
          )}

          {jobPhase === 'done' && jobResult?.hints && jobResult.hints.length > 0 && (
            <div className="memory-setup-hints">
              <p className="field-lbl">Next steps</p>
              <ul>
                {jobResult.hints.map(h => (
                  <li key={h} className="muted">{h}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="memory-view-body">
        <aside className="memory-tree">
          <div className="search memory-tree-search">
            <span className="search-glyph">⌕</span>
            <input
              placeholder="Search memory files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {treeGroups.map(group => (
            <div key={group.key} className="memory-tree-group">
              <div className="memory-tree-group-hd">{group.title}</div>
              {group.items.map(file => (
                <button
                  key={file.id}
                  type="button"
                  className={
                    'memory-tree-item' +
                    (selectedPath === file.path && selectedAgentId === file.agentId ? ' is-active' : '')
                  }
                  onClick={() => openFile(file)}
                  title={file.description}
                >
                  <span className="memory-tree-icon">◇</span>
                  <span className="memory-tree-name mono">{file.name}</span>
                </button>
              ))}
            </div>
          ))}

          {files.length === 0 && jobPhase === 'idle' && (
            <p className="field-hint" style={{ padding: '8px 10px' }}>
              Run <strong>Setup workspace</strong> after installing prerequisites above.
            </p>
          )}
        </aside>

        <div className="memory-editor">
          {selectedPath ? (
            <>
              {selectedFile?.description && (
                <p className="field-hint memory-session-hint muted">{selectedFile.description}</p>
              )}
              {isReadOnlyFile && (
                <p className="field-hint memory-session-hint">
                  Read-only — use <strong>Refresh summaries</strong> for generated files.
                </p>
              )}
              <MarkdownEditor
                path={selectedPath}
                content={content}
                onChange={setContent}
                onSave={save}
                saving={saving}
                loading={loading}
                readOnly={isReadOnlyFile}
              />
            </>
          ) : (
            <div className="memory-editor-empty">
              <p>Select a memory file from the tree</p>
              <p className="muted">
                <span className="mono">MEMORY.md</span> and <span className="mono">codegraph-summary.md</span> appear after refresh.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
