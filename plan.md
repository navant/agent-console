# Agent Control Panel v2 — Final Plan

## Core Concepts

| Concept | Description | On disk |
|---------|-------------|---------|
| **Workspace** | Project folder — all tasks/agents/workflows scoped here | registered path |
| **Agent** | Persona: soul.md (system prompt), model, tools, memory.md | `~/.claude/agents/<id>.md` or `<ws>/.claude/agents/<id>.md` |
| **Skill** | Reusable prompt component, read-only from disk | `~/.claude/skills/<id>/SKILL.md` or `<ws>/.claude/skills/<id>/SKILL.md` |
| **Workflow** | Execution policy: single-shot or ralph-loop, with prompt template | `<ws>/.claude/workflows/<id>/WORKFLOW.md` |
| **Task** | Work item on the kanban board, belongs to one workspace | `<ws>/.claude/tasks/<id>/task.json` |
| **Plan** | User stories for a task (ralph prd.json format) | `<ws>/.claude/tasks/<id>/prd.json` |
| **Memory** | Persistent context injected into every run | `<ws>/.claude/memory.md` (workspace) + `<agent-dir>/memory.md` (per-agent) |

---

## File System Layout

```
~/.claude/
  agents/               global agents, available in every workspace
    coder.md
  skills/               global skills
    ralph/SKILL.md
    prd/SKILL.md

~/.agent-control-panel/
  config.json           { activeWorkspace, registeredWorkspaces[] }

<workspace>/
  .claude/
    agents/             workspace-local agents (supplement global)
    skills/             workspace-local skills
    workflows/
      ralph-loop/WORKFLOW.md
      single-shot/WORKFLOW.md
    tasks/
      <task-id>/
        task.json       { id, title, agent, workflow, status, type, skills[], session_id, createdAt }
        prompt.md       simple tasks only
        prd.json        project tasks — user stories
        progress.txt    append-only execution log
    memory.md           workspace-level memory (injected into all runs)
```

### Agent file (`<id>.md`)

```markdown
---
name: Senior Dev
model: claude-sonnet-4-6
tools: [bash, read, edit, write]
memory: true
---
You are a senior software engineer...
```

Agent memory lives at `<same-dir>/<id>.memory.md` (auto-created, auto-updated after runs).

### WORKFLOW.md

```yaml
---
name: ralph-loop
type: loop          # loop | single
max_iterations: 20
commit_on_story: true
---
You are working on story {{story.id}}: {{story.title}}.
{{story.description}}

Acceptance criteria:
{{#each story.acceptanceCriteria}}- {{this}}
{{/each}}

Workspace memory:
{{memory}}
```

---

## UI Layout

```
┌──────────────┬──────────────────────────────────────────────────────┐
│   Sidebar    │  Kanban board (per active workspace)                 │
│              │  ┌────────┬─────────┬─────────┬──────────┐          │
│ ▾ MyProject  │  │  Todo  │ Running │ Review  │   Done   │          │
│   workspace▾ │  │        │  ████░  │         │          │          │
│              │  │ +Task  │         │         │          │          │
│ ▸ Memory     │  └────────┴─────────┴─────────┴──────────┘          │
│ ▸ PRD        │                                                      │
│ ▸ Agents     │  ────────────────────────────────────────────────    │
│ ▸ Skills     │                                                      │
│ ▸ Workflows  │  Chat / Sessions / Terminal  (unchanged)             │
│ ▸ Tasks      │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

### Sidebar sections (collapsible)

| Section | Contents |
|---------|----------|
| **Workspace** | Dropdown of registered paths + "Add workspace…" |
| **Memory** | workspace memory.md editor + list of agent memory.md files |
| **PRD** | Opens prd.json of the currently selected task in the kanban |
| **Agents** | Global + workspace agents. Create → pick global or workspace-local |
| **Skills** | All skills from disk. Click to preview SKILL.md. Checkbox = selected for next task |
| **Workflows** | Workflow list. Create/edit WORKFLOW.md |
| **Tasks** | Compact list mirroring kanban; click to select/focus |

---

## Task Creation Flow

### Step 1 — Create Task
- Title, description
- Agent (select from global + workspace agents)
- Workflow (select: single-shot / ralph-loop / custom)
- Skills (checkboxes — all loaded skills shown)
- Type auto-set: "project" if workflow is loop, "simple" if workflow is single

### Step 2 — Create Plan (project tasks only, or manually triggered)
Opens as a second screen or slide-over after task creation.

**Left**: story list (drag to reorder, add/delete)
**Right**: story editor (title, description, acceptance criteria)

**"Generate with AI" button**: sends description to claude, gets back a prd.json draft,
populates the editor. User reviews and saves.

Task status becomes "planned" once prd.json is saved.

---

## Execution

### Simple task
```
claude -p <prompt.md contents>
  --output-format stream-json --verbose
  --dangerously-skip-permissions
  --add-dir <workspace>
  [--resume <session_id>]
  [--append-system-prompt-file <soul.md>]
  [skill contents prepended to prompt]
  [workspace memory.md + agent memory.md prepended]
```

### Project task — ralph loop (`ralphRunner.ts`)
```
for each story in prd.json where passes: false, sorted by priority:
  1. Render WORKFLOW.md template → story + memory context → full prompt
  2. Prepend selected skills
  3. claude -p <prompt> --output-format stream-json --verbose --dangerously-skip-permissions
             --add-dir <workspace> [--resume <session_id>] [--append-system-prompt-file <soul.md>]
  4. Stream → WebSocket → UI
  5. Success → passes=true, append progress.txt, git commit if workflow.commit_on_story
  6. Failure → log progress.txt, task → "review", stop loop
  7. All done → task → "done"
  8. After run → update agent memory.md with learnings
```

---

## Backend Routes

| Route | Description |
|-------|-------------|
| `GET /api/config` | Active workspace + settings |
| `POST /api/config/workspace` | Switch active workspace |
| `GET /api/workspaces` | Registered workspaces list |
| `POST /api/workspaces` | Register path |
| `DELETE /api/workspaces/:id` | Unregister |
| `GET /api/agents` | Global + workspace agents (with source flag) |
| `POST /api/agents` | Create .md in global or workspace dir |
| `PUT /api/agents/:id` | Update .md |
| `DELETE /api/agents/:id` | Delete .md |
| `GET /api/skills` | All skills from global + workspace |
| `GET /api/workflows` | All workflows from workspace |
| `POST /api/workflows` | Create WORKFLOW.md |
| `PUT /api/workflows/:id` | Update WORKFLOW.md |
| `GET /api/tasks` | All tasks in active workspace |
| `POST /api/tasks` | Create task folder + task.json |
| `PUT /api/tasks/:id` | Update task.json (status, agent, etc.) |
| `DELETE /api/tasks/:id` | Remove task folder |
| `GET /api/tasks/:id/plan` | Get prd.json |
| `PUT /api/tasks/:id/plan` | Save prd.json |
| `POST /api/tasks/:id/plan/generate` | AI-generate prd.json from description |
| `GET /api/tasks/:id/progress` | Get progress.txt |
| `GET /api/memory` | Get workspace + all agent memory files |
| `PUT /api/memory/workspace` | Save workspace memory.md |
| `PUT /api/memory/agent/:agentId` | Save agent memory.md |
| `GET /api/sessions` | Unchanged |

### WebSocket
- `run_task` — start (simple or ralph-loop based on task.type)
- `stop` — stop active run
- `chat` — unchanged
- `task_update` — broadcast on status change
- `progress_append` — broadcast each progress.txt line (live streaming)

---

## Frontend Changes

### New components
- `WorkspaceSelector` — sidebar top dropdown
- `SidebarSection` — collapsible section wrapper
- `MemorySection` — workspace + agent memory.md editors
- `PRDSection` — shows prd.json of selected task (read from active task)
- `AgentsSection` — list + create/edit with global/workspace choice
- `SkillsSection` — list all, preview SKILL.md on click, checkbox selection
- `WorkflowsSection` — list + create/edit WORKFLOW.md
- `TasksSection` — compact task list
- `CreateTaskModal` — step 1: title, agent, workflow, skills
- `PlanEditor` — step 2: user stories CRUD + AI generate button
- `WorkflowModal` — YAML frontmatter + prompt template editor
- `TaskCard` — story progress bar, workflow badge, run/stop button inline
- `TaskDetail` — side panel: stories with pass/fail, live progress.txt

### Changed
- `Sidebar` — rebuilt with 7 collapsible sections
- `KanbanBoard` — reads from workspace tasks; new TaskCard
- `ChatPanel` — unchanged

### Store
```typescript
activeWorkspace: string | null
workspaces: { id, name, path }[]
agents: AgentConfig[]          // adds source: 'global' | 'workspace'
skills: SkillConfig[]          // adds content: string (SKILL.md body)
workflows: WorkflowConfig[]
tasks: TaskConfig[]            // new shape (folder-based)
selectedTaskId: string | null  // for PRD sidebar section
// chat/messages/terminal — unchanged
```

---

## Build Phases

### Phase 1 — Workspace + data scanning
- `config.json` persists active workspace + registered workspaces
- Backend scans on switch: agents, skills, workflows, tasks from paths
- WorkspaceSelector in sidebar
- Store loads all workspace data on switch

### Phase 2 — Sidebar sections (Agents, Skills, Workflows, Memory)
- Agent CRUD (.md files), global vs workspace choice
- Skills read from disk, preview markdown, checkbox state
- Workflow CRUD (WORKFLOW.md files)
- Memory editors (workspace.md + agent memory.md)

### Phase 3 — Task + Plan
- Task creation (step 1 modal)
- PlanEditor (step 2) with manual + AI-generate
- Kanban from workspace tasks dir
- PRD sidebar section = selected task's prd.json

### Phase 4 — Execution
- `ralphRunner.ts`: loop, template rendering, progress.txt streaming
- Simple task: existing runClaude path
- Memory injection + post-run memory update

---

## What Stays Unchanged
- Express + WebSocket infra
- `claudeRunner.ts`, `ptyRunner.ts`
- Terminal panel + Chat panel + Sessions browser
- React/Vite/Zustand + all CSS/design tokens

## What Gets Rewritten
- File store (workspace-scoped, .md-based)
- All API routes (new structure)
- Sidebar (7-section layout)
- Task model (folder-per-task + plan step)
- `ralphRunner.ts` (new)
- Workflow template renderer (new)

---

## Memory System (expanded)

Three tiers, user picks per workspace:

### Tier 1 — Simple (default)
Flat `<workspace>/.claude/memory.md` + `<agent-dir>/<id>.memory.md`.
Prepended to every claude run. User edits manually or agent appends via hook.

### Tier 2 — Wiki (Karpathy-style)
LLM incrementally builds and maintains a structured markdown wiki.

```
<workspace>/.claude/wiki/
  index.md          one-line summary per topic (searchable catalog)
  log.md            append-only chronological record
  auth.md           topic pages (cross-referenced)
  database.md
  api-patterns.md
```

**Ingest flow**: after each task run, agent is prompted to update relevant wiki pages with learnings.
**Query flow**: before each run, relevant pages are retrieved from index.md and included in context.
**UI**: Memory sidebar shows wiki file tree, click to view/edit any page, "Update Wiki" button triggers LLM ingest pass.

### Tier 3 — claude-mem (external)
Connects to [claude-mem](https://github.com/thedotmack/claude-mem) if installed.
SQLite + Chroma vector DB, semantic search, 5 lifecycle hooks auto-capture everything.

**Integration**: backend checks if claude-mem is available (`which claude-mem`). If yes, shows as option.
At run time, relevant memories are fetched via `claude-mem search <query>` and injected into prompt.
Post-run, memories are written back via claude-mem hooks.

### Memory sidebar UI
```
▸ Memory
  [Simple ●] [Wiki] [claude-mem]   ← tier selector per workspace

  Simple mode:
    [workspace memory.md editor]
    Agents:
      ○ coder — last updated 2 days ago [edit]
      ○ reviewer — (empty) [edit]

  Wiki mode:
    index.md  log.md  auth.md  db.md  ...
    [file tree, click to open in editor]
    [↺ Update Wiki]  runs a post-processing ingest pass

  claude-mem mode:
    Status: ● connected  (or ✗ not installed — install guide)
    Recent memories: [list of last 5 compressed summaries]
    [Search memories...]
```
