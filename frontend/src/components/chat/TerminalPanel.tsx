import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useStore } from '../../store/useStore';
import { getSessions, SessionSummary } from '../../api/client';

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/terminal`;

type Tab = 'terminal' | 'sessions';

export default function TerminalPanel() {
  const agents        = useStore(s => s.agents);
  const chatAgent     = useStore(s => s.chatAgent);
  const setChatAgent  = useStore(s => s.setChatAgent);
  const setPanelMode  = useStore(s => s.setPanelMode);

  const [tab, setTab]     = useState<Tab>('terminal');
  const [sessions, setSessions]   = useState<SessionSummary[]>([]);
  const [loading, setLoading]     = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  const termRef    = useRef<HTMLDivElement>(null);
  const xterm      = useRef<Terminal | null>(null);
  const fitAddon   = useRef<FitAddon | null>(null);
  const ws         = useRef<WebSocket | null>(null);
  const resizeObs  = useRef<ResizeObserver | null>(null);

  // ── Init xterm ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!termRef.current) return;

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
    fit.fit();

    xterm.current  = term;
    fitAddon.current = fit;

    // Send keystrokes to PTY
    term.onData((data) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'terminal_input', data }));
      }
    });

    // Resize observer → resize PTY
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'terminal_resize',
            cols: term.cols,
            rows: term.rows,
          }));
        }
      } catch {}
    });
    ro.observe(termRef.current);
    resizeObs.current = ro;

    return () => {
      ro.disconnect();
      term.dispose();
      xterm.current  = null;
      fitAddon.current = null;
    };
  }, []);

  // ── Connect WebSocket ────────────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    ws.current?.close();
    const sock = new WebSocket(WS_URL);
    ws.current = sock;

    sock.onopen = () => setConnected(true);
    sock.onclose = () => { setConnected(false); setActiveSessionId(''); };
    sock.onerror = () => setConnected(false);

    sock.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as Record<string, unknown>;
        if (msg.type === 'terminal_output') {
          xterm.current?.write(msg.data as string);
        } else if (msg.type === 'terminal_exit') {
          xterm.current?.writeln('\r\n\x1b[90m[session ended]\x1b[0m');
          setActiveSessionId('');
        }
      } catch {}
    };
  }, []);

  useEffect(() => {
    connectWs();
    return () => { ws.current?.close(); };
  }, [connectWs]);

  // ── Start / resume session ───────────────────────────────────────────────────
  const startSession = useCallback((sessionId?: string) => {
    if (!connected || !ws.current) return;
    const term = xterm.current;
    if (!term) return;

    term.clear();
    setActiveSessionId(sessionId ?? 'new');
    setTab('terminal');

    const agent = agents.find(a => a.id === chatAgent);
    ws.current.send(JSON.stringify({
      type:      'terminal_start',
      sessionId: sessionId ?? undefined,
      agentId:   agent?.id ?? undefined,
      cols:      term.cols,
      rows:      term.rows,
    }));
  }, [connected, agents, chatAgent]);

  const killSession = () => {
    ws.current?.send(JSON.stringify({ type: 'terminal_kill' }));
    setActiveSessionId('');
  };

  // ── Fetch sessions ───────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try { setSessions(await getSessions()); }
    catch { setSessions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'sessions') fetchSessions();
  }, [tab, fetchSessions]);

  const tabBtn = (id: Tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '3px 10px', border: 0, borderRadius: 3, fontSize: 12, fontWeight: 500,
        background: tab === id ? 'var(--bg)' : 'transparent',
        color:      tab === id ? 'var(--fg)' : 'var(--fg-3)',
        boxShadow:  tab === id ? '0 0 0 1px var(--line-2)' : 'none',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <section className="chat" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* ── Header ── */}
      <header className="chat-hd">
        <div className="chat-hd-left">
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, padding: 2 }}>
            {tabBtn('terminal', 'Terminal')}
            {tabBtn('sessions', 'Sessions')}
          </div>
          <div className="chat-title" style={{ marginTop: 4 }}>
            {tab === 'sessions' ? (
              <span className="muted">All Claude Code sessions</span>
            ) : activeSessionId && activeSessionId !== 'new' ? (
              <>
                <span className="mono">{activeSessionId.slice(0, 8)}…</span>
                <span className="sep">·</span>
                <span className="muted">resuming</span>
              </>
            ) : activeSessionId === 'new' ? (
              <span className="muted">New session</span>
            ) : (
              <span className="muted">Press New to start</span>
            )}
          </div>
        </div>

        <div className="chat-hd-right">
          {/* Agent picker */}
          <div className="select">
            <span className="select-label">Agent</span>
            <select value={chatAgent} onChange={e => setChatAgent(e.target.value)}>
              <option value="">claude (default)</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span className="select-caret">▾</span>
          </div>

          {/* Switch to chat */}
          <button className="btn" onClick={() => setPanelMode('chat')} title="Switch to chat">
            <span className="btn-glyph">◆</span>Chat
          </button>

          {/* New session */}
          <button className="btn" onClick={() => startSession()} disabled={!connected}>
            <span className="btn-glyph">◆</span>
            New
          </button>

          {/* Kill running session */}
          {activeSessionId && (
            <button className="btn btn-stop" onClick={killSession}>
              <span className="btn-glyph">■</span>
              Kill
            </button>
          )}

          {/* Connection dot */}
          <span style={{ fontSize: 10, color: connected ? 'var(--green)' : 'var(--fg-3)', marginLeft: 2 }}>
            {connected ? '● connected' : '○ disconnected'}
          </span>
        </div>
      </header>

      {/* ── Terminal tab ── */}
      {tab === 'terminal' && (
        <div
          ref={termRef}
          style={{ flex: 1, minHeight: 0, background: '#0e0d0b', padding: '8px 4px 4px' }}
        />
      )}

      {/* ── Sessions tab ── */}
      {tab === 'sessions' && (
        <div className="chat-log">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'IBM Plex Mono, monospace' }}>
              {sessions.length} sessions
            </span>
            <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={fetchSessions}>Refresh</button>
          </div>

          {loading && <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Loading…</div>}

          {!loading && sessions.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-mark">◆</div>
              <div className="chat-empty-title">No sessions yet</div>
              <div className="chat-empty-sub">Press New to start a claude session.</div>
            </div>
          )}

          {!loading && sessions.map(s => (
            <div
              key={s.sessionId}
              onClick={() => startSession(s.sessionId)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
                padding: '10px 12px', background: 'var(--bg-1)',
                border: '1px solid var(--line)', borderRadius: 7, marginBottom: 6, cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--line-2)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.firstMessage}
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: 'var(--fg-3)', marginBottom: 2 }}>
                  {s.sessionId}
                </div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.projectPath}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                  {s.timestamp ? new Date(s.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'IBM Plex Mono, monospace' }}>{s.messageCount} msgs</span>
                <span className="btn btn-run" style={{ fontSize: 10, padding: '2px 7px' }}>Resume →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
