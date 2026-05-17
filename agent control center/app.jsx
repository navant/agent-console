/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakToggle, TweakSlider */
const { useState, useEffect, useRef, useMemo } = React;

// ─── Mock data ──────────────────────────────────────────────────────────────

const AGENTS = [
{ id: "coder", name: "coder", model: "claude-sonnet-4-5", tint: "#7aa7d4", status: "running" },
{ id: "analyst", name: "analyst", model: "claude-opus-4-5", tint: "#c89f6a", status: "idle" },
{ id: "researcher", name: "researcher", model: "claude-sonnet-4-5", tint: "#8aa57a", status: "idle" },
{ id: "scribe", name: "scribe", model: "claude-haiku-4-5", tint: "#b48ac4", status: "idle" }];


const WORKSPACES = [
{ id: "my-app", name: "my-app", path: "~/code/my-app" },
{ id: "api-svc", name: "api-svc", path: "~/code/api-svc" },
{ id: "infra", name: "infra", path: "~/code/infra" }];


const SKILLS = [
{ id: "code-review", name: "code-review" },
{ id: "test-writer", name: "test-writer" },
{ id: "doc-gen", name: "doc-gen" },
{ id: "refactor", name: "refactor" }];


const TASKS = [
{ id: "T-104", title: "Audit token refresh flow", agent: "analyst", workspace: "api-svc", status: "todo", session: null, age: "2h" },
{ id: "T-103", title: "Migrate config to YAML loader", agent: "coder", workspace: "my-app", status: "todo", session: null, age: "5h" },
{ id: "T-102", title: "Wire WebSocket reconnect logic", agent: "coder", workspace: "my-app", status: "running", session: "s_8f2a91", age: "12m" },
{ id: "T-101", title: "Compare vector store options", agent: "researcher", workspace: "infra", status: "running", session: "s_3c4d77", age: "34m" },
{ id: "T-099", title: "Draft API reference for /tasks", agent: "scribe", workspace: "api-svc", status: "review", session: "s_1ab209", age: "1d" },
{ id: "T-098", title: "Refactor fileStore into modules", agent: "coder", workspace: "my-app", status: "review", session: "s_0e8801", age: "1d" },
{ id: "T-095", title: "Add streaming json parser", agent: "coder", workspace: "my-app", status: "done", session: "s_aa1100", age: "2d" },
{ id: "T-091", title: "Set up vite proxy + ws", agent: "coder", workspace: "my-app", status: "done", session: "s_b22011", age: "3d" }];


const COLUMNS = [
{ id: "todo", label: "Todo", hue: "var(--muted)" },
{ id: "running", label: "Running", hue: "var(--accent)" },
{ id: "review", label: "Review", hue: "var(--amber)" },
{ id: "done", label: "Done", hue: "var(--green)" }];


const SAMPLE_STREAM = [
{ type: "system", text: "session_start  s_3c4d77  ·  researcher  ·  claude-sonnet-4-5" },
{ type: "text", text: "I'll start by mapping the current vector store landscape against our constraints (latency budget, hybrid search, on-prem option). Reading the constraints doc first." },
{ type: "tool_use", tool: "Read", input: "~/code/infra/docs/constraints.md" },
{ type: "tool_result", text: "12 KB · 184 lines\n• p95 query latency ≤ 80ms\n• hybrid (dense + bm25) required\n• must self-host (no managed-only)\n• MIT or Apache license" },
{ type: "text", text: "Three serious candidates fit all four hard requirements. Building a comparison matrix now." },
{ type: "tool_use", tool: "Bash", input: "ls -la benchmarks/" },
{ type: "tool_result", text: "drwxr-xr-x  6 dev  staff   192  May 14 10:22 .\n-rw-r--r--  1 dev  staff  4321  May 14 10:18 qdrant.json\n-rw-r--r--  1 dev  staff  3902  May 14 10:18 weaviate.json\n-rw-r--r--  1 dev  staff  4118  May 14 10:18 lancedb.json" },
{ type: "text", text: "Benchmarks already exist for all three. I'll normalize them into a single table and surface the trade-offs." }];


// ─── Small UI bits ──────────────────────────────────────────────────────────

function Dot({ color, pulse }) {
  return (
    <span
      className={pulse ? "dot pulse" : "dot"}
      style={{ background: color }} />);


}

function StatusPill({ status }) {
  const col = COLUMNS.find((c) => c.id === status) || COLUMNS[0];
  return (
    <span className="pill">
      <Dot color={col.hue} pulse={status === "running"} />
      {col.label}
    </span>);

}

function AgentAvatar({ agent, size = 22 }) {
  const a = AGENTS.find((x) => x.id === agent);
  if (!a) return null;
  const initials = a.name.slice(0, 2);
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: a.tint + "33",
        color: a.tint,
        fontSize: Math.round(size * 0.42)
      }}
      title={a.name}>
      
      {initials}
    </span>);

}

// ─── Sidebar ────────────────────────────────────────────────────────────────

function SidebarSection({ label, count, children, action }) {
  return (
    <div className="side-sect">
      <div className="side-sect-hd">
        <span>{label}</span>
        <span className="side-sect-meta">
          <span className="count">{count}</span>
          {action}
        </span>
      </div>
      <div className="side-list">{children}</div>
    </div>);

}

function Sidebar({ selectedAgent, onSelectAgent, onNewAgent, onNewWorkspace }) {
  return (
    <aside className="sidebar" data-screen-label="sidebar">
      <div className="brand">
        <div className="brand-mark">◆</div>
        <div className="brand-text">
          <div className="brand-title">Agent Control</div>
          <div className="brand-sub">localhost:3000 · connected</div>
        </div>
      </div>

      <SidebarSection
        label="Agents"
        count={AGENTS.length}
        action={<button className="icon-btn" title="New agent" onClick={onNewAgent}>+</button>}>
        
        {AGENTS.map((a) =>
        <button
          key={a.id}
          className={"side-row" + (selectedAgent === a.id ? " is-selected" : "")}
          onClick={() => onSelectAgent(a.id)}>
          
            <AgentAvatar agent={a.id} size={20} />
            <span className="side-row-name">{a.name}</span>
            <span className="side-row-meta">
              {a.status === "running" ?
            <Dot color="var(--accent)" pulse /> :

            <span className="model-chip">{a.model.split("-")[1]}</span>
            }
            </span>
          </button>
        )}
      </SidebarSection>

      <SidebarSection
        label="Workspaces"
        count={WORKSPACES.length}
        action={<button className="icon-btn" title="New workspace" onClick={onNewWorkspace}>+</button>}>
        
        {WORKSPACES.map((w) =>
        <button key={w.id} className="side-row">
            <span className="folder-glyph">▸</span>
            <span className="side-row-name">{w.name}</span>
            <span className="side-row-path">{w.path}</span>
          </button>
        )}
      </SidebarSection>

      <SidebarSection label="Skills" count={SKILLS.length}>
        {SKILLS.map((s) =>
        <button key={s.id} className="side-row side-row--quiet">
            <span className="skill-glyph">◇</span>
            <span className="side-row-name">{s.name}</span>
            <span className="side-row-meta side-row-meta--faint">read-only</span>
          </button>
        )}
      </SidebarSection>

      <div className="side-footer">
        <span>claude · v1.8.2</span>
        <span className="ok-dot">●</span>
      </div>
    </aside>);

}

// ─── Kanban ─────────────────────────────────────────────────────────────────

function TaskCard({ task, selected, onSelect, onAction }) {
  const isRunning = task.status === "running";
  return (
    <div
      className={"task" + (selected ? " is-selected" : "")}
      onClick={() => onSelect(task.id)}>
      
      <div className="task-hd">
        <span className="task-id">{task.id}</span>
        <span className="task-age">{task.age}</span>
      </div>
      <div className="task-title">{task.title}</div>
      <div className="task-ft">
        <div className="task-meta">
          <AgentAvatar agent={task.agent} size={18} />
          <span className="task-meta-name">{task.agent}</span>
          <span className="task-meta-sep">/</span>
          <span className="task-meta-ws">{task.workspace}</span>
        </div>
        <button
          className={"task-run" + (isRunning ? " is-running" : "")}
          onClick={(e) => {
            e.stopPropagation();
            onAction(task.id);
          }}>
          
          {isRunning ?
          <>
              <span className="run-glyph">■</span>
              Stop
            </> :

          <>
              <span className="run-glyph">▶</span>
              Run
            </>
          }
        </button>
      </div>
      {task.session &&
      <div className="task-session">
          <span className="mono">{task.session}</span>
        </div>
      }
    </div>);

}

function KanbanColumn({ column, tasks, selectedTask, onSelect, onAction }) {
  return (
    <div className="col" data-screen-label={`col-${column.id}`}>
      <div className="col-hd">
        <span className="col-title">
          <Dot color={column.hue} pulse={column.id === "running"} />
          {column.label}
        </span>
        <span className="col-count">{tasks.length}</span>
      </div>
      <div className="col-body">
        {tasks.map((t) =>
        <TaskCard
          key={t.id}
          task={t}
          selected={selectedTask === t.id}
          onSelect={onSelect}
          onAction={onAction} />

        )}
        {tasks.length === 0 && <div className="col-empty">—</div>}
      </div>
    </div>);

}

function ThemeToggle({ theme, onChange }) {
  const isDark = theme === "dark";
  return (
    <button
      className="theme-toggle"
      onClick={() => onChange(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light" : "Switch to dark"}
      aria-label="Toggle theme">
      
      <span className={"theme-track" + (isDark ? " is-dark" : "")}>
        <span className="theme-knob">
          <span className="theme-glyph theme-glyph--sun">☀</span>
          <span className="theme-glyph theme-glyph--moon">☾</span>
        </span>
      </span>
    </button>);

}

function Kanban({ tasks, selectedTask, onSelect, onAction, onNewTask, theme, onTheme }) {
  const grouped = useMemo(() => {
    const g = {};
    COLUMNS.forEach((c) => g[c.id] = []);
    tasks.forEach((t) => g[t.status].push(t));
    return g;
  }, [tasks]);

  return (
    <section className="kanban" data-screen-label="kanban">
      <header className="kanban-hd">
        <div className="kanban-title">
          <h1>Tasks</h1>
          <span className="kanban-sub">{tasks.length} total · {grouped.running.length} active</span>
        </div>
        <div className="kanban-actions">
          <div className="search">
            <span className="search-glyph">⌕</span>
            <input placeholder="Filter tasks…" />
            <span className="kbd">⌘K</span>
          </div>
          <ThemeToggle theme={theme} onChange={onTheme} />
          <button className="btn btn-primary" onClick={onNewTask}>
            <span className="btn-glyph">+</span>
            New task
          </button>
        </div>
      </header>
      <div className="cols">
        {COLUMNS.map((c) =>
        <KanbanColumn
          key={c.id}
          column={c}
          tasks={grouped[c.id]}
          selectedTask={selectedTask}
          onSelect={onSelect}
          onAction={onAction} />

        )}
      </div>
    </section>);

}

// ─── Chat panel ─────────────────────────────────────────────────────────────

function StreamMessage({ msg }) {
  if (msg.type === "system") {
    return (
      <div className="msg msg-system">
        <span className="msg-tag">SYS</span>
        <span className="mono">{msg.text}</span>
      </div>);

  }
  if (msg.type === "text") {
    return (
      <div className="msg msg-text">
        <span className="msg-tag">OUT</span>
        <div className="msg-body">{msg.text}</div>
      </div>);

  }
  if (msg.type === "tool_use") {
    return (
      <div className="msg msg-tool">
        <span className="msg-tag tag-tool">{msg.tool}</span>
        <code className="mono">{msg.input}</code>
      </div>);

  }
  if (msg.type === "tool_result") {
    return (
      <div className="msg msg-result">
        <span className="msg-tag tag-result">↳</span>
        <pre className="mono">{msg.text}</pre>
      </div>);

  }
  if (msg.type === "user") {
    return (
      <div className="msg msg-user">
        <span className="msg-tag tag-user">YOU</span>
        <div className="msg-body">{msg.text}</div>
      </div>);

  }
  return null;
}

function ChatPanel({ task, agent, onChangeAgent, running, onToggleRun, messages, onSend }) {
  const [draft, setDraft] = useState("");
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length]);

  const send = () => {
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft("");
  };

  return (
    <section className="chat" data-screen-label="chat">
      <header className="chat-hd">
        <div className="chat-hd-left">
          <span className="chat-eyebrow">Session</span>
          <div className="chat-title">
            {task ?
            <>
                <span className="mono">{task.id}</span>
                <span className="sep">·</span>
                <span>{task.title}</span>
              </> :

            <span className="muted">No task selected — pick one from the board</span>
            }
          </div>
        </div>
        <div className="chat-hd-right">
          <div className="select">
            <span className="select-label">Agent</span>
            <AgentAvatar agent={agent} size={18} />
            <select value={agent} onChange={(e) => onChangeAgent(e.target.value)}>
              {AGENTS.map((a) =>
              <option key={a.id} value={a.id}>{a.name}</option>
              )}
            </select>
            <span className="select-caret">▾</span>
          </div>
          <div className="session-id">
            {task?.session ?
            <>
                <span className="muted">resume</span>
                <span className="mono">{task.session}</span>
              </> :

            <span className="muted">new session</span>
            }
          </div>
          <button
            className={"btn " + (running ? "btn-stop" : "btn-run")}
            onClick={onToggleRun}
            disabled={!task}>
            
            <span className="btn-glyph">{running ? "■" : "▶"}</span>
            {running ? "Stop" : "Run"}
          </button>
        </div>
      </header>

      <div className="chat-log" ref={logRef}>
        {messages.length === 0 ?
        <div className="chat-empty">
            <div className="chat-empty-mark">◆</div>
            <div className="chat-empty-title">No stream yet</div>
            <div className="chat-empty-sub">
              Pick a task and press Run, or type a message below to start a new session.
            </div>
          </div> :

        messages.map((m, i) => <StreamMessage key={i} msg={m} />)
        }
        {running &&
        <div className="msg msg-typing">
            <span className="msg-tag">···</span>
            <span className="typing">
              <span /><span /><span />
            </span>
          </div>
        }
      </div>

      <div className="chat-input">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          placeholder={task ? "Continue the session…  (⌘↵ to send)" : "Type a message to start…"}
          rows={2} />
        
        <div className="chat-input-ft">
          <div className="chat-input-meta">
            <span className="kbd">⌘</span>
            <span className="kbd">↵</span>
            <span className="muted">to send</span>
            <span className="sep">·</span>
            <span className="muted">streaming via</span>
            <span className="mono">/ws</span>
          </div>
          <button className="btn btn-primary" onClick={send} disabled={!draft.trim()}>
            Send
          </button>
        </div>
      </div>
    </section>);

}

// ─── App root ───────────────────────────────────────────────────────────────

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "#7aa7d4",
  "density": "regular",
  "showStream": true
} /*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [agents, setAgents] = useState(AGENTS);
  const [workspaces, setWorkspaces] = useState(WORKSPACES);
  const [tasks, setTasks] = useState(TASKS);
  const [selectedTask, setSelectedTask] = useState("T-101");
  const [selectedAgent, setSelectedAgent] = useState("researcher");
  const [chatAgent, setChatAgent] = useState("researcher");
  const [messages, setMessages] = useState(t.showStream ? SAMPLE_STREAM : []);
  const [running, setRunning] = useState(true);
  const [modal, setModal] = useState(null); // 'agent' | 'workspace' | null

  useEffect(() => {
    setMessages(t.showStream ? SAMPLE_STREAM : []);
  }, [t.showStream]);

  const task = tasks.find((x) => x.id === selectedTask);

  const onAction = (id) => {
    setTasks((prev) =>
    prev.map((x) => {
      if (x.id !== id) return x;
      if (x.status === "running") return { ...x, status: "review" };
      if (x.status === "todo") return { ...x, status: "running", session: "s_" + Math.random().toString(16).slice(2, 8) };
      return x;
    })
    );
  };

  const onToggleRun = () => {
    setRunning((r) => !r);
    if (!running && task) {
      setMessages((m) => [...m, { type: "system", text: "resume  " + (task.session || "new") }]);
    }
  };

  const onSend = (text) => {
    setMessages((m) => [...m, { type: "user", text }]);
    setRunning(true);
    setTimeout(() => {
      setMessages((m) => [...m, { type: "text", text: "Got it — looking into that now." }]);
    }, 700);
  };

  const onNewTask = () => {
    const id = "T-" + (105 + tasks.length - 8);
    setTasks((prev) => [
    { id, title: "New task — describe what to do", agent: selectedAgent, workspace: "my-app", status: "todo", session: null, age: "now" },
    ...prev]
    );
  };

  return (
    <div className={"app " + t.theme + " density-" + t.density} style={{ "--accent": t.accent }}>
      <Sidebar
        selectedAgent={selectedAgent}
        onSelectAgent={(id) => {setSelectedAgent(id);setChatAgent(id);}}
        onNewAgent={() => setModal("agent")}
        onNewWorkspace={() => setModal("workspace")} />
      
      <main className="main">
        <Kanban
          tasks={tasks}
          selectedTask={selectedTask}
          onSelect={setSelectedTask}
          onAction={onAction}
          onNewTask={onNewTask}
          theme={t.theme}
          onTheme={(v) => setTweak("theme", v)} />
        
        <ChatPanel
          task={task}
          agent={chatAgent}
          onChangeAgent={setChatAgent}
          running={running}
          onToggleRun={onToggleRun}
          messages={messages}
          onSend={onSend} />
        
      </main>

      <CreateAgentModal
        open={modal === "agent"}
        onClose={() => setModal(null)}
        onCreate={(a) => {
          AGENTS.push(a);
          setAgents([...AGENTS]);
        }} />
      
      <CreateWorkspaceModal
        open={modal === "workspace"}
        onClose={() => setModal(null)}
        onCreate={(w) => {
          WORKSPACES.push(w);
          setWorkspaces([...WORKSPACES]);
        }} />
      

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakRadio
          label="Theme"
          value={t.theme}
          options={["dark", "light"]}
          onChange={(v) => setTweak("theme", v)} />
        
        <TweakColor
          label="Accent"
          value={t.accent}
          options={["#7aa7d4", "#c89f6a", "#8aa57a", "#b48ac4", "#d97757"]}
          onChange={(v) => setTweak("accent", v)} />
        
        <TweakRadio
          label="Density"
          value={t.density}
          options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)} />
        
        <TweakSection label="Demo" />
        <TweakToggle
          label="Show stream"
          value={t.showStream}
          onChange={(v) => setTweak("showStream", v)} />
        
      </TweaksPanel>
    </div>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);