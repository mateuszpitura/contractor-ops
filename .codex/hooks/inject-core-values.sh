#!/usr/bin/env bash
# inject-core-values.sh — SessionStart: full standards (caveman + core-values + CLAUDE.md)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSER="${SCRIPT_DIR}/parse-core-values.py"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
CONFIG=""
CLAUDE_MD=""

if [ -f "${PROJECT_DIR}/.claude/core-values.yml" ]; then
  CONFIG="${PROJECT_DIR}/.claude/core-values.yml"
fi

if [ -f "${PROJECT_DIR}/CLAUDE.md" ]; then
  CLAUDE_MD="${PROJECT_DIR}/CLAUDE.md"
elif [ -f "./CLAUDE.md" ]; then
  CLAUDE_MD="./CLAUDE.md"
fi

if [ -z "$CONFIG" ]; then
  exit 0
fi

BODY="$(python3 "$PARSER" "$CONFIG")"
if [ -z "$BODY" ]; then
  exit 0
fi

CAVEMAN_SKILL=""
if [ -f "${PROJECT_DIR}/.claude/skills/caveman/SKILL.md" ]; then
  CAVEMAN_SKILL="${PROJECT_DIR}/.claude/skills/caveman/SKILL.md"
elif [ -f ".claude/skills/caveman/SKILL.md" ]; then
  CAVEMAN_SKILL=".claude/skills/caveman/SKILL.md"
fi

export INJECT_BODY="$BODY"
export INJECT_CLAUDE_MD="$CLAUDE_MD"
export INJECT_CAVEMAN_SKILL="$CAVEMAN_SKILL"
export INJECT_HOOK_INPUT="$(cat)"
export INJECT_PROFILE="${INJECT_PROFILE:-full}"
export INJECT_HOOK_EVENT="${INJECT_HOOK_EVENT:-SessionStart}"

node "${SCRIPT_DIR}/inject-standards-build.js"
exit 0
