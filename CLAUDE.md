# Claude Code — Agent Console

@AGENTS.md

## Claude-specific

- **Skill tool** for task skills (`buildSkillInvocationPrompt` in `fileStore.ts`).
- **Goals tasks:** PTY slash `/goal goals/<file>.md` (`goalsStore.ts`, `ptyRunner.ts`).
- **Planning tasks:** PRD markdown in prompt at run time (`taskRunner.ts` + `getPrdContent`).

## Commands

```bash
npm run dev
```

## Key files

| Topic | Path |
|-------|------|
| Config / paths | `backend/src/config.ts` |
| Task runs | `backend/src/services/taskRunner.ts` |
| Template setup | `backend/src/services/setupStore.ts` |
| UI state | `frontend/src/store/useStore.ts` |

Path-scoped rules: `.claude/rules/`.
