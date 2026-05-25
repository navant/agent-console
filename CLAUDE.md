# Claude Code — Coding Harness

@AGENTS.md

## Claude-specific

- Use the **Skill** tool for task-configured skills (`buildSkillInvocationPrompt` in `backend/src/services/fileStore.ts`).
- **Goals tasks** run via PTY slash: `/goal goals/<file>.md` (`goalsStore.ts` + `ptyRunner.ts`).
- **Planning tasks** inject PRD markdown at run time (`getPrdContent` in `taskRunner.ts`).

## Quick commands

```bash
npm run dev
cd backend && npm run dev
cd frontend && npm run dev
```

## Where to look

| Topic | File(s) |
|-------|---------|
| Paths & defaults | `backend/src/config.ts` |
| Task execution | `backend/src/services/taskRunner.ts`, `ralphRunner.ts` |
| Setup templates | `backend/src/services/setupStore.ts`, `POST /api/config/setup` |
| Roadmap | `plan.md`, `README.md` |

## Constraints

- No database; no auth.
- `claude` on PATH for runs.
- Path-scoped rules: `.claude/rules/`.
