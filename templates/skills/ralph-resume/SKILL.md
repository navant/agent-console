---
name: ralph-resume
description: "Resume Ralph execution after Cursor continuation. Verifies Cursor's work and continues. Triggers on: ralph resume, resume ralph, continue from cursor, check cursor work."
---

# Ralph Resume

Resume Ralph execution after Cursor has been working on stories.

---

## Paths

- **Shell Ralph:** `scripts/ralph/progress.txt` and `scripts/ralph/prd.json`
- **Agent Console task (`ralph-loop`):** `.claude/tasks/<taskId>/progress.txt` and `.claude/tasks/<taskId>/prd.json`

Below assumes **shell** paths; substitute task paths when resuming an in-app loop.

---

## The Job

1. Check `scripts/ralph/progress.txt` for `[CURSOR]` entries
2. Verify Cursor's work is committed and quality checks pass
3. Document the handoff in progress.txt
4. Continue with next incomplete story

**Important:** Always verify Cursor's work before continuing. If issues found, fix or revert.

---

## Step 1: Check for Cursor Work

Read `scripts/ralph/progress.txt` and look for recent `[CURSOR]` entries:

```markdown
## 2024-01-15 14:30 - US-003 [CURSOR]
- Implemented status filter dropdown
- Files: TaskList.tsx, useFilters.ts
```

Also check git log for cursor commits:
```bash
git log --oneline -10 | grep "(cursor)"
```

**If no `[CURSOR]` entries found**, skip to normal Ralph operation.

---

## Step 2: Verify Cursor's Work

For each story marked with `[CURSOR]`:

### 2.1 Check PRD State
Verify `prd.json` has `passes: true` for those stories.

### 2.2 Run Quality Checks
```bash
npm run typecheck
npm run lint
npm run test
```

### 2.3 Brief Code Review
- Check the files mentioned in progress.txt
- Verify implementation meets acceptance criteria
- Look for any obvious issues

### Verification Outcomes:

**PASS** - Work is good, continue normally.

**ISSUES FOUND** - Minor issues:
- Fix the issues
- Amend or add a fix commit
- Note in progress.txt

**MAJOR ISSUES** - Broken implementation:
- Revert the commits: `git revert <commit>`
- Set `passes: false` back in prd.json
- Note in progress.txt why it was reverted
- Re-implement the story

---

## Step 3: Document Resume

Append to `scripts/ralph/progress.txt`:

```markdown
## [Date/Time] - RALPH RESUME
Resumed from Cursor handoff.
Cursor completed: US-003, US-004
Verified: PASS
Continuing with: US-005
---
```

Or if issues were found:
```markdown
## [Date/Time] - RALPH RESUME
Resumed from Cursor handoff.
Cursor completed: US-003, US-004
Verified: ISSUES FOUND
- US-003: Fixed missing error handling
- US-004: PASS
Continuing with: US-005
---
```

---

## Step 4: Continue Normal Operation

After verification and documentation:

1. Read `prd.json` for next story where `passes: false`
2. Follow normal Ralph operation (see main prompt.md)
3. Implement the story
4. Commit, update PRD, update progress

---

## Quick Verification Checklist

- [ ] Checked progress.txt for `[CURSOR]` entries
- [ ] Checked git log for `(cursor)` commits
- [ ] Verified prd.json state matches progress
- [ ] Ran quality checks (typecheck, lint, test)
- [ ] Briefly reviewed Cursor's code changes
- [ ] Documented resume in progress.txt
- [ ] Identified next story to implement

---

## Example Flow

```
1. Read progress.txt
   → Found: US-003 [CURSOR], US-004 [CURSOR]

2. Verify prd.json
   → US-003: passes: true ✓
   → US-004: passes: true ✓

3. Run quality checks
   → typecheck: PASS
   → lint: PASS
   → test: PASS

4. Review code
   → US-003: Looks good
   → US-004: Looks good

5. Document resume
   → Append RALPH RESUME entry to progress.txt

6. Find next story
   → US-005: passes: false
   → Continue with US-005
```
