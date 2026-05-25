# Coding Harness

A local browser UI that wraps **Claude Code CLI** to manage agents, skills, workflows, and tasks across project workspaces. Everything is stored as files on disk — no database, no cloud auth.

## What it does

- **Workspaces** — Register project folders; switch active workspace from the sidebar.
- **Kanban tasks** — Todo → Running → Review → Done (plus confirm/archive); drag-and-drop; auto-queue.
- **Task tabs** — Open any task in its own workspace tab (info, comments, embedded chat).
- **Agents** — Global (`~/.claude/agents`) and workspace-local `.md` personas (model, tools, soul).
- **Skills** — Discovered from disk; at run time Claude is instructed to invoke them via the **Skill tool** (not paste).
- **Workflows** — `single-shot` or `ralph-loop` with `WORKFLOW.md` templates.
- **Planning (PRD)** — Markdown PRD library; create/edit; **Implement as task** (planning task type, no auto-run).
- **Goals** — Goal markdown library; **Run as task** uses `/goal goals/…` slash command.
- **Chat** — WebSocket chat with session resume; task-bound chat in task detail.
- **Memory** — Workspace and per-agent memory files.
- **Settings** — Configurable paths; task type presets; **Setup Coding Harness** copies bundled templates without overwriting existing files.

## Quick start

```bash
git clone git@github.com:navant/coding-harness.git
cd coding-harness
npm run install:all
npm run dev
```

Open **http://localhost:3000**. Backend API: **http://localhost:3001**.

1. Add a **workspace** (path to your project).
2. In **Settings**, click **Setup Coding Harness** to copy `templates/agents` and `templates/skills` into the workspace `.claude` folders (skips files that already exist).
3. Open **Tasks**, create or select a task, or use **Planning** / **Goals** to spawn tasks from markdown.

**Requires:** [Claude Code CLI](https://code.claude.com) (`claude`) installed and authenticated.

## Architecture

```
┌─────────────┐     REST /api      ┌──────────────┐     spawn      ┌─────────────┐
│  React UI   │ ◄──────────────► │ Express :3001│ ─────────────► │ claude CLI  │
│  :3000      │     WebSocket /ws  │  + services  │   PTY slash    │  + sessions │
└─────────────┘                    └──────────────┘                └─────────────┘
                                          │
                                          ▼
                    ~/.coding-harness/config.json
                    <workspace>/.claude/{agents,skills,tasks,prd,goals,...}
```

| Package | Tech |
|---------|------|
| `frontend/` | React, Vite, Zustand, Tailwind |
| `backend/` | Node, TypeScript, Express, `ws` |

Vite dev server proxies `/api` and `/ws` to the backend.

## Data on disk

### App config (`~/.coding-harness/`)

- `config.json` — registered workspaces, active workspace, path settings

### Per workspace (`<workspace>/.claude/` by default)

| Path | Contents |
|------|----------|
| `agents/*.md` | Agent definitions (YAML frontmatter + soul) |
| `skills/<id>/SKILL.md` | Skill packages |
| `workflows/<id>/WORKFLOW.md` | Workflow templates |
| `tasks/<id>/` | `task.json`, `prompt.md`, `progress.txt`, `task.md` |
| `prd/*.md` | Planning documents |
| `goals/*.md` | Goal documents |
| `memory.md` | Workspace memory |
| `task-types.yaml` | Task type presets (agent, workflow, skills) |

Paths are editable under **Settings → Paths**.

### Bundled templates (`templates/`)

- `agents/` — e.g. code-reviewer, github-workflow
- `skills/` — curated skill folders (PRD, ralph, vercel guides, etc.)
- `prd_template.md`, `goals_template.md` — defaults for new files

## Task execution behavior

| Task source | How it runs |
|-------------|-------------|
| Normal task | `claude -p` with prompt + memory + **Skill tool** invocations |
| Linked PRD (planning) | PRD markdown inlined in prompt + skills via Skill tool |
| Goals task | `/goal goals/<path>` via interactive PTY (first run) |
| Ralph / loop workflow | `ralphRunner` over user stories in `prd.json` |
| Nudge / comments | Re-run with feedback from task comments |

## UI map

| Sidebar | Purpose |
|---------|---------|
| Goals | Goal markdown CRUD, invoke as goals task |
| Planning | PRD library, implement as planning task |
| Tasks | Kanban board; pin board to side dock |
| Chat | Standalone agent chat |
| Memory | Memory file browser/editor |
| Agents / Skills / Workflows | Browse and edit on-disk definitions |
| Settings | Paths, task types, **Setup Coding Harness** |

## API overview

| Area | Prefix |
|------|--------|
| Config, paths, setup | `/api/config` |
| Workspaces | `/api/workspaces` |
| Tasks, comments, plan | `/api/tasks` |
| Agents, skills, workflows | `/api/agents`, `/api/skills`, `/api/workflows` |
| PRD, goals | `/api/prd`, `/api/goals` |
| Memory, sessions | `/api/memory`, `/api/sessions` |
| Task types | `/api/task-types` |

WebSocket (`/ws`): `run_task`, `stop`, `chat`, `slash_command`, `task_update`, `progress_append`, `comment_append`, …

## Documentation for AI tools

| File | Audience |
|------|----------|
| [AGENTS.md](./AGENTS.md) | Cursor, Copilot, Claude, and other coding agents |
| [CLAUDE.md](./CLAUDE.md) | Claude Code (imports AGENTS.md) |
| [.claude/rules/](./.claude/rules/) | Path-scoped rules for `backend/` and `frontend/` |
| [plan.md](./plan.md) | Product plan and roadmap |

## Migration from Agent Control Panel

If you used the earlier name:

- App data directory: rename `~/.agent-control-panel` → `~/.coding-harness` (or re-register workspaces in Settings).

## Development

```bash
npm run dev
cd backend && npm run build
cd frontend && npm run build
```

## License

MIT — see [LICENSE](./LICENSE) if present.
