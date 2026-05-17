# Agent Control Panel

Local browser UI that wraps Claude Code CLI. No auth, no database — YAML + markdown files on disk.

## Stack
- **Backend**: Node.js + TypeScript + Express + ws (port 3001)
- **Frontend**: React + Vite + Tailwind + Zustand (port 3000)
- Vite proxies `/api` and `/ws` → backend

## Data
All data lives in `~/.agent-control-panel/` (see `backend/src/config.ts` for paths).

## Dev
```bash
npm run dev          # starts backend + frontend concurrently
npm run dev:backend  # backend only
npm run dev:frontend # frontend only
```

## Key constraints
- No database — YAML + markdown only
- No auth — localhost only
- Claude CLI (`claude`) must be in PATH and authenticated
- Skills are read-only from `~/.claude/agents/`
