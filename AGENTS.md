# Agent Console — instructions for coding agents

Local browser UI for **workspace visibility and control** when running coding agents (Claude Code CLI). Kanban tasks, agents, skills, workflows, PRD/goals — file-based only (no database, no auth).

## Repository layout

```
agent-console/
├── backend/          Express + WebSocket API (port 3001)
├── frontend/         React + Vite + Zustand (port 3000)
├── templates/        Bundled agents/skills (copied via Settings → Setup workspace)
├── .claude/          Example workflows + path rules (not user runtime data)
├── plan.md           Product plan
└── CLAUDE.md         Claude Code overrides (@imports this file)
```

## Commands

```bash
npm run install:all
npm run dev
```

**Prerequisites:** Node 18+, `claude` on PATH and authenticated.

## Architecture

| Layer | Role |
|-------|------|
| Frontend | Workspace tabs, kanban, task tabs, Planning/Goals, settings |
| Backend | REST + WS; `claude` / slash commands; workspace `.claude/` I/O |
| Data | `~/.agent-console/config.json` + per-workspace `.claude/*` |

## Coding standards

- TypeScript strict; minimal diffs; match existing style.
- No database; no auth; localhost only.
- Paths via `getPathSettings()`, `resolveWorkspacePath()`, `expandHome()` in `backend/src/config.ts`.
- Skills at runtime: **Skill tool** (`buildSkillInvocationPrompt`), not pasted SKILL.md.

## Do not

- Commit secrets or local `.claude/tasks/`, `settings.json`.
- Overwrite workspace files on setup (skip-if-exists only).
