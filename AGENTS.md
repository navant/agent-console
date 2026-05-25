# Coding Harness — instructions for coding agents

Local-first control panel for **Claude Code CLI**. Manages workspaces, kanban tasks, agents, skills, workflows, PRDs, and goals — all persisted as files on disk (no database, no auth).

## Repository layout

```
coding-harness/
├── backend/          Express + WebSocket API (port 3001)
├── frontend/         React + Vite + Zustand (port 3000, proxies /api and /ws)
├── templates/        Bundled agents, skills, PRD/goals templates (copied via Setup)
├── .claude/          Example workflows + path rules (not user workspace data)
├── plan.md           Product / architecture plan
└── CLAUDE.md         Claude Code–specific overrides (imports this file)
```

## Commands

```bash
npm run install:all
npm run dev
npm run dev:backend
npm run dev:frontend
```

**Prerequisites:** Node 18+, `claude` CLI on PATH and authenticated.

## Architecture (short)

| Layer | Role |
|-------|------|
| **Frontend** | Workspace tabs, kanban, task detail tabs, Goals/Planning views, settings |
| **Backend** | REST + WS; spawns `claude` / PTY slash commands; reads/writes workspace `.claude/` |
| **Data** | `~/.coding-harness/config.json`; per-workspace `.claude/*` |

## Coding standards

- **TypeScript** strict in backend and frontend; match existing patterns.
- **Minimal diffs** — no unrelated refactors.
- **No database** — YAML/JSON/markdown on disk only.
- **No auth** — localhost only.
- **Paths** — use `getPathSettings()`, `resolveWorkspacePath()`, `expandHome()` from `backend/src/config.ts`.
- **Skills at runtime** — **Skill tool** via `buildSkillInvocationPrompt`, not pasted SKILL.md.

## Data locations

| What | Where |
|------|--------|
| App config | `~/.coding-harness/config.json` |
| Workspace data | `<workspace>/.claude/` (configurable in Settings) |
| Global agents/skills | `~/.claude/agents`, `~/.claude/skills` (defaults) |
| Bundled templates | `templates/agents`, `templates/skills` |

## Do not

- Commit secrets, local `.claude/tasks/`, or machine-specific `settings.json`.
- Overwrite user workspace files during setup (skip-if-exists only).
