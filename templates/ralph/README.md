# Ralph loop (from [snarktank/ralph](https://github.com/snarktank/ralph))

Copied into your repo at `scripts/ralph/` by Agent Console **Setup workflow in this workspace**.

| File | Purpose |
|------|---------|
| `ralph.sh` | Bash loop — fresh Claude/Amp instance per story until `prd.json` is complete |
| `CLAUDE.md` | Prompt template for Claude Code |
| `prd.json` | User stories with `passes` status (create via `/ralph` skill or task plan) |
| `progress.txt` | Learnings between iterations |

```bash
./scripts/ralph/ralph.sh --tool claude 10
```

Agent Console can also run the **ralph-loop** workflow on kanban tasks with a generated plan (`prd.json` per task).
