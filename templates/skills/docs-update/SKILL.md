---
name: docs-update
description: "Update documentation based on recent code changes. Lightweight doc sync after commits. Triggers on: update docs, sync docs, /docs-update."
---

# Docs Update

Update documentation based on recent code changes. Syncs wiki with current codebase state.

---

## The Job

1. **Detect Changes** - What files changed recently
2. **Identify Doc Impact** - Which docs need updates
3. **Update All Affected Docs** - Schemas, interfaces, features, flows, architecture

**Important:** This is targeted updates. For new features, use `/prd` which includes exploration and generates full feature documentation.

---

## Step 1: Detect Changes

```bash
# Get recent changes (last commit or since branch diverged)
git diff --name-only HEAD~1..HEAD
git log -1 --pretty=format:"%s"

# Or for full branch changes
git diff --name-only main..HEAD
```

### Categorize Changes:

| Change Type | File Patterns | Docs to Update |
|-------------|---------------|----------------|
| Migration | `migrations/*.sql` | schemas.md |
| API/Routes | `server/features/**/*.ts` | interfaces.md |
| Components | `features/**/components/**` | architecture.md, file-flow.md |
| Services | `features/**/services/**` | data-flow.md, interfaces.md |
| New Feature Dir | `features/*/` | features.md, all wiki files |
| Contexts/State | `**/contexts/**`, `**/hooks/**` | data-flow.md, react-typescript.md |
| Types | `**/types/**`, `**/*.types.ts` | schemas.md |

---

## Step 2: Update Documentation

### For Schema Changes (migrations)

1. Query current schema via Supabase MCP:
   ```
   mcp__supabase__list_tables
   mcp__supabase__execute_sql for details
   ```
2. Update `wiki/schemas.md`:
   - New/changed tables
   - Column definitions
   - Relationships
   - RLS policies

### For API Changes (server routes)

1. Find new/changed endpoints in `server/features/`
2. Update `wiki/interfaces.md`:
   - Endpoint paths
   - Request/response formats
   - Authentication requirements
   - Error responses

### For Feature Changes

1. Update `wiki/features.md`:
   - Feature list
   - Feature capabilities
   - User workflows

2. Update `wiki/file-flow.md`:
   - File responsibilities
   - Component hierarchy
   - Import relationships

### For Data Flow Changes

1. Update `wiki/data-flow.md`:
   - State management patterns
   - Data fetching flows
   - Context providers
   - Hook dependencies

### For Architecture Changes

1. Update `wiki/architecture.md`:
   - System components
   - Integration points
   - Design patterns used

### For React/TypeScript Patterns

1. Update `wiki/react-typescript.md`:
   - New hooks
   - Component patterns
   - Type patterns

---

## Step 3: Feature-Specific Wiki

If changes are in a specific feature directory, also update:

```
wiki/{FEATURE_NAME}/
├── architecture.md      - Feature architecture
├── interfaces.md        - Feature APIs
├── schemas.md           - Feature data models
├── integrations.md      - External integrations
├── react-typescript.md  - React patterns used
├── file-flow.md         - File responsibilities
├── data-flow.md         - Data flow in feature
├── features.md          - Feature capabilities
└── contributing.md      - How to extend
```

---

## Step 4: Update Checklist

Generate and verify:

```markdown
## Documentation Update Report

### Changes Detected
- [x] Migrations: [list files]
- [x] API routes: [list files]
- [x] Components: [list files]
- [x] Services: [list files]

### Documentation Updated

#### Core Wiki
- [ ] wiki/schemas.md - [tables added/changed]
- [ ] wiki/interfaces.md - [endpoints added/changed]
- [ ] wiki/features.md - [features added/changed]
- [ ] wiki/data-flow.md - [flows updated]
- [ ] wiki/file-flow.md - [files documented]
- [ ] wiki/architecture.md - [patterns documented]
- [ ] wiki/react-typescript.md - [patterns documented]

#### Feature Wiki (if applicable)
- [ ] wiki/{feature}/schemas.md
- [ ] wiki/{feature}/interfaces.md
- [ ] wiki/{feature}/data-flow.md
- [ ] wiki/{feature}/file-flow.md
- [ ] wiki/{feature}/features.md

### Verification
- [ ] All new tables documented
- [ ] All new endpoints documented
- [ ] All new features listed
- [ ] Data flows accurate
- [ ] File responsibilities clear
```

---

## When to Skip

Skip specific updates if:
- Only test files changed → skip all
- Only config/env files → skip all
- Only formatting/linting → skip all
- README already updated in commit → skip features.md
- No schema changes → skip schemas.md
- No API changes → skip interfaces.md

---

## Wiki File Reference

| File | What It Documents |
|------|-------------------|
| `schemas.md` | Database tables, columns, types, RLS |
| `interfaces.md` | API endpoints, request/response formats |
| `features.md` | Feature list, capabilities, workflows |
| `data-flow.md` | State management, data fetching, contexts |
| `file-flow.md` | File responsibilities, component hierarchy |
| `architecture.md` | System design, integration points |
| `react-typescript.md` | Hooks, components, type patterns |
| `integrations.md` | External services, third-party APIs |
| `contributing.md` | How to extend the feature |

---

## Integration

**Trigger methods:**
1. Manual: `/docs-update` after coding session
2. After commit: Run when committing changes
3. After PR merge: Ensure docs are current

**Relationship to other skills:**
- `/prd` explores wiki/codebase and generates PRD with context
- `/docs-update` keeps wiki current after code changes
