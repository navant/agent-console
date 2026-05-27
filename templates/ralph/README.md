# Ralph loop (from [snarktank/ralph](https://github.com/snarktank/ralph))

Copied into your repo at `scripts/ralph/` by Agent Console **Setup workflow in this workspace**.

| File | Purpose |
|------|---------|
| `ralph.sh` | Bash loop — fresh Claude/Amp instance per story until `prd.json` is complete |
| `CLAUDE.md` | Prompt template for Claude Code |
| `prd.json` | User stories for **this shell loop only** (create via `/ralph` skill) |
| `progress.txt` | Learnings between iterations |

```bash
./scripts/ralph/ralph.sh --tool claude 10
```

## Agent Console `ralph-loop` (separate from this folder)

In-app Ralph does **not** read `scripts/ralph/prd.json`. Each kanban task stores its plan at:

**`.claude/tasks/<taskId>/prd.json`** (default; see Settings → Paths → `tasks`).

Workflow: project task → **Generate plan** → workflow **Ralph loop** → **Run**. The app updates `passes` after each story; progress is `.claude/tasks/<taskId>/progress.txt`.
