import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useStore } from '../../store/useStore';
import MessageBubble from './MessageBubble';
import { wsManager, getSessions, getSessionMessages, SessionSummary } from '../../api/client';
import { ChatMessage } from '../../types';

const TERM_WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/terminal`;

function AgentAvatar({ agentId, size = 18 }: { agentId: string; size?: number }) {
  const agent = useStore(s => s.agents).find(a => a.id === agentId);
  if (!agent) return null;
  return (
    <span className="avatar" style={{ width: size, height: size, background: agent.tint + '33', color: agent.tint, fontSize: Math.round(size * 0.42) }} title={agent.name}>
      {agent.name.slice(0, 2)}
    </span>
  );
}

type Tab = 'chat' | 'sessions' | 'terminal';

export default function ChatPanel() {
  const agents          = useStore(s => s.agents);
  const tasks           = useStore(s => s.tasks);
  const selectedTask    = useStore(s => s.selectedTask);
  const setSelectedTask = useStore(s => s.setSelectedTask);
  const chatAgent       = useStore(s => s.chatAgent);
  const setChatAgent    = useStore(s => s.setChatAgent);
  const messages        = useStore(s => s.messages);
  const running         = useStore(s => s.running);
  const currentSessionId    = useStore(s => s.currentSessionId);
  const setCurrentSessionId = useStore(s => s.setCurrentSessionId);
  const addMessage    = useStore(s => s.addMessage);
  const clearMessages = useStore(s => s.clearMessages);
  const setRunning    = useStore(s => s.setRunning);

  const [tab, setTab]           = useState<Tab>('chat');
  const [draft, setDraft]       = useState('');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingHistory, setLoadingHistory]   = useState(false);

  // ── Terminal state ───────────────────────────────────────────────────────────
  const [termConnected, setTermConnected] = useState(false);
  const [termSessionId, setTermSessionId] = useState('');

  // refs are stable across renders — no StrictMode issues
  const termRef      = useRef<HTMLDivElement>(null);
  const xtermRef     = useRef<Terminal | null>(null);
  const fitRef       = useRef<FitAddon | null>(null);
  const termWsRef    = useRef<WebSocket | null>(null);
  const termInitRef  = useRef(false); // track whether xterm has been opened

  const logRef       = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const task = tasks.find(t => t.id === selectedTask);
  const sessionId = currentSessionId || task?.session_id || undefined;
  sessionIdRef.current = sessionId;

  // ── Chat auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length]);

  // ── Sessions fetch ───────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try { setSessions(await getSessions()); }
    catch { setSessions([]); }
    finally { setLoadingSessions(false); }
  }, []);

  useEffect(() => {
    if (tab === 'sessions') fetchSessions();
  }, [tab, fetchSessions, tasks]);

  // ── Terminal: init xterm LAZILY on first terminal-tab visit ──────────────────
  useEffect(() => {
    if (tab !== 'terminal') return;
    if (termInitRef.current) {
      // already initialised – just re-fit after tab becomes visible
      setTimeout(() => fitRef.current?.fit(), 20);
      return;
    }
    if (!termRef.current) return;

    termInitRef.current = true;

    const term = new Terminal({
      fontFamily: '"IBM Plex Mono", "Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      theme: {
        background:    '#0e0d0b',
        foreground:    '#e8e4dc',
        cursor:        '#7aa7d4',
        cursorAccent:  '#0e0d0b',
        selectionBackground: 'rgba(122,167,212,0.3)',
        black:   '#1c1a15', red:     '#cf8a8a', green:  '#8aa57a', yellow: '#c89f6a',
        blue:    '#7aa7d4', magenta: '#b48ac4', cyan:   '#8ab4a8', white:  '#e8e4dc',
        brightBlack:   '#5e5a51', brightRed:     '#cf8a8a', brightGreen:  '#8aa57a',
        brightYellow:  '#c89f6a', brightBlue:    '#7aa7d4', brightMagenta:'#b48ac4',
        brightCyan:    '#8ab4a8', brightWhite:   '#f6f4ef',
      },
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(termRef.current);
    setTimeout(() => fit.fit(), 20);

    xtermRef.current = term;
    fitRef.current   = fit;

    term.onData(data => {
      if (termWsRef.current?.readyState === WebSocket.OPEN) {
        termWsRef.current.send(JSON.stringify({ type: 'terminal_input', data }));
      }
    });

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (termWsRef.current?.readyState === WebSocket.OPEN) {
          termWsRef.current.send(JSON.stringify({
            type: 'terminal_resize',
            cols: term.cols,
            rows: term.rows,
          }));
        }
      } catch {}
    });
    ro.observe(termRef.current);

    // no cleanup — keep xterm alive for the component lifetime
  }, [tab]);

  // ── Terminal: connect PTY WebSocket only when on terminal tab ─────────────────
  useEffect(() => {
    if (tab !== 'terminal') return; // don't connect unless terminal is visible

    // Reconnect if closed
    const existingWs = termWsRef.current;
    if (existingWs && existingWs.readyState !== WebSocket.CLOSED && existingWs.readyState !== WebSocket.CLOSING) {
      return; // already open/connecting
    }

    const sock = new WebSocket(TERM_WS_URL);
    termWsRef.current = sock;

    sock.onopen  = () => setTermConnected(true);
    sock.onclose = () => { setTermConnected(false); setTermSessionId(''); };
    sock.onerror = () => setTermConnected(false);
    sock.onmessage = e => {
      try {
        const msg = JSON.parse(e.data as string) as Record<string, unknown>;
        if (msg.type === 'terminal_output') {
          xtermRef.current?.write(msg.data as string);
        } else if (msg.type === 'terminal_exit') {
          xtermRef.current?.writeln('\r\n\x1b[90m[session ended]\x1b[0m');
          setTermSessionId('');
        }
      } catch {}
    };

    return () => {
      // Only close when tab leaves — keep WS alive while on terminal tab
    };
  }, [tab]);

  // ── Terminal: start/kill session ─────────────────────────────────────────────
  const startTerminalSession = (resumeSessionId?: string) => {
    if (!termWsRef.current || termWsRef.current.readyState !== WebSocket.OPEN) return;
    const term = xtermRef.current;
    if (!term) return;

    term.clear();
    setTermSessionId(resumeSessionId ?? 'new');
    setTab('terminal');

    const agent = agents.find(a => a.id === chatAgent);
    termWsRef.current.send(JSON.stringify({
      type:      'terminal_start',
      sessionId: resumeSessionId ?? undefined,
      agentId:   agent?.id ?? undefined,
      cols:      term.cols,
      rows:      term.rows,
    }));
  };

  const killTerminalSession = () => {
    termWsRef.current?.send(JSON.stringify({ type: 'terminal_kill' }));
    setTermSessionId('');
  };

  // ── Chat helpers ─────────────────────────────────────────────────────────────
  const bulkSetMessages = useCallback((msgs: ChatMessage[]) => {
    clearMessages();
    setTimeout(() => { msgs.forEach(m => addMessage(m)); }, 0);
  }, [clearMessages, addMessage]);

  const startNewChatSession = () => {
    if (running) { wsManager.send({ type: 'stop' }); setRunning(false); }
    clearMessages();
    setCurrentSessionId(null);
    setSelectedTask(null);
    sessionIdRef.current = undefined;
    setTab('chat');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const resumeSessionInChat = async (s: SessionSummary) => {
    clearMessages();
    setSelectedTask(null);
    setCurrentSessionId(s.sessionId);
    sessionIdRef.current = s.sessionId;
    setTab('chat');
    setLoadingHistory(true);

    try {
      const history = await getSessionMessages(s.sessionId);
      const chatMsgs: ChatMessage[] = history.map(m => ({
        type:  m.type,
        text:  m.text,
        tool:  m.tool,
        input: m.input,
      }));
      bulkSetMessages(chatMsgs);
    } catch {
      addMessage({ type: 'system', text: `Could not load history for ${s.sessionId.slice(0, 8)}…` });
    } finally {
      setLoadingHistory(false);
    }

    setTimeout(() => textareaRef.current?.focus(), 80);
  };

  const handleToggleRun = () => {
    if (running) { wsManager.send({ type: 'stop' }); setRunning(false); }
    else if (task) { wsManager.send({ type: 'run_task', taskId: task.id }); setRunning(true); }
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text || running) return;
    setDraft('');
    addMessage({ type: 'user', text });
    setRunning(true);
    wsManager.send({ type: 'chat', message: text, agentName: chatAgent, sessionId: sessionIdRef.current });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleNew = () => {
    if (tab === 'terminal') startTerminalSession();
    else startNewChatSession();
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

  const termReady = termConnected && termInitRef.current;

  return (
    <section className="chat">
      {/* ── Header ── */}
      <header className="chat-hd">
        <div className="chat-hd-left">
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, padding: 2 }}>
            {tabBtn('chat', 'Chat')}
            {tabBtn('sessions', 'Sessions')}
            {tabBtn('terminal', 'Terminal')}
          </div>
          <div className="chat-title" style={{ marginTop: 4 }}>
            {tab === 'sessions' ? (
              <span className="muted">All Claude Code sessions</span>
            ) : tab === 'terminal' ? (
              termSessionId && termSessionId !== 'new'
                ? <><span className="mono">{termSessionId.slice(0, 8)}…</span><span className="sep">·</span><span className="muted">terminal</span></>
                : termSessionId === 'new'
                  ? <span className="muted">Terminal session</span>
                  : <span className="muted">{termConnected ? 'Ready — press New' : 'Connecting…'}</span>
            ) : task ? (
              <><span className="mono">{task.id}</span><span className="sep">·</span><span>{task.title}</span></>
            ) : sessionId ? (
              <><span className="mono">{sessionId.slice(0, 8)}…</span><span className="sep">·</span><span className="muted">{agents.find(a => a.id === chatAgent)?.name ?? 'claude'}</span></>
            ) : (
              <span className="muted">New session</span>
            )}
          </div>
        </div>

        <div className="chat-hd-right">
          <button className="btn" onClick={handleNew}
            disabled={tab === 'terminal' && !termReady}
            title={tab === 'terminal' && !termConnected ? 'Waiting for PTY connection…' : undefined}>
            <span className="btn-glyph">◆</span>New
          </button>

          <div className="select">
            <span className="select-label">Agent</span>
            {chatAgent && <AgentAvatar agentId={chatAgent} size={18} />}
            <select value={chatAgent} onChange={e => setChatAgent(e.target.value)}>
              <option value="">claude (default)</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span className="select-caret">▾</span>
          </div>

          {tab === 'terminal' ? (
            <>
              {termSessionId && (
                <button className="btn btn-stop" onClick={killTerminalSession}>
                  <span className="btn-glyph">■</span>Kill
                </button>
              )}
              <span style={{ fontSize: 10, color: termConnected ? 'var(--green, #6a9f6a)' : 'var(--fg-3)' }}>
                {termConnected ? '● pty' : '○ pty'}
              </span>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </header>

      {/* ── Sessions tab ── */}
      {tab === 'sessions' && (
        <div className="chat-log">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'IBM Plex Mono, monospace' }}>{sessions.length} sessions</span>
            <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={fetchSessions}>Refresh</button>
          </div>

          {loadingSessions && <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Loading…</div>}
          {!loadingSessions && sessions.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-mark">◆</div>
              <div className="chat-empty-title">No sessions yet</div>
              <div className="chat-empty-sub">Run a task or send a message to create one.</div>
            </div>
          )}

          {!loadingSessions && sessions.map(s => (
            <div key={s.sessionId}
              style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '10px 12px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 7, marginBottom: 6, cursor: 'default' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.aiTitle || s.firstMessage}
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--fg-3)', marginBottom: 2 }}>{s.sessionId}</div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.projectPath}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                  {s.timestamp ? new Date(s.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'IBM Plex Mono, monospace' }}>{s.messageCount} msgs</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span className="btn" style={{ fontSize: 10, padding: '2px 7px', cursor: 'pointer' }}
                    onClick={() => resumeSessionInChat(s)}>Chat →</span>
                  <span className="btn btn-run" style={{ fontSize: 10, padding: '2px 7px', cursor: 'pointer' }}
                    onClick={() => startTerminalSession(s.sessionId)}>Term →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Terminal div: always in DOM after first visit (kept mounted so xterm survives tab switches) ── */}
      <div
        ref={termRef}
        style={{
          flex: 1,
          minHeight: 0,
          background: '#0e0d0b',
          padding: '8px 4px 4px',
          display: tab === 'terminal' ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      />

      {/* ── Chat tab ── */}
      {tab === 'chat' && (
        <>
          <div className="chat-log" ref={logRef}>
            {loadingHistory ? (
              <div className="chat-empty">
                <div className="chat-empty-mark">◆</div>
                <div className="chat-empty-title">Loading history…</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-mark">◆</div>
                <div className="chat-empty-title">No messages yet</div>
                <div className="chat-empty-sub">Type below to start, or go to Sessions to resume a past conversation.</div>
              </div>
            ) : (
              messages.map((m, i) => <MessageBubble key={i} msg={m} />)
            )}
            {running && (
              <div className="msg msg-typing">
                <span className="msg-tag">···</span>
                <span className="typing"><span /><span /><span /></span>
              </div>
            )}
          </div>

          <div className="chat-input">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionId ? 'Continue session… (Enter to send, Shift+Enter for newline)' : 'New session… (Enter to send)'}
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
