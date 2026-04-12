#!/usr/bin/env bash
# Repeatable grep-based audit for camelCase tokens inside z.enum / API string unions.
# Run from repo root: bash scripts/audit-domain-string-casing.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== z.enum with lowercase+camelCase segment (validators) ==="
rg 'z\.enum\(\[[^\]]*[a-z][A-Z]' packages/validators/src --glob '*.ts' || true

echo ""
echo === "Union types with notEquals / startsWith (should be empty after migration) ==="
rg '"notEquals"|"startsWith"' packages apps --glob '*.{ts,tsx}' || true

echo ""
echo "=== Done ==="
