# claude-mem → workspace bridge

A small Claude Code hook that pulls relevant memories from **claude-mem**
(global, session-aware) and writes a curated digest into your repo at
`.claude/MEMORY.md`. The digest is auto-loaded into every future session via
an `@`-import in `CLAUDE.md`, so past decisions and lessons are in context
from turn 1 — and because the file lives in your repo, it travels with the
code and benefits your whole team.

```
┌──────────────────────┐                     ┌──────────────────────┐
│  claude-mem worker   │◄──── searches ──────│  sync-memory.sh      │
│  (global, ~/.claude- │                     │  (SessionEnd hook)   │
│   mem/, vector DB)   │                     │                      │
└──────────────────────┘                     └──────────┬───────────┘
                                                        │ writes
                                                        ▼
                                            ┌───────────────────────┐
                                            │ .claude/MEMORY.md     │
                                            │  (in your repo,       │
                                            │   regenerated each    │
                                            │   session)            │
                                            └───────────┬───────────┘
                                                        │ @-imported by
                                                        ▼
                                            ┌───────────────────────┐
                                            │ CLAUDE.md             │
                                            │  (auto-loaded by      │
                                            │   Claude Code at      │
                                            │   every session)      │
                                            └───────────────────────┘
```

---

## What's in this bundle

```
.claude/
├── settings.json              # registers the SessionEnd hook
└── hooks/
    └── sync-memory.sh         # the bridge script

CLAUDE.md.snippet              # what to add to your repo's CLAUDE.md
README.md                      # this file
```

---

## Prerequisites

- **Claude Code** installed and working (`claude` on your PATH)
- **claude-mem** installed and its worker running on `localhost:37777`
  ```bash
  npx claude-mem install
  ```
- **jq** for parsing the hook payload
  ```bash
  # macOS
  brew install jq
  # Debian/Ubuntu
  sudo apt install jq
  # Windows
  winget install jqlang.jq
  ```

---

## Install (3 steps)

### 1. Drop the files into your project

From the root of your project (where your code lives):

```bash
# Copy the .claude/ folder from this bundle into your project root
cp -r path/to/this/bundle/.claude .
chmod +x .claude/hooks/sync-memory.sh
```

If you already have a `.claude/` folder with a `settings.json`, **merge**
the `hooks` block from this bundle's `settings.json` into yours — don't
overwrite the whole file.

### 2. Add the import to your `CLAUDE.md`

Open (or create) `CLAUDE.md` at the root of your project and append the
contents of `CLAUDE.md.snippet`:

```markdown
## Lessons from past sessions

@.claude/MEMORY.md
```

That `@.claude/MEMORY.md` line is the part that does the work — Claude Code
inlines the referenced file into context at every session start.

### 3. Restart Claude Code

Hooks are loaded at session start, so restart any open Claude Code sessions
in this project.

---

## How it works

1. You work in Claude Code as usual. claude-mem captures observations from
   the session into its own global database (it does this regardless of
   this bridge — it's claude-mem's normal behavior).
2. When the session ends, Claude Code fires the `SessionEnd` hook, which
   runs `.claude/hooks/sync-memory.sh`.
3. The script invokes `claude -p` in headless mode with a curation prompt
   that asks it to use claude-mem's MCP tools (`search`, `timeline`,
   `get_observations`) to pull the highest-signal entries for this project.
4. The output is written atomically to `.claude/MEMORY.md`, replacing the
   previous version. No appending, no bloat.
5. On your next session, Claude Code loads `CLAUDE.md`, which `@`-imports
   `MEMORY.md` — so Claude starts the session already aware of every
   durable lesson, decision, and gotcha from past work.

---

## Verify it works

After installing, run a quick test session:

```bash
cd your-project
claude
# do something memorable — fix a bug, make an architectural call, etc.
# exit Claude Code (Ctrl+D or /exit)
```

Then check the output:

```bash
cat .claude/MEMORY.md
```

You should see a curated markdown digest. If the file is empty or shows
"_No durable lessons captured yet_", that's expected on the first run or
two — claude-mem needs a few sessions of activity before it has enough to
surface anything durable.

---

## Commit or gitignore?

Your call. Two reasonable defaults:

- **Commit `MEMORY.md`** if your team should benefit from accumulated
  lessons. New team members pull the repo and inherit context from day one.
- **Gitignore `MEMORY.md`** if memories are personal/noisy and you'd rather
  not impose them on the team.

Either way, you should **commit** `.claude/settings.json`,
`.claude/hooks/sync-memory.sh`, and `CLAUDE.md` so the mechanism itself is
shared.

Suggested `.gitignore` line if you want personal memory only:

```gitignore
.claude/MEMORY.md
```

---

## Customization

### Change the curation rules

The prompt that decides what makes it into the digest lives in the
heredoc inside `sync-memory.sh`. Tighten the rules to reduce noise, loosen
them to capture more. Examples:

- Cap at fewer entries: change `15 entries MAX` to `8 entries MAX`
- Bias toward specific types: replace the four bullets (Decisions, Lessons,
  Gotchas, Patterns) with just the ones you care about
- Add domain context: insert a line like _"This is a Next.js app with a
  Postgres backend — prioritize lessons about RSC boundaries and migrations."_

### Change when it runs

`SessionEnd` is the default. Alternatives, edited in `settings.json`:

- `SessionStart` — pull *before* the new session begins. Slower start, no
  cost on quit. Lags one session behind on capturing the latest lessons.
- Both `SessionStart` and `SessionEnd` — most aggressive, most token cost.
- A manual slash command — replace the hook with a custom command you
  invoke deliberately. Cheapest, but you have to remember to run it.

### Run it manually

The script works fine standalone — useful for testing:

```bash
echo '{"cwd": "'"$(pwd)"'"}' | .claude/hooks/sync-memory.sh
cat .claude/MEMORY.md
```

---

## Troubleshooting

**`MEMORY.md` never appears**
- Make sure the script is executable: `chmod +x .claude/hooks/sync-memory.sh`
- Confirm `claude` is on your PATH: `which claude`
- Confirm `jq` is installed: `which jq`
- Run the script manually (see "Run it manually" above) and watch stderr:
  remove the `2>/dev/null` from the `claude -p` line temporarily.

**`MEMORY.md` shows "No durable lessons captured yet"**
- claude-mem genuinely has nothing useful surfaced yet. Keep working in the
  project for a few sessions and run again.
- If it persists for a long time, check the curation prompt — the rules may
  be too strict for your usage patterns.

**The hook fires but nothing changes**
- Check that claude-mem's worker is running: `curl http://localhost:37777`
  should return something. If not: `npx claude-mem install` to repair.

**It's writing things I don't want**
- Use claude-mem's `<private>...</private>` tags during sessions to mark
  content as excluded from storage. The bridge can only surface what
  claude-mem has captured, so filtering upstream is the right layer.

---

## Caveats

- Each `SessionEnd` runs a headless `claude -p` call, which costs API
  tokens. Small per call, but it adds up if you open and close many short
  sessions. Switch to a manual slash command if cost matters.
- The bridge **regenerates** `MEMORY.md` every run. Don't hand-edit it —
  edits will be lost. To preserve a manual note permanently, put it in
  `CLAUDE.md` instead.
- Quality is bounded by what claude-mem captured. Garbage in, garbage out.
- This bundle has been written defensively but isn't battle-tested across
  every OS/shell combination. Read the script before running it — it's
  ~60 lines.

---

## License

Do whatever you want with this. No warranty.
