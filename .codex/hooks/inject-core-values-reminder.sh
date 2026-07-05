#!/usr/bin/env bash
# inject-core-values-reminder.sh — UserPromptSubmit: motto + read CLAUDE.md nudge
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSER="${SCRIPT_DIR}/parse-core-values.py"

CONFIG=""
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -f "${CLAUDE_PROJECT_DIR}/.claude/core-values.yml" ]; then
  CONFIG="${CLAUDE_PROJECT_DIR}/.claude/core-values.yml"
elif [ -f ".claude/core-values.yml" ]; then
  CONFIG=".claude/core-values.yml"
fi

if [ -z "$CONFIG" ]; then
  exit 0
fi

REMINDER="$(python3 "$PARSER" --motto "$CONFIG")"
if [ -z "$REMINDER" ]; then
  exit 0
fi

# Full CLAUDE.md is re-injected on /clear and compact via SessionStart — not via Read tool
REMINDER="${REMINDER} Caveman full mode active. (CLAUDE.md re-injected on /clear/compact via SessionStart.)"

node -e '
  const additionalContext = process.argv[1];
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext,
    },
  }));
' "$REMINDER"

exit 0
