---
paths:
  - "frontend/**"
---

# Frontend rules

- React 18 + Zustand (`frontend/src/store/useStore.ts`); API client in `frontend/src/api/client.ts`.
- Styling: Tailwind utility classes + existing CSS in `frontend/src/index.css`; match density/theme tokens.
- Workspace views: `WorkspaceViewId` in `types.ts`; add cases in `Workspace.tsx` `ViewContent`.
- Opening a task: `openTaskTab(taskId)` — each task gets a closable workspace tab (`view: 'task'`).
- Do not fetch outside `api/client.ts` helpers unless adding a new endpoint there first.
- Modals: follow existing `modal-backdrop` / `modal` patterns in kanban and views folders.
