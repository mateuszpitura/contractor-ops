#!/usr/bin/env bash
# Verify generated 00-binding-standards.mdc matches core-values.yml (H6).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 "${ROOT}/.claude/hooks/parse-core-values.py" \
  "${ROOT}/.claude/core-values.yml" \
  --check-mdc "${ROOT}/.cursor/rules/00-binding-standards.mdc"
