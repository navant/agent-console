#!/usr/bin/env bash
# .claude/hooks/sync-memory.sh
#
# SessionEnd bridge: claude-mem (global) → workspace .claude/MEMORY.md.
# Loaded via @-import in CLAUDE.md. Regenerates each run; do not hand-edit MEMORY.md.

set -uo pipefail

# Kanban headless runs set this on the claude child only — refresh/sync must not inherit it.
unset AGENT_CONSOLE_HEADLESS
unset CLAUDE_CODE_SIMPLE

TMP=""
TMP_ERR=""

cleanup_tmp() {
  [[ -n "$TMP" && -f "$TMP" ]] && rm -f "$TMP"
  [[ -n "$TMP_ERR" && -f "$TMP_ERR" ]] && rm -f "$TMP_ERR"
}
trap cleanup_tmp EXIT INT TERM

# Skip when Agent Console started a headless run in this workspace (SessionEnd would recurse).
if [[ -n "${AGENT_CONSOLE_HEADLESS:-}" ]]; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[[ -z "$CWD" ]] && CWD="$(pwd)"

MEMORY="${CWD}/.claude/MEMORY.md"
PROJECT_NAME="$(basename "$CWD")"

# Legacy: temps lived next to MEMORY.md; remove leftovers from interrupted runs.
rm -f "${MEMORY}.tmp."* "${MEMORY}.err."* 2>/dev/null || true

TMP=$(mktemp "${TMPDIR:-/tmp}/claude-mem-sync.XXXXXX") || exit 0
TMP_ERR=$(mktemp "${TMPDIR:-/tmp}/claude-mem-sync-err.XXXXXX") || exit 0

mkdir -p "$(dirname "$MEMORY")"

if ! command -v claude >/dev/null 2>&1; then
  exit 0
fi

WORKER_UP=0
for PORT in 37701 37777; do
  if curl -sf --max-time 3 "http://localhost:${PORT}/" >/dev/null 2>&1; then
    WORKER_UP=1
    break
  fi
done
[[ "$WORKER_UP" -eq 0 ]] && exit 0

# True when MCP output is only the placeholder (no observations, no session index table).
memory_output_is_thin() {
  local f="$1"
  [[ -s "$f" ]] || return 0
  if grep -qE '\*\*Type:\*\* (decision|lesson|gotcha|pattern)' "$f"; then
    return 1
  fi
  if grep -qE '\| #S[0-9]+ \|' "$f"; then
    return 1
  fi
  if grep -qF '## claude-mem index' "$f"; then
    return 1
  fi
  if grep -qF '> _No durable lessons captured yet for this project._' "$f"; then
    return 0
  fi
  # Short generic activity blurb without curated entries
  if grep -qF '## Recent claude-mem activity' "$f" && ! grep -qE '^## [0-9]{4}-' "$f"; then
    return 0
  fi
  return 1
}

write_cli_fallback() {
  if ! command -v npx >/dev/null 2>&1; then
    return 1
  fi
  local raw text
  raw=$(npx claude-mem search "$PROJECT_NAME" 2>/dev/null) || return 1
  text=$(echo "$raw" | jq -r '.content[0].text // empty' 2>/dev/null || true)
  [[ -z "$text" ]] && text="$raw"

  # "0 obs" is normal when claude-mem has sessions/prompts but no observations yet — do not treat as empty.
  if echo "$text" | grep -qiE 'Found 0 result'; then
    return 1
  fi
  [[ -z "${text//[[:space:]]/}" ]] && return 1

  cat >"$TMP" <<EOF
# ${PROJECT_NAME} — Project Memory

_Auto-synced from claude-mem (CLI search). Regenerated each run — edit observations in claude-mem, not this file._

## claude-mem index (search: ${PROJECT_NAME})

${text}

> _No durable lessons captured yet for this project. Run interactive \`claude\` in this repo so claude-mem can record observations; then refresh._

_Run **Memory → Refresh summaries** in Agent Console to merge MCP-curated lessons when observations exist._
EOF
  mv "$TMP" "$MEMORY"
  TMP=""
  return 0
}

read -r -d '' PROMPT <<EOF || true
You are syncing claude-mem into a project memory file.

Project directory (use this path for memory_context / searches): ${CWD}
Project name: ${PROJECT_NAME}

Use claude-mem MCP tools — especially:
- memory_context or observation_context (project-scoped context)
- observation_search and memory_search
- timeline

Curate lasting knowledge:
- **Decisions**, **Lessons**, **Gotchas**, **Patterns** (max 15 entries)

If timeline has sessions/prompts, include a **## claude-mem activity** section with a markdown table of session IDs (#S…), times, and titles (from timeline/search).

Use the single-line placeholder ONLY if claude-mem has zero data for this project:
> _No durable lessons captured yet for this project._

Output ONLY markdown. No preamble, no code fences.

Required header (exact):

# ${PROJECT_NAME} — Project Memory

_Auto-synced from claude-mem at session end. Regenerated each run — edit claude-mem observations, not this file._

Then entries as:

## YYYY-MM-DD — short title

**Type:** decision | lesson | gotcha | pattern

2-3 sentence takeaway.
EOF

RUN_CLAUDE=(
  claude -p "$PROMPT"
  --output-format text
  --setting-sources user
  --dangerously-skip-permissions
  --add-dir "$CWD"
)
if command -v timeout >/dev/null 2>&1; then
  RUN_CLAUDE=(timeout 180 "${RUN_CLAUDE[@]}")
elif command -v gtimeout >/dev/null 2>&1; then
  RUN_CLAUDE=(gtimeout 180 "${RUN_CLAUDE[@]}")
fi

MCP_OK=0
if "${RUN_CLAUDE[@]}" >"$TMP" 2>"$TMP_ERR"; then
  if [[ -s "$TMP" ]] && grep -qF "# ${PROJECT_NAME} — Project Memory" "$TMP"; then
    if ! grep -qiE 'MCP tools require permission|requires permission that has not been granted' "$TMP"; then
      if ! memory_output_is_thin "$TMP"; then
        mv "$TMP" "$MEMORY"
        TMP=""
        MCP_OK=1
      fi
    fi
  fi
fi

if [[ "$MCP_OK" -eq 0 ]]; then
  write_cli_fallback || true
fi

exit 0
