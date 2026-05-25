---
name: docs-create
description: "Create wiki documentation from scratch for a codebase. Full initial documentation generation. Triggers on: create wiki, generate docs, init wiki, /wiki-create."
---

# Wiki Create

Create comprehensive wiki documentation from scratch for a codebase. Generates all wiki files with proper structure and content based on codebase analysis.

---

## The Job

1. **Explore Codebase** - Understand project structure, patterns, and architecture
2. **Identify Documentation Needs** - What needs to be documented
3. **Generate All Wiki Files** - Create complete documentation set
4. **Verify Completeness** - Ensure all aspects are covered

**Important:** This is for initial wiki creation. For updating existing docs after code changes, use `/docs-update`.

---

## Step 1: Explore Codebase

### Project Structure Analysis

```bash
# Get project structure
tree -L 3 -d  # or use Glob to explore

# Identify key directories
ls -la src/ features/ server/ app/

# Check package.json for tech stack
cat package.json
```

### Key Areas to Explore

| Area       | What to Find          | Files to Check                           |
| ---------- | --------------------- | ---------------------------------------- |
| Tech Stack | Frameworks, libraries | `package.json`, config files             |
| Database   | Tables, schema        | `migrations/`, `supabase/`, `prisma/`    |
| API Layer  | Endpoints, routes     | `server/`, `api/`, `routes/`             |
| Features   | Feature modules       | `features/`, `modules/`, `src/`          |
| Components | UI components         | `components/`, `features/**/components/` |
| Services   | Business logic        | `services/`, `features/**/services/`     |
| State      | State management      | `contexts/`, `stores/`, `hooks/`         |
| Types      | Type definitions      | `types/`, `**/*.types.ts`, `**/*.d.ts`   |
| Config     | Configuration         | `.env.example`, config files             |

---

## Step 2: Create Wiki Structure

### Core Wiki Files

Create `wiki/` directory with these files:

```
wiki/
├── README.md            - Overview and navigation
├── architecture.md      - System design and patterns
├── schemas.md           - Database tables and relationships
├── interfaces.md        - API endpoints and contracts
├── features.md          - Feature list and capabilities
├── data-flow.md         - State management and data fetching
├── file-flow.md         - File responsibilities and hierarchy
├── react-typescript.md  - React/TypeScript patterns
├── integrations.md      - External services and APIs
└── contributing.md      - Development guidelines
```

### Feature-Specific Wiki (if modular)

For each major feature, create:

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

## Step 3: Generate Each Wiki File

### wiki/README.md

```markdown
# {Project Name} Wiki

## Overview

Brief description of the project, its purpose, and main capabilities.

## Quick Navigation

- [Architecture](./architecture.md) - System design
- [Schemas](./schemas.md) - Database structure
- [Interfaces](./interfaces.md) - API documentation
- [Features](./features.md) - Feature overview
- [Data Flow](./data-flow.md) - State and data management
- [File Flow](./file-flow.md) - Codebase organization
- [React/TypeScript](./react-typescript.md) - Code patterns
- [Integrations](./integrations.md) - External services
- [Contributing](./contributing.md) - Development guide

## Tech Stack

- Frontend: [framework]
- Backend: [framework]
- Database: [database]
- Auth: [auth provider]
- Other: [notable libraries]

## Getting Started

Link to setup instructions or include brief setup steps.
```

### wiki/architecture.md

Document:

- High-level system diagram (describe components)
- Frontend architecture (pages, features, shared)
- Backend architecture (routes, services, middleware)
- Database architecture (tables, relationships)
- Authentication flow
- Key design patterns used
- Integration points

### wiki/schemas.md

For each database table:

```markdown
## {table_name}

**Purpose:** What this table stores

| Column | Type | Nullable | Default           | Description |
| ------ | ---- | -------- | ----------------- | ----------- |
| id     | uuid | NO       | gen_random_uuid() | Primary key |
| ...    | ...  | ...      | ...               | ...         |

**Relationships:**

- References: `other_table(column)`
- Referenced by: `another_table(column)`

**RLS Policies:**

- Policy name: description

**Indexes:**

- index_name: columns
```

Query database using Supabase MCP if available:

```
mcp__supabase__list_tables
mcp__supabase__execute_sql
```

### wiki/interfaces.md

For each API endpoint:

````markdown
## {Feature Name} API

### {METHOD} /api/path

**Description:** What this endpoint does

**Authentication:** Required/Optional/None

**Request:**

```typescript
{
  param: type; // description
}
```
````

**Response:**

```typescript
{
  data: type; // description
}
```

**Errors:**
| Code | Message | Cause |
|------|---------|-------|
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid auth |

````

### wiki/features.md

```markdown
## Features Overview

### {Feature Name}

**Purpose:** What this feature does for users

**Key Capabilities:**
- Capability 1
- Capability 2

**User Workflows:**
1. User does X
2. System responds with Y
3. Result is Z

**Related Files:**
- `path/to/main/file.tsx`
- `path/to/service.ts`
````

### wiki/data-flow.md

Document:

- State management approach (Context, Redux, Zustand, etc.)
- Data fetching patterns (React Query, SWR, custom hooks)
- Context providers and their responsibilities
- Key hooks and their data flow
- Caching strategies
- Real-time updates (if any)

### wiki/file-flow.md

```markdown
## Directory Structure
```

src/
├── features/ # Feature modules
│ └── {feature}/
│ ├── components/ # Feature-specific components
│ ├── services/ # API calls and business logic
│ ├── hooks/ # Feature hooks
│ ├── types/ # Feature types
│ └── index.ts # Feature exports
├── components/ # Shared components
├── hooks/ # Shared hooks
├── contexts/ # Global contexts
├── services/ # Shared services
├── types/ # Global types
└── utils/ # Utility functions

```

## File Responsibilities

### {directory/file}
- **Purpose:** What it does
- **Exports:** What it exports
- **Depends on:** What it imports
- **Used by:** What uses it
```

### wiki/react-typescript.md

Document:

- Component patterns (functional, compound, etc.)
- Custom hooks and their usage
- Type patterns (generics, utility types)
- Form handling patterns
- Error boundary usage
- Performance patterns (memo, useMemo, useCallback)
- Testing patterns

### wiki/integrations.md

For each external service:

```markdown
## {Service Name}

**Purpose:** What this integration does

**Configuration:**

- Environment variables needed
- Setup requirements

**Usage:**

- Where it's used in the codebase
- Key functions/methods

**API Reference:**

- Link to external docs
- Key endpoints used
```

### wiki/contributing.md

```markdown
## Development Guidelines

### Getting Started

1. Clone repo
2. Install dependencies
3. Set up environment
4. Run development server

### Code Style

- Formatting: Prettier/ESLint config
- Naming conventions
- File organization rules

### Adding a New Feature

1. Create feature directory
2. Implement components
3. Add services/hooks
4. Update documentation

### Testing

- Unit tests location
- How to run tests
- Coverage requirements

### PR Process

- Branch naming
- Commit message format
- Review requirements
```

---

## Step 4: Generation Checklist

```markdown
## Wiki Creation Report

### Codebase Analyzed

- [x] Project structure mapped
- [x] Tech stack identified
- [x] Features identified
- [x] Database schema extracted
- [x] API endpoints documented
- [x] Patterns identified

### Wiki Files Created

#### Core Wiki

- [ ] wiki/README.md - Project overview
- [ ] wiki/architecture.md - System design
- [ ] wiki/schemas.md - Database documentation
- [ ] wiki/interfaces.md - API documentation
- [ ] wiki/features.md - Feature documentation
- [ ] wiki/data-flow.md - State/data patterns
- [ ] wiki/file-flow.md - Code organization
- [ ] wiki/react-typescript.md - Code patterns
- [ ] wiki/integrations.md - External services
- [ ] wiki/contributing.md - Dev guidelines

#### Feature Wiki (if applicable)

- [ ] wiki/{feature}/architecture.md
- [ ] wiki/{feature}/interfaces.md
- [ ] wiki/{feature}/schemas.md
- [ ] wiki/{feature}/data-flow.md
- [ ] wiki/{feature}/file-flow.md
- [ ] wiki/{feature}/features.md

### Verification

- [ ] All database tables documented
- [ ] All API endpoints documented
- [ ] All features listed
- [ ] Data flows explained
- [ ] File structure documented
- [ ] Getting started guide works
```

---

## Content Guidelines

### What to Include

- Actual code structure (not idealized)
- Real patterns used in codebase
- Specific file paths and names
- Current implementation details
- Known limitations or TODOs

### What to Exclude

- Implementation details that change frequently
- Line numbers (they change)
- Speculation about future features
- Personal opinions
- Redundant information

### Writing Style

- Be concise and factual
- Use consistent formatting
- Include code examples where helpful
- Link between related docs
- Keep navigation clear

---

## Wiki File Reference

| File                  | What It Documents                          |
| --------------------- | ------------------------------------------ |
| `README.md`           | Project overview, navigation, tech stack   |
| `schemas.md`          | Database tables, columns, types, RLS       |
| `interfaces.md`       | API endpoints, request/response formats    |
| `features.md`         | Feature list, capabilities, workflows      |
| `data-flow.md`        | State management, data fetching, contexts  |
| `file-flow.md`        | File responsibilities, component hierarchy |
| `architecture.md`     | System design, integration points          |
| `react-typescript.md` | Hooks, components, type patterns           |
| `integrations.md`     | External services, third-party APIs        |
| `contributing.md`     | How to develop and extend the project      |

---

## Integration

**Trigger methods:**

1. Manual: `/wiki-create` for new projects
2. Initial setup: When setting up documentation for first time
3. Major refactor: After significant codebase restructuring

**Relationship to other skills:**

- `/wiki-create` generates initial wiki from scratch
- `/docs-update` keeps wiki current after code changes
- `/prd` explores wiki/codebase and generates PRD with context
