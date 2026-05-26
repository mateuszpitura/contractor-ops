#!/usr/bin/env bash
# inject-standards-subagent.sh — SubagentStart: floor only (no full CLAUDE.md)
set -euo pipefail

export INJECT_PROFILE=subagent
export INJECT_HOOK_EVENT=SubagentStart

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/inject-core-values.sh"
