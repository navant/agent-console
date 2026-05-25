import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import MessageBubble from './MessageBubble';
import { wsManager, getSessions, getSessionMessages, SessionSummary } from '../../api/client';
import { ChatMessage } from '../../types';

const CLAUDE_ORANGE = '#e07b39';

type Tab = 'chat' | 'sessions';

const SLASH_COMMANDS = [
  // Local (client-side)
  { cmd: '/clear',       desc: 'Clear chat messages',                      local: true  },
  // Claude Code built-ins
  { cmd: '/compact',     desc: 'Compact conversation to save context',      local: false },
  { cmd: '/review',      desc: 'Review recent code changes',                local: false },
  { cmd: '/init',        desc: 'Initialize CLAUDE.md in workspace',         local: false },
  { cmd: '/memory',      desc: 'Manage Claude memory files',                local: false },
  { cmd: '/goal',        desc: 'Run goal skill (goals/*.md)',               local: false },
  { cmd: '/help',        desc: 'Show available slash commands',             local: false },
  { cmd: '/status',      desc: 'Show account and session status',           local: false },
  { cmd: '/cost',        desc: 'Show API usage cost for this session',      local: false },
  { cmd: '/model',       desc: 'Show or switch the active model',           local: false },
  { cmd: '/config',      desc: 'Open Claude Code configuration',            local: false },
  { cmd: '/doctor',      desc: 'Run Claude Code diagnostics',               local: false },
  { cmd: '/mcp',         desc: 'Manage MCP server connections',             local: false },
  { cmd: '/pr_comments', desc: 'Fetch comments from a GitHub PR',           local: false },
  { cmd: '/bug',         desc: 'Report a Claude Code bug',                  local: false },
  { cmd: '/login',       desc: 'Switch Anthropic account',                  local: false },
  { cmd: '/logout',      desc: 'Log out of Anthropic account',              local: false },
  { cmd: '/vim',         desc: 'Toggle vim keybindings',                    local: false },
];

export default function ChatPanel({ embedded = false }: { embedded?: boolean }) {
  const agents              = useStore(s => s.agents);
  const tasks               = useStore(s => s.tasks);
  const workspaces          = useStore(s => s.workspaces);
  const activeWorkspaceId   = useStore(s => s.activeWorkspaceId);
  const selectedTaskId      = useStore(s => s.selectedTaskId);
  const setSelectedTaskId   = useStore(s => s.setSelectedTaskId);
  const chatAgent           = useStore(s => s.chatAgent);
  const setChatAgent        = useStore(s => s.setChatAgent);
  const messages            = useStore(s => s.messages);
  const running             = useStore(s => s.running);
  const currentSessionId    = useStore(s => s.currentSessionId);
  const setCurrentSessionId = useStore(s => s.setCurrentSessionId);
  const addMessage          = useStore(s => s.addMessage);
  const clearMessages       = useStore(s => s.clearMessages);
  const setRunning          = useStore(s => s.setRunning);
  const chatSkillBootstrap  = useStore(s => s.chatSkillBootstrap);
  const setChatSkillBootstrap = useStore(s => s.setChatSkillBootstrap);

  const [tab, setTab]                   = useState<Tab>('chat');
  const [draft, setDraft]               = useState('');
  const [sessions, setSessions]         = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingHistory, setLoadingHistory]   = useState(false);
  const [pickingAgent, setPickingAgent] = useState(false);
  const [slashIdx, setSlashIdx]         = useState(0);
  const [wsFilter, setWsFilter]         = useState<'current' | 'all'>(activeWorkspaceId ? 'current' : 'all');

  const logRef       = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const task      = tasks.find(t => t.id === selectedTaskId);
  const sessionId = currentSessionId || task?.session_id || undefined;
  sessionIdRef.current = sessionId;

  // color for assistant message borders in current session
  const activeAgent    = agents.find(a => a.id === chatAgent);
  const agentColor     = activeAgent?.tint ?? CLAUDE_ORANGE;
  const agentLabel     = activeAgent?.name ?? 'claude';

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length]);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try { setSessions(await getSessions()); }
    catch { setSessions([]); }
    finally { setLoadingSessions(false); }
  }, []);

  useEffect(() => {
    if (tab === 'sessions') fetchSessions();
  }, [tab, fetchSessions, tasks]);

  const activeTaskSessionIds = new Set(
    tasks.filter(t => t.status !== 'done' && t.session_id).map(t => t.session_id as string)
  );
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  const activeWsPath = workspaces.find(w => w.id === activeWorkspaceId)?.path;

  // Forward-encode an absolute path the same way Claude Code does:
  // both '/' and '_' become '-' (verified against actual ~/.claude/projects/ dirs).
  // This avoids the lossy decode problem: dashes/underscores in dir names decode incorrectly.
  const encodeProjectPath = (absPath: string) => absPath.replace(/[/_]/g, '-');
  const wsProjectDir = activeWsPath ? encodeProjectPath(activeWsPath) : null;

  const activeSessions = sessions.filter(s => {
    // Workspace filter: compare raw encoded dir names, not decoded paths
    if (wsFilter === 'current' && wsProjectDir) {
      if (s.project !== wsProjectDir) return false;
    }
    // Activity filter
    if (activeTaskSessionIds.has(s.sessionId)) return true;
    return s.timestamp && Date.now() - new Date(s.timestamp).getTime() < SEVEN_DAYS_MS;
  });

  const deleteSession = async (sessionId: string) => {
    if (!confirm(`Permanently delete this Claude session?\n\n${sessionId}\n\nThis cannot be undone.`)) return;
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    } catch {}
  };

  const bulkSetMessages = useCallback((msgs: ChatMessage[]) => {
    clearMessages();
    setTimeout(() => { msgs.forEach(m => addMessage(m)); }, 0);
  }, [clearMessages, addMessage]);

  const handleNew = () => {
    if (running) { wsManager.send({ type: 'stop' }); setRunning(false); }
    clearMessages();
    setCurrentSessionId(null);
    setSelectedTaskId(null);
    setChatSkillBootstrap(false);
    sessionIdRef.current = undefined;
    setTab('chat');
    setPickingAgent(true);
  };

  const pickAgent = (id: string) => {
    setChatAgent(id);
    setPickingAgent(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const resumeSessionInChat = async (s: SessionSummary) => {
    const linkedTask = tasks.find(t => t.session_id === s.sessionId);
    clearMessages();
    if (linkedTask) {
      setSelectedTaskId(linkedTask.id);
      setChatAgent(linkedTask.agent);
      setChatSkillBootstrap((linkedTask.skills?.length ?? 0) > 0);
    } else {
      setSelectedTaskId(null);
      setChatSkillBootstrap(false);
    }
    setCurrentSessionId(s.sessionId);
    sessionIdRef.current = s.sessionId;
    setPickingAgent(false);
    setTab('chat');
    setLoadingHistory(true);
    try {
      const history = await getSessionMessages(s.sessionId);
      bulkSetMessages(history.map(m => ({ type: m.type, text: m.text, tool: m.tool, input: m.input })));
    } catch {
      addMessage({ type: 'system', text: `Could not load history for ${s.sessionId.slice(0, 8)}…` });
    } finally {
      setLoadingHistory(false);
    }
    setTimeout(() => textareaRef.current?.focus(), 80);
  };

  const slashOptions = draft.startsWith('/')
    ? SLASH_COMMANDS.filter(c => c.cmd.startsWith(draft.toLowerCase().split(' ')[0]))
    : [];

  const applySlashCommand = (cmd: string) => {
    setDraft(cmd + ' ');
    setSlashIdx(0);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleToggleRun = () => {
    if (running) { wsManager.send({ type: 'stop' }); setRunning(false); }
    else if (task) { wsManager.send({ type: 'run_task', taskId: task.id }); setRunning(true); }
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text || running) return;

    // Client-side slash commands
    if (text === '/clear') {
      clearMessages();
      setDraft('');
      return;
    }

    setDraft('');
    setPickingAgent(false);
    addMessage({ type: 'user', text });
    setRunning(true);

    // Slash commands go via interactive PTY runner; regular messages via stream-json
    if (text.startsWith('/')) {
      wsManager.send({ type: 'slash_command', command: text, sessionId: sessionIdRef.current });
    } else {
      wsManager.send({
        type: 'chat',
        message: text,
        agentName: chatAgent,
        sessionId: sessionIdRef.current,
        taskId: selectedTaskId ?? undefined,
        bootstrapSkills: chatSkillBootstrap,
      });
      if (chatSkillBootstrap) setChatSkillBootstrap(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOptions.length > 0) {
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashIdx(i => (i - 1 + slashOptions.length) % slashOptions.length); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIdx(i => (i + 1) % slashOptions.length); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && slashOptions.length > 1)) {
        e.preventDefault();
        applySlashCommand(slashOptions[slashIdx]?.cmd ?? slashOptions[0].cmd);
        return;
      }
      if (e.key === 'Escape') { setDraft(''); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const tabBtn = (id: Tab, label: string) => (
    <button onClick={() => setTab(id)} style={{
      padding: '3px 10px', border: 0, borderRadius: 3, fontSize: 12, fontWeight: 500,
      background: tab === id ? 'var(--bg)' : 'transparent',
      color:      tab === id ? 'var(--fg)' : 'var(--fg-3)',
      boxShadow:  tab === id ? '0 0 0 1px var(--line-2)' : 'none',
      cursor: 'pointer',
    }}>{label}</button>
  );

  return (
    <section className={'chat' + (embedded ? ' chat--embedded' : '')}>
      {/* ── Header ── */}
      <header className="chat-hd">
        <div className="chat-hd-left">
          {!embedded && (
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, padding: 2 }}>
              {tabBtn('chat', 'Chat')}
              {tabBtn('sessions', 'Sessions')}
            </div>
          )}
          <div className="chat-title" style={{ marginTop: embedded ? 0 : 4 }}>
            {embedded ? (
              task ? (
                <><span className="mono">{task.id}</span><span className="sep">·</span><span>{task.title}</span></>
              ) : (
                <span className="muted">Task chat</span>
              )
            ) : tab === 'sessions' ? (
              <span className="muted">Active Claude Code sessions</span>
            ) : task ? (
              <><span className="mono">{task.id}</span><span className="sep">·</span><span>{task.title}</span></>
            ) : sessionId ? (
              <>
                <span className="mono">{sessionId.slice(0, 8)}…</span>
                <span className="sep">·</span>
                <span className="muted" style={{ color: agentColor, opacity: 0.9 }}>{agentLabel}</span>
              </>
            ) : pickingAgent ? (
              <span className="muted">Choose an agent…</span>
            ) : (
              <span className="muted">New session</span>
            )}
          </div>
        </div>

        <div className="chat-hd-right">
          {!embedded && (
            <button className="btn" onClick={handleNew}>
              <span className="btn-glyph">◆</span>New
            </button>
          )}
          {sessionId && (
            <div className="session-id">
              <span className="muted">session</span><span className="mono">{sessionId.slice(0, 8)}…</span>
            </div>
          )}
          {task && (
            <button className={'btn ' + (running ? 'btn-stop' : 'btn-run')} onClick={handleToggleRun}>
              <span className="btn-glyph">{running ? '■' : '▶'}</span>{running ? 'Stop' : 'Run'}
            </button>
          )}
          {!task && running && (
            <button className="btn btn-stop" onClick={() => { wsManager.send({ type: 'stop' }); setRunning(false); }}>
              <span className="btn-glyph">■</span>Stop
            </button>
          )}
        </div>
      </header>

      {/* ── Sessions tab ── */}
      {!embedded && tab === 'sessions' && (
        <div className="chat-log">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
            <select
              value={wsFilter}
              onChange={e => setWsFilter(e.target.value as 'current' | 'all')}
              style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-1)', color: 'var(--fg)', cursor: 'pointer' }}
            >
              {activeWorkspaceId && <option value="current">{workspaces.find(w => w.id === activeWorkspaceId)?.name ?? 'Current workspace'}</option>}
              <option value="all">All workspaces</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'IBM Plex Mono, monospace' }}>{activeSessions.length} sessions</span>
              <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={fetchSessions}>Refresh</button>
            </div>
          </div>
          {loadingSessions && <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Loading…</div>}
          {!loadingSessions && activeSessions.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-mark">◆</div>
              <div className="chat-empty-title">No active sessions</div>
              <div className="chat-empty-sub">Sessions from the last 7 days and non-done tasks appear here.</div>
            </div>
          )}
          {!loadingSessions && activeSessions.map(s => {
            const resumeCmd    = `claude --resume ${s.sessionId}`;
            const linkedTask   = tasks.find(t => t.session_id === s.sessionId);
            const linkedAgent  = linkedTask?.agent ? agents.find(a => a.id === linkedTask.agent) : null;
            const cardColor    = linkedAgent?.tint ?? CLAUDE_ORANGE;
            return (
              <div key={s.sessionId} style={{ padding: '10px 12px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderLeft: `3px solid ${cardColor}`, borderRadius: 7, marginBottom: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.aiTitle || s.firstMessage}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--fg-3)' }}>{s.sessionId.slice(0, 12)}…</span>
                      {linkedTask && (
                        <span style={{ fontSize: 10, color: 'var(--fg-3)', background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 3 }}>
                          {linkedTask.id} · {linkedTask.status}
                        </span>
                      )}
                      {wsFilter === 'all' && (
                        <span style={{ fontSize: 10, color: 'var(--fg-3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.projectPath}>
                          {s.projectPath.split('/').slice(-2).join('/')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                        {s.timestamp ? new Date(s.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      <button title="Delete session" onClick={() => deleteSession(s.sessionId)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'IBM Plex Mono, monospace' }}>{s.messageCount} msgs</span>
                    <span className="btn" style={{ fontSize: 10, padding: '2px 7px', cursor: 'pointer' }} onClick={() => resumeSessionInChat(s)}>Resume →</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', borderRadius: 4, padding: '4px 8px' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--fg-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumeCmd}</span>
                  <button className="btn" style={{ fontSize: 10, padding: '1px 6px', flexShrink: 0 }} onClick={() => navigator.clipboard.writeText(resumeCmd)}>Copy</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Chat tab ── */}
      {(embedded || tab === 'chat') && (
        <>
          <div className="chat-log" ref={logRef}>
            {loadingHistory ? (
              <div className="chat-empty">
                <div className="chat-empty-mark">◆</div>
                <div className="chat-empty-title">Loading history…</div>
              </div>
            ) : pickingAgent ? (
              /* ── Agent picker ── */
              <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New chat</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Provider badge — fixed Claude, swap here when Codex is added */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: CLAUDE_ORANGE + '18', border: `1px solid ${CLAUDE_ORANGE}55`, borderRadius: 5, fontSize: 12, color: 'var(--fg)', flexShrink: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: CLAUDE_ORANGE, display: 'inline-block' }} />
                    Claude
                  </div>
                  {/* Agent dropdown */}
                  <select
                    defaultValue={chatAgent}
                    onChange={e => pickAgent(e.target.value)}
                    style={{
                      flex: 1, padding: '5px 8px', borderRadius: 5, fontSize: 12,
                      border: '1px solid var(--line)', background: 'var(--bg-1)',
                      color: 'var(--fg)', cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="">default</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-mark" style={{ color: agentColor }}>◆</div>
                <div className="chat-empty-title">New session · <span style={{ color: agentColor }}>{agentLabel}</span></div>
                <div className="chat-empty-sub">Type below to start.</div>
              </div>
            ) : (
              messages.map((m, i) => <MessageBubble key={i} msg={m} agentColor={agentColor} />)
            )}
            {running && (
              <div className="msg msg-typing">
                <span className="msg-tag">···</span>
                <span className="typing"><span /><span /><span /></span>
              </div>
            )}
          </div>

          <div className="chat-input">
            {/* Slash command palette */}
            {slashOptions.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                background: 'var(--bg-1)', border: '1px solid var(--line)',
                borderBottom: 'none', borderRadius: '6px 6px 0 0',
                overflow: 'hidden', zIndex: 10,
              }}>
                {slashOptions.map((c, i) => (
                  <div
                    key={c.cmd}
                    onMouseDown={e => { e.preventDefault(); applySlashCommand(c.cmd); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 12px', cursor: 'pointer',
                      background: i === slashIdx ? 'var(--bg-2)' : 'transparent',
                      borderLeft: i === slashIdx ? `2px solid ${CLAUDE_ORANGE}` : '2px solid transparent',
                    }}
                  >
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: CLAUDE_ORANGE, minWidth: 80 }}>{c.cmd}</span>
                    <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{c.desc}</span>
                    {c.local && <span style={{ fontSize: 10, color: 'var(--fg-3)', marginLeft: 'auto', background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 3 }}>local</span>}
                  </div>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => { setDraft(e.target.value); setSlashIdx(0); }}
              onKeyDown={handleKeyDown}
              placeholder={sessionId ? `Continue with ${agentLabel}… (Enter to send, / for commands)` : `Message ${agentLabel}… (Enter to send, / for commands)`}
              rows={2}
            />
            <div className="chat-input-ft">
              <div className="chat-input-meta">
                <span className="kbd">↵</span><span className="muted">send</span>
                <span className="sep">·</span>
                <span className="kbd">⇧↵</span><span className="muted">newline</span>
              </div>
              <button className="btn btn-primary" onClick={handleSend} disabled={!draft.trim() || running}>Send</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
