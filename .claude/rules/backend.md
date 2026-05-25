---
paths:
  - "backend/**"
---

# Backend rules

- Express routers in `backend/src/routes/`; business logic in `backend/src/services/`.
- Use `getActiveWorkspace()` for workspace-scoped APIs; return 400 if no active workspace.
- File I/O: `ensureDir`, `readFile`, `writeFile` from `fileStore.ts`; expand paths with `expandHome`.
- WebSocket message types: `backend/src/types.ts` — keep frontend `types.ts` in sync when adding WS events.
- Task status updates must go through `saveTask` and broadcast `task_update` where other runners do.
- New REST routes: register in `backend/src/index.ts` under `/api/...`.
- Prefer async/await; avoid adding heavy dependencies — stack is Express + ws + fs + yaml.
