# Agent Console

A local browser UI that gives you **visibility and control over a project workspace** for coding agents (Claude Code CLI). Manage tasks, agents, skills, workflows, PRDs, and goals — all as files on disk. No database, no cloud auth.

## What it does

- **Workspaces** — Register project folders; switch the active workspace from the sidebar.
- **Kanban tasks** — Todo → Running → Review → Done; drag-and-drop; auto-queue.
- **Task tabs** — Open any task in its own tab (info, comments, embedded chat).
- **Agents** — Global (`~/.claude/agents`) and workspace-local `.md` personas.
- **Skills** — On disk; runs invoke them via the **Skill tool** (not paste).
- **Workflows** — `single-shot` or `ralph-loop` with `WORKFLOW.md` templates.
- **Planning (PRD)** — Markdown library; **Implement as task** (no auto-run).
- **Goals** — Goal markdown; **Run as task** uses `/goal goals/…` slash command.
- **Chat** — WebSocket chat with session resume.
- **Settings** — Configurable paths; task types; **Setup workspace** copies bundled templates (never overwrites existing files).

## Quick start

```bash
git clone git@github.com:navant/agent-console.git
cd agent-console
npm run install:all
npm run dev
```

Open **http://localhost:3000** (API **http://localhost:3001**).

1. Add a **workspace** (your project path).
2. **Settings → Setup workspace** — copies `templates/agents` and `templates/skills` into `.claude/` (skip-if-exists).
3. Use **Tasks**, **Planning**, or **Goals** to work with agents.

**Requires:** [Claude Code CLI](https://code.claude.com) (`claude`) installed and authenticated.

## Architecture

```
┌─────────────┐     REST /api      ┌──────────────┐     spawn      ┌─────────────┐
│  React UI   │ ◄──────────────► │ Express :3001│ ─────────────► │ claude CLI  │
│  :3000      │     WebSocket /ws  │  + services  │   PTY slash    │             │
└─────────────┘                    └──────────────┘                └─────────────┘
                                          │
                                          ▼
                    ~/.agent-console/config.json
                    <workspace>/.claude/{agents,skills,tasks,prd,goals,...}
```

| Package | Tech |
|---------|------|
| `frontend/` | React, Vite, Zustand, Tailwind |
| `backend/` | Node, TypeScript, Express, `ws` |

## Data on disk

### App config (`~/.agent-console/`)

- `config.json` — workspaces, active workspace, path settings

### Per workspace (default `<workspace>/.claude/`)

| Path | Contents |
|------|----------|
| `agents/*.md` | Agent personas |
| `skills/<id>/SKILL.md` | Skills |
| `workflows/<id>/WORKFLOW.md` | Workflows |
| `tasks/<id>/` | Task data, progress, comments |
| `prd/*.md` | Planning docs |
| `goals/*.md` | Goal docs |
| `task-types.yaml` | Task type presets |

Bundled starters live in `templates/`.

## Documentation

| File | Purpose |
|------|---------|
| [AGENTS.md](./AGENTS.md) | Instructions for coding agents |
| [CLAUDE.md](./CLAUDE.md) | Claude Code specifics |
| [plan.md](./plan.md) | Product roadmap |

## Migration

Older installs may have used `~/.agent-control-panel` or `~/.coding-harness`. Rename that folder to `~/.agent-console`, or re-add workspaces in Settings.

## Development

```bash
npm run dev
cd backend && npm run build
cd frontend && npm run build
```

## License

MIT — see [LICENSE](./LICENSE).
