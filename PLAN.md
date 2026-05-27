# Agent Studio — Rebuild Plan

> White-label agent execution platform: local Pi runtime + web UI.  
> Primary interface: **Task** and **Chat**. Memory = workspace soul.

---

## What we're building

A platform where:
1. A user installs a **local runtime daemon** (wraps the [Pi coding agent](https://pi.dev)) on their machine
2. A **web frontend** connects to that runtime over WebSocket
3. Users manage **tasks, chat, skills, connectors, schedules** through the web UI
4. All data is stored in **SQLite** (local) or **Supabase** (cloud/multi-user)
5. Memory is a **soul** — a workspace-level personality file (like CLAUDE.md) that accumulates context over time

---

## What we keep from agent-console

| Keep | Why |
|------|-----|
| `ptyRunner.ts` | Core process execution via pseudo-terminal — reuse for Pi |
| `taskQueue.ts` | Task queuing logic is runtime-agnostic |
| WebSocket infrastructure (`index.ts`) | WS event plumbing, same shape |
| `config.ts` helpers | `resolveWorkspacePath`, `expandHome` are solid |
| Frontend Zustand store pattern | State management shape works well |
| Kanban board components | Task card/column UI is reusable |
| Chat panel components | Message bubble/stream UI reusable |
| Sidebar/layout structure | Tab + section pattern is the right UX |
| CSS token system (custom props) | Design tokens + dark/light theme, refresh colors |

## What we strip / replace

| Remove | Replace with |
|--------|-------------|
| `claudeRunner.ts`, `archonRunner.ts` | `piRunner.ts` — Pi CLI wrapper |
| `ralphRunner.ts`, `ralphStore.ts` | Not needed in v1 |
| `memorySetupStore.ts` (complex MCP setup) | Simple soul file + DB memory entries |
| `prdStore.ts`, `goalsStore.ts` | Generalized task metadata in DB |
| File-system-only data layer | Drizzle ORM over SQLite / Supabase |
| No auth | JWT + bcrypt auth |
| `setupStore.ts` (workspace copy tool) | Simplified onboarding flow |
| Archon views, Goals view | Removed from v1 scope |

---

## Tech Stack

| Layer | Current | New |
|-------|---------|-----|
| Agent runtime | Claude Code CLI | **Pi coding agent CLI** (15+ LLM providers, MIT) |
| DB | Filesystem only | **SQLite** (local) / **Supabase** (cloud) |
| ORM | None | **Drizzle ORM** (SQLite-first, Supabase adapter built-in) |
| Auth | None | **JWT + bcrypt** (local) / **Supabase Auth** (cloud) |
| Backend | Express + TypeScript | Express + TypeScript (keep) |
| Frontend state | Zustand | Zustand (keep) |
| Frontend build | React + Vite | React + Vite (keep) |
| Styling | Custom CSS tokens | Custom CSS tokens (refresh, keep no UI lib) |
| Process exec | node pty | node pty (keep) |
| Scheduling | None | **node-cron** |

### Why Pi over Claude Code for the runtime?
Pi supports Anthropic, OpenAI, Ollama, Gemini, and 12+ other providers via a single interface. This makes the white-label story work — users can bring any LLM key, not just Claude. The local install is one curl command.

### Why Drizzle over Prisma?
Better SQLite support, lighter footprint, and the Supabase adapter is first-class. Schema migrations are plain SQL files — easy to version.

### Why SQLite + Supabase (not just one)?
Local installs need zero-config (SQLite file on disk). Hosted/multi-user deployments need Supabase (Postgres + Auth + Realtime). Drizzle lets us swap the driver without touching business logic.

---

## DB Schema

```sql
-- Core identity
users            (id, email, password_hash, name, avatar_url, created_at)
sessions         (id, user_id, token_hash, expires_at, created_at)

-- Workspaces
workspaces       (id, user_id, name, path, description, soul_content, created_at)

-- Tasks
tasks            (id, workspace_id, user_id, title, description, status,
                  prd_content, skill_ids_json, connector_ids_json, created_at, updated_at)
task_runs        (id, task_id, exit_code, duration_ms, output_path, created_at)

-- Chat
chat_threads     (id, workspace_id, user_id, task_id, title, created_at)
chat_messages    (id, thread_id, role, content, tool_use_json, created_at)

-- Skills
skills           (id, user_id, workspace_id, name, slug, content, source_type,
                  is_public, created_at)

-- Connectors
connectors       (id, workspace_id, type, name, config_json, status, created_at)
                 -- type: 'mcp' | 'rest_webhook'

-- Scheduler
schedules        (id, workspace_id, name, task_template_json, cron_expr,
                  enabled, last_run_at, next_run_at, created_at)

-- Memory
memory_entries   (id, workspace_id, user_id, content, tags_json, source_type,
                  created_at)
                 -- source_type: 'manual' | 'chat' | 'task_output'
```

### Data storage rule
If a user says "save this" in chat → insert a `memory_entry`.  
Soul = `workspaces.soul_content` (injected into every task prompt, like CLAUDE.md).

---

## Architecture

```
[Web Frontend :3000]
      │  REST + WebSocket
      ▼
[Backend API :3001]  ←── Drizzle ORM ───► [SQLite file]  ←── or Supabase (same schema)
      │
      ├── Auth routes   /api/auth/**
      ├── Task routes   /api/tasks/**
      ├── Chat routes   /api/chat/**
      ├── Skills routes /api/skills/**
      ├── Connector routes /api/connectors/**
      ├── Schedule routes  /api/schedules/**
      └── Memory routes    /api/memory/**
      │
      ▼
[piRunner.ts]  — spawns `pi` CLI via node-pty
      │
      ▼
[Pi agent process]  — uses configured LLM provider + MCP connectors
```

---

## Phases

### Phase 0 — Skeleton (Week 1)
- Fork repo, delete: ralph, archon, goals, memory-setup, prd views
- Add Drizzle + SQLite; run `drizzle-kit generate` on schema above
- `.env` config: `DB_MODE=sqlite|supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET`
- Seed script for dev

**Deliverable:** `npm run dev` starts with empty DB, no auth yet.

### Phase 1 — Auth (Week 1–2)
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- JWT access token (15 min) + refresh token (7 days) in httpOnly cookie
- Auth middleware on all `/api/**` routes
- Frontend: login/signup pages, auth guard on app routes
- Supabase Auth mode: swap JWT logic for Supabase client (same API surface)

**Deliverable:** Register, login, protected routes working.

### Phase 2 — Pi Runtime (Week 2)
- `piRunner.ts` — detect Pi install (`which pi`), spawn via node-pty
- Stream stdout/stderr over existing WebSocket event shape
- `GET /api/runtime/status` — installed, version, active provider
- `POST /api/runtime/configure` — set LLM provider + API key (stored encrypted)
- Frontend: Runtime status panel in Settings

**Deliverable:** Task runs execute via Pi, stream to frontend.

### Phase 3 — Tasks + Chat (Week 2–3)
- Port kanban board to use DB-backed tasks (CRUD via `/api/tasks/**`)
- Task detail: prompt editor, status, run history
- Chat tab per task — threads stored in DB, messages stream live
- Soul content injected into every task prompt automatically
- "Save to memory" button in chat → `POST /api/memory`

**Deliverable:** Create task → run via Pi → see output in chat → save to memory.

### Phase 4 — Skills (Week 3–4)
- Skills CRUD (`/api/skills/**`)
- Upload `.md` / `.yaml` skill files (multer)
- Skills browser in sidebar — activate per-task
- Skill content injected into task prompt at run time (same as current `buildSkillInvocationPrompt`)
- Built-in skill templates (create from scratch in UI)

**Deliverable:** Upload skill, activate on task, see it in prompt.

### Phase 5 — Connectors (Week 4–5)
- Connector framework: base class `BaseConnector`, `connect()`, `test()`, `disconnect()`
- **MCP connector**: config fields (command, args, env), test spawn, pass `--mcp` flags to Pi
- **REST/Webhook connector**: base URL, auth header, optional inbound webhook URL (ngrok hint)
- Connector status badges in sidebar
- Connectors attached to workspaces, available to all tasks in that workspace

**Deliverable:** Add MCP server connector → Pi tasks use it automatically.

#### Recommended connector roadmap
| Priority | Connector | Rationale |
|----------|-----------|-----------|
| v1 | MCP servers | Pi natively supports MCP; broadest utility |
| v1 | REST/webhook | Generic; covers GitHub API, Slack webhooks, any HTTP service |
| v2 | GitHub native | Repo context, PR triggers, issue-to-task |
| v2 | Slack | Trigger tasks from Slack slash command |
| v3 | Email (IMAP/SMTP) | Email-to-task pipeline |

### Phase 6 — Scheduler (Week 5)
- `node-cron` for local schedule execution
- Schedules CRUD (`/api/schedules/**`)
- Task template stored as JSON (title, prompt, skill_ids, connector_ids)
- Cron expression builder in UI (human-readable preview)
- Schedule log → last N runs with status

**Deliverable:** Set a cron, task runs automatically, result stored in DB.

### Phase 7 — Soul + Memory (Week 6)
- Soul editor in Workspace settings (markdown, auto-saved to DB)
- Memory browser: list entries, search, tag filter, delete
- `memory_entries` surfaced in chat context (top-K by recency + tag)
- Memory import: bulk upload past Claude Code CLAUDE.md content
- Export soul + memory as `.md` bundle

**Deliverable:** Soul injected in prompts, memory accumulates, browsable.

### Phase 8 — Supabase mode + Multi-user (Week 7–8)
- Drizzle adapter swap: SQLite driver → Supabase Postgres driver (env flag)
- Supabase Auth integration (replace JWT layer)
- Row-Level Security policies on all tables (users see only their data)
- Supabase Realtime for live task updates (replace custom WS for DB events)
- Workspace sharing: invite by email, read/write roles
- Deploy guide: Supabase project setup, env vars, Railway/Fly.io backend deploy

**Deliverable:** Same app works in cloud multi-user mode.

---

## UI Structure (new, stripped from agent-console)

```
Sidebar
├── Workspaces (switcher)
├── Tasks (kanban shortcut)
├── Chats (recent threads)
├── Skills (library)
├── Connectors (status)
├── Schedules
└── Memory

Main area
├── /tasks          — Kanban board
├── /tasks/:id      — Task detail + chat tab
├── /chat           — Standalone chat (no task)
├── /skills         — Skills library + upload
├── /connectors     — Connector config
├── /schedules      — Cron management
├── /memory         — Memory browser
└── /settings       — Runtime, soul editor, workspace, auth
```

---

## File structure delta (vs agent-console)

```
New additions:
backend/src/
├── db/
│   ├── schema.ts          # Drizzle schema
│   ├── client.ts          # SQLite or Supabase client
│   └── migrations/        # drizzle-kit output
├── services/
│   ├── piRunner.ts        # Pi CLI wrapper (replaces claudeRunner)
│   ├── connectorStore.ts  # Connector CRUD + lifecycle
│   ├── schedulerService.ts# node-cron wrapper
│   └── memoryStore.ts     # Memory entries CRUD
├── middleware/
│   └── auth.ts            # JWT verify middleware
└── routes/
    ├── auth.ts
    ├── tasks.ts
    ├── chat.ts
    ├── skills.ts
    ├── connectors.ts
    ├── schedules.ts
    └── memory.ts

Deleted:
backend/src/services/claudeRunner.ts
backend/src/services/ralphRunner.ts
backend/src/services/archonRunner.ts
backend/src/services/archonSetupStore.ts
backend/src/services/memorySetupStore.ts
backend/src/services/goalsStore.ts
templates/ralph/
```

---

## Open questions before starting

1. **Product name** — working title is "Agent Studio". Do you have a name?
2. **Pi provider default** — Anthropic (Claude) or let user pick at onboarding?
3. **Packaging** — local install via `npm install -g agent-studio`? Or Electron app later?
4. **Supabase project** — do you have one, or create fresh?
5. **Monetization shape** — if SaaS eventually, does each user bring their own Pi API key, or do you proxy it?

---

## Suggested start order

```
Week 1:  Phase 0 (skeleton + DB) + Phase 1 (auth)
Week 2:  Phase 2 (Pi runtime) + Phase 3 (tasks + chat)
Week 3:  Phase 4 (skills) + Phase 5 (connectors)
Week 4:  Phase 6 (scheduler) + Phase 7 (soul/memory)
Week 5+: Phase 8 (Supabase + multi-user) + polish
```

Total estimate: **5–6 focused weeks** for a working v1.

---

_Generated: 2026-05-25_
