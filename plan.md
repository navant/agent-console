# Agent Control Panel — Build Plan

## What it is

A local npm app that wraps Claude Code CLI with a browser UI. No auth, no database — everything stored as YAML and markdown files on disk. Agents have persistent identities (soul.md, memory.md) and can be assigned tasks on a Kanban board. Chat panel streams live Claude sessions.

---

## Storage Layout

All data lives in `~/.agent-control-panel/`:

```
~/.agent-control-panel/
  agents/
    <name>/
      config.yaml       ← model, tools, mcp, avatar color
      soul.md           ← system prompt (injected via --append-system-prompt-file)
      memory.md         ← persistent memory (agent reads/updates this)
  workspaces/
    <name>/
      config.yaml       ← name, path (the directory claude runs in)
  tasks/
    <id>.yaml           ← id, title, agent, workspace, status, session_id, timestamps
    <id>.md             ← task description (markdown, passed as the prompt)
  sessions/
    <session_id>.log    ← raw streamed output per session
```

Skills are **read-only** from `~/.claude/agents/` — that's where Claude Code stores sub-agent definitions. We display them, we don't manage them.

---

## Architecture

```
Browser (React + Tailwind)
        ↕  REST API (CRUD for agents/workspaces/tasks)
        ↕  WebSocket (streaming claude output)
Express + ws server (Node.js + TypeScript)  [port 3001]
        ↕  child_process.spawn
claude CLI   ←→  Anthropic API
        ↕  --append-system-prompt-file  soul.md
        ↕  --add-dir                    workspace path
        ↕  --model                      agent model
        ↕  --resume                     session_id (for continue)
```

Vite dev server runs on port 3000 and proxies `/api` and `/ws` to backend on 3001.

---

## Claude CLI Invocation

### New task execution
```bash
claude -p "<task description from .md file>" \
  --model <agent.model> \
  --append-system-prompt-file ~/.agent-control-panel/agents/<name>/soul.md \
  --output-format stream-json \
  --allowedTools "<agent.allowedTools>" \
  --add-dir <workspace.path>
```

### Resuming (chat or continued task)
```bash
claude -p "<next message>" \
  --resume <session_id> \
  --output-format stream-json
```

Session ID is captured from the first `system/init` event in the stream-json output and saved to the task YAML.

### Skills injection
If an agent has skills assigned, their `skill.md` content is appended to `--append-system-prompt` (after soul.md).

---

## WebSocket Protocol

**Server → Client:**
```json
{ "type": "session_start", "sessionId": "abc123", "taskId": "task-001" }
{ "type": "text", "content": "I'll start by reading..." }
{ "type": "tool_use", "tool": "Bash", "input": { "command": "ls" } }
{ "type": "tool_result", "content": "file1.ts\nfile2.ts" }
{ "type": "done", "result": "Task completed." }
{ "type": "error", "message": "claude not found in PATH" }
```

**Client → Server:**
```json
{ "type": "run_task", "taskId": "task-001" }
{ "type": "chat", "message": "continue with tests", "agentName": "coder", "sessionId": "abc123" }
{ "type": "stop" }
```

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Control Panel                            [+ New Task] │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  AGENTS      │   TODO      RUNNING    REVIEW    DONE        │
│  > coder     │   ┌──────┐  ┌──────┐                        │
│  > analyst   │   │Task 1│  │Task 2│                        │
│              │   │coder │  │anal. │                        │
│  WORKSPACES  │   └──────┘  └──────┘                        │
│  > my-app    │                                              │
│  > api-svc   ├──────────────────────────────────────────────┤
│              │  CHAT                              [▶ Run]   │
│  SKILLS      │  Agent: [coder ▼]  Session: new             │
│  researcher  │  ┌──────────────────────────────────────────┐│
│  code-review │  │ > Analyzing the codebase...              ││
│              │  │ [Bash] ls -la src/                       ││
│              │  │ > Found 12 files. Starting review...     ││
│              │  └──────────────────────────────────────────┘│
│              │  [type a message...]             [Send]      │
└──────────────┴──────────────────────────────────────────────┘
```

Task cards show: title, agent name, status badge, and a "▶ Run" / "⏸ Stop" button.

Clicking a task card opens it in the chat panel (resumes its session).

---

## File Structure

```
agent-control-panel/
  package.json              ← root: scripts + concurrently
  plan.md                   ← this file
  .gitignore

  backend/
    package.json
    tsconfig.json
    src/
      index.ts              ← Express + WebSocket server
      config.ts             ← data dir paths
      types.ts              ← AgentConfig, TaskConfig, WorkspaceConfig
      services/
        fileStore.ts        ← YAML/MD read-write helpers
        claudeRunner.ts     ← spawn claude CLI, parse stream-json
      routes/
        agents.ts           ← GET/POST/PUT/DELETE /api/agents
        workspaces.ts       ← GET/POST/DELETE /api/workspaces
        tasks.ts            ← GET/POST/PUT/DELETE /api/tasks, POST /api/tasks/:id/run
        skills.ts           ← GET /api/skills (reads ~/.claude/agents/)

  frontend/
    package.json
    vite.config.ts          ← proxy /api + /ws to backend
    tsconfig.json
    tailwind.config.js
    postcss.config.js
    index.html
    src/
      main.tsx
      App.tsx
      index.css
      types.ts              ← shared types mirrored from backend
      api/
        client.ts           ← fetch helpers + WebSocket manager
      store/
        useStore.ts         ← Zustand: active panel, selected items, chat sessions
      components/
        layout/
          Layout.tsx        ← sidebar + main split
          Sidebar.tsx       ← agents / workspaces / skills lists
        agents/
          AgentPanel.tsx    ← agent list + create form
          AgentItem.tsx     ← single agent row with edit/delete
        workspaces/
          WorkspacePanel.tsx
        skills/
          SkillPanel.tsx    ← read-only list from ~/.claude/agents/
        kanban/
          KanbanBoard.tsx   ← 4 columns
          TaskCard.tsx      ← card with run button
          CreateTaskModal.tsx
        chat/
          ChatPanel.tsx     ← streaming output + message input
          MessageBubble.tsx ← text / tool_use / tool_result rendering
```

---

## Phase Plan

| Phase | Work | Est. |
|-------|------|------|
| 1 | Root + backend scaffold (package.json, tsconfig, config, types) | 1h |
| 2 | File store service (YAML/MD CRUD) | 1h |
| 3 | Claude runner service (spawn, stream, session capture) | 1h |
| 4 | Backend routes (agents, workspaces, tasks, skills) | 1h |
| 5 | Backend WebSocket handler | 30m |
| 6 | Frontend scaffold (Vite, Tailwind, store, API client) | 1h |
| 7 | Layout + Sidebar + panel components | 1h |
| 8 | Kanban board + Task card + Create modal | 1h |
| 9 | Chat panel (streaming, WS, message rendering) | 1h |
| 10 | Wire everything, test end-to-end | 1h |

---

## Key Constraints

- **No database** — YAML + markdown only
- **No auth** — localhost only
- **No managed agents** — pure Claude CLI (`claude` binary must be in PATH)
- **Skills are read-only** — sourced from `~/.claude/agents/` (Claude Code's own sub-agent config)
- **Memory is per-agent** — `memory.md` is injected as part of the system prompt on each run
- The claude CLI must be authenticated (`claude auth login` run separately)
