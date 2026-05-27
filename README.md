# Agent Console

A local browser UI for **visibility and control** when running coding agents (Claude Code CLI). Kanban tasks, agents, skills, workflows, PRDs, and goals — all file-based. No database, no cloud auth.

## What it does

- **Workspaces** — Register project folders; switch the active workspace from the sidebar.
- **Kanban tasks** — Todo → Running → Review → Done; drag-and-drop; optional auto-queue for **planned** tasks only.
- **Three ways to run a task**
  - **Single shot** (built-in) — one headless `claude` run per task.
  - **Ralph loop** (built-in) — iterates user stories from the task’s `prd.json` until done or max iterations.
  - **Archon** (optional) — workflows from `archon workflow list` when the [Archon](https://github.com/coleam00/Archon) CLI is installed.
- **Task tabs** — Task detail, comments thread, progress log, embedded chat.
- **Agents & skills** — Global (`~/.claude/agents`) and workspace `.claude/` personas; skills invoked via the **Skill tool**, not pasted into prompts.
- **Planning (PRD)** — Markdown library in `.claude/prd/`; expand with PRD skill; **Implement as task** (no auto-run).
- **Goals** — Goal markdown; tasks can run `/goal goals/…` via PTY slash command.
- **Memory** — CodeGraph index + claude-mem bridge; files live under `.claude/` for **MCP/tools only** (not inlined into task or chat prompts).
- **Workflows tab** — List built-in + Archon + workspace workflows; **Setup workflow in this workspace** copies Ralph scripts and scaffolds Archon when available.
- **Settings** — Paths, task types, workspace template copy (skip-if-exists).

## Quick start

```bash
git clone git@github.com:navant/agent-console.git
cd agent-console
npm run install:all
npm run dev
```

Open **http://localhost:3000** (API **http://localhost:3001**).

1. Add a **workspace** (your project path).
2. **Settings → Setup workspace** — copies bundled agents/skills into `.claude/` (never overwrites existing files).
3. Optional: **Memory → Setup workspace memory** — claude-mem SessionEnd hook → `.claude/MEMORY.md`; **Refresh summaries** for CodeGraph + MEMORY.
4. Optional: **Workflows → Setup workflow in this workspace** — `scripts/ralph/`, `ralph-loop` workflow, Archon scaffold when CLI is present.
5. Create tasks, pick workflow (single-shot / Ralph / Archon), **Run**.

**Requires:** Node 18+, [Claude Code CLI](https://code.claude.com) (`claude`) on PATH and authenticated (`claude` then `/login`).

## Task lifecycle

| Status | Meaning |
|--------|---------|
| `todo` / `planned` | Ready; auto-queue picks **`planned`** only (not fresh `todo`). |
| `running` | Agent run in progress. |
| `review` | Run finished with output or tools; human checks and moves to Done. |
| `done` / `archive` | Closed. |

Short text-only replies (e.g. “print hello”) count as completion and move to **Review**, not back to Todo. Failures and empty runs stay in Todo or go to Review with a system note.

## Memory (tools only)

Memory is **not** pasted into kanban prompts or chat messages. Agents should use:

- **CodeGraph MCP** — search/index the repo (setup writes `.claude/codegraph-summary.md` for the Memory UI).
- **claude-mem** — worker + MCP; SessionEnd hook syncs `.claude/MEMORY.md`.
- **Read** / **Skill** — `.claude/memory.md` (manual), agent memory files.

Headless task runs use `--setting-sources user,project` with `cwd` set to the active workspace so `.claude/skills` (e.g. `prd`, `ralph`) resolve via the Skill tool. SessionEnd hooks skip when `AGENT_CONSOLE_HEADLESS=1` is set on the child process.

## Architecture

```
┌─────────────┐     REST /api      ┌──────────────┐     spawn      ┌─────────────┐
│  React UI   │ ◄──────────────► │ Express :3001│ ─────────────► │ claude CLI  │
│  :3000      │     WebSocket /ws  │  + services  │   archon / PTY │  (headless) │
└─────────────┘                    └──────────────┘                └─────────────┘
                                          │
                                          ▼
                    ~/.agent-console/config.json
                    <workspace>/.claude/{agents,skills,tasks,prd,goals,...}
```

| Package | Tech |
|---------|------|
| `frontend/` | React, Vite, Zustand |
| `backend/` | Node, TypeScript, Express, `ws` |

Key backend modules: `taskRunner.ts`, `taskPrompt.ts`, `workflowStore.ts`, `ralphRunner.ts`, `archonRunner.ts`, `memorySetupStore.ts`, `claudeRunner.ts`.

## Data on disk

### App config (`~/.agent-console/`)

- `config.json` — workspaces, active workspace, path settings, memory tier

### Per workspace (default `<workspace>/.claude/`)

| Path | Contents |
|------|----------|
| `agents/*.md` | Agent personas |
| `skills/<id>/SKILL.md` | Skills |
| `workflows/<id>/WORKFLOW.md` | Workflow templates (`{{prompt}}` only — no `{{memory}}`) |
| `tasks/<id>/` | Task config, prompt, plan (`prd.json`), progress, comments |
| `prd/*.md` | Planning docs |
| `goals/*.md` | Goal docs |
| `hooks/sync-memory.sh` | claude-mem → MEMORY.md (from template after memory setup) |
| `MEMORY.md` | claude-mem digest (auto-generated) |
| `codegraph-summary.md` | CodeGraph refresh output (UI + tools) |
| `memory.md` | Manual notes (optional) |

Bundled starters: `templates/` (agents, skills, ralph, hooks, workflows).

## Recent changes (summary)

- Removed legacy Symphony/orchestrator and PRD plan/spawn modals.
- Built-in **single-shot** + **ralph-loop** + dynamic **Archon** workflow list.
- Workspace setup for Ralph + Archon + memory bridge (streamed progress in UI).
- Task prompts: task + PRD + skills + comments only; `stripMemoryFromPrompt()` for old workflows.
- claude-mem sync hook fixes (CLI fallback when 0 obs, temps in `$TMPDIR`, orphan cleanup).
- Headless auth fix (removed `--bare`; `--setting-sources user`).
- Quieter task comments (no “Run started” spam); auto-queue **planned** only; failures → **review** not retry loop.

## Documentation

| File | Purpose |
|------|---------|
| [AGENTS.md](./AGENTS.md) | Instructions for coding agents |
| [CLAUDE.md](./CLAUDE.md) | Claude Code specifics |
| [templates/hooks/claude-mem-bridge/README.md](./templates/hooks/claude-mem-bridge/README.md) | Memory bridge setup |

## Migration

Older installs may have used `~/.agent-control-panel` or `~/.coding-harness`. Rename to `~/.agent-console`, or re-add workspaces in Settings. Re-run **Setup workspace memory** if `sync-memory.sh` is outdated.

## Development

```bash
npm run dev
cd backend && npm run build
cd frontend && npm run build
```

## License

MIT — see [LICENSE](./LICENSE).
