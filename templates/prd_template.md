---
# PRD metadata — update as the spec evolves
status: draft          # draft | in_review | approved | implementing | shipped | archived
owner: ""              # person accountable for this PRD
created: {{date}}
updated: {{date}}
priority: medium       # low | medium | high | critical
target_release: ""     # milestone, sprint, or date (optional)
linked_tasks: []       # task ids created from this PRD (optional, for your tracking)
---

# {{title}}

> **How to use this template**
> A good PRD answers *what* and *why* before *how*. Be specific enough that an agent or engineer can implement without guessing intent. Replace placeholder text and delete guidance blocks as sections are filled in.

## Status & lifecycle

| Status | Meaning |
|--------|---------|
| `draft` | Work in progress — not ready for review |
| `in_review` | Ready for feedback from stakeholders |
| `approved` | Scope locked — safe to implement |
| `implementing` | Active development (use **Implement as task**) |
| `shipped` | Delivered to users |
| `archived` | Superseded or cancelled — kept for history |

Update the `status` field in frontmatter when you move between stages.

---

## Problem statement

**What pain exists today? Who feels it?**

- Describe the user or business problem in 2–4 sentences.
- Include evidence if you have it (support tickets, metrics, quotes).

<!-- Example: Users cannot reset their password without emailing support, causing ~40 support tickets/week and slow recovery. -->

---

## Goals

**What success looks like — measurable if possible.**

| Goal | Metric / signal |
|------|-----------------|
| | |
| | |

**Non-goals (explicitly out of scope)**

- 
- 

---

## Users & context

**Primary audience**

- Role / persona:
- Context of use:

**Assumptions**

- 
- 

**Constraints**

- Technical, legal, timeline, or dependency limits:

---

## User stories / jobs to be done

Write from the user's perspective. Each story should be testable.

1. **As a** … **I want** … **so that** …
   - Acceptance: …
2. 
3. 

---

## Functional requirements

Number requirements so they can be referenced in tasks and reviews.

| ID | Requirement | Priority (P0/P1/P2) |
|----|-------------|---------------------|
| FR-1 | | P0 |
| FR-2 | | |
| FR-3 | | |

**Detailed notes** (edge cases, error handling, permissions)

- 

---

## UX & design

- Key screens or flows:
- Empty / loading / error states:
- Links to mocks or references:

---

## Technical considerations

**Suggested approach** (optional — agents can propose alternatives)

- Architecture notes, APIs, data model sketches:

**Dependencies**

- Systems, teams, or features this relies on:

**Risks**

| Risk | Mitigation |
|------|------------|
| | |

---

## Acceptance criteria

Checklist for “done” — use for review before **Implement as task**.

- [ ] All P0 requirements addressed
- [ ] Edge cases documented above are handled
- [ ] No unresolved open questions (see below)
- [ ] Status set to `approved` in frontmatter

---

## Open questions

| # | Question | Owner | Resolution |
|---|----------|-------|------------|
| 1 | | | |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| {{date}} | | Initial draft from template |
