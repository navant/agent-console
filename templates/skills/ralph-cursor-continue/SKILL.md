---
name: ralph-cursor-continue
description: "Continue Ralph PRD execution in Cursor when Claude Code is rate-limited. Triggers on: continue ralph, pick up stories, cursor ralph, continue prd execution."
---

# Ralph Continuation (Cursor Mode)

Continue executing PRD stories when Claude Code is unavailable.

---

## The Job

1. Read `scripts/ralph/prd.json` for stories
2. Read `scripts/ralph/progress.txt` for context (especially Codebase Patterns section)
3. Read relevant `AGENTS.md` files for patterns
4. Pick highest priority story where `passes: false`
5. Implement the story
6. Run quality checks
7. Commit with message: `feat: [Story ID] - [Story Title] (cursor)`
8. Update `prd.json` to set `passes: true`
9. Append to `progress.txt` with `[CURSOR]` marker

**Important:** Work on ONE story per session. Keep the `(cursor)` suffix and `[CURSOR]` markers so Ralph knows what happened.

---

## Step 1: Gather Context

Read these files in order:

### 1.1 Progress Log
```
scripts/ralph/progress.txt
```
**Read the `## Codebase Patterns` section at the TOP first** - this contains consolidated learnings from previous iterations.

### 1.2 PRD State
```
scripts/ralph/prd.json
```
Find the story with:
- Lowest `priority` number
- `passes: false`

### 1.3 AGENTS.md Files
```
AGENTS.md                    # Root level patterns
{feature}/AGENTS.md          # Feature-specific patterns (if exists)
```

---

## Step 2: Check Branch

Verify you're on the correct branch from `prd.json`'s `branchName`:

```bash
git branch --show-current
```

If not on the correct branch:
```bash
git checkout <branchName>
# OR create if doesn't exist
git checkout -b <branchName> main
```

---

## Step 3: Implement the Story

Follow these rules:
- **ONE story only** - Don't try to do multiple
- **Focused changes** - Keep changes minimal and targeted
- **Follow patterns** - Use patterns from progress.txt and AGENTS.md
- **Match existing code style** - Look at similar code in the codebase

### For Each Acceptance Criterion:
1. Implement the requirement
2. Verify it works
3. Move to next criterion

---

## Step 4: Quality Checks

Run your project's quality checks:

```bash
# Examples - use whatever your project requires
npm run typecheck
npm run lint
npm run test
```

**For UI stories**, also verify in browser:
1. Navigate to the relevant page
2. Test the changes work as expected
3. Check for visual issues

**Do NOT proceed if checks fail.** Fix issues first.

---

## Step 5: Commit Changes

Commit with the `(cursor)` suffix so Ralph knows this was done in Cursor:

```bash
git add .
git commit -m "feat: US-XXX - Story Title (cursor)"
```

The `(cursor)` suffix is important for tracking.

---

## Step 6: Update PRD

Edit `scripts/ralph/prd.json` and set the completed story's `passes` to `true`:

```json
{
  "id": "US-XXX",
  "passes": true,  // ← Change this
  "notes": "Completed in Cursor"  // ← Optional note
}
```

---

## Step 7: Update Progress Log

Append to `scripts/ralph/progress.txt` with the `[CURSOR]` marker:

```markdown
## [Date/Time] - US-XXX [CURSOR]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
---
```

The `[CURSOR]` marker tells Ralph this iteration happened in Cursor.

### Update Codebase Patterns (if applicable)

If you discovered a reusable pattern, add it to the `## Codebase Patterns` section at the TOP of progress.txt.

---

## Step 8: Check Stop Condition

Check if ALL stories in `prd.json` have `passes: true`.

**If ALL complete:**
1. Run docs-update to sync wiki: Read `.claude/skills/docs-update/SKILL.md` and follow it
2. Then output: `<promise>COMPLETE</promise>`

**If more stories remain:**
End your response normally. Run this prompt again for the next story.

---

## Progress Entry Format

```markdown
## 2024-01-15 14:30 - US-003 [CURSOR]
- Implemented status filter dropdown
- Added filter persistence to URL params
- Files: TaskList.tsx, useFilters.ts, types.ts
- **Learnings:**
  - Filter state uses URL search params pattern
  - Reuse FilterDropdown component from components/core
---
```

---

## Checklist

Before ending:

- [ ] Read progress.txt Codebase Patterns section
- [ ] Implemented ONE story only
- [ ] All quality checks pass
- [ ] Committed with `(cursor)` suffix
- [ ] Updated prd.json `passes: true`
- [ ] Appended to progress.txt with `[CURSOR]` marker
- [ ] Updated Codebase Patterns if new pattern discovered
