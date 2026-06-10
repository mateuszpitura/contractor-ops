#!/usr/bin/env bash
# Inject claude-obsidian hot cache from .planning/brain (project vault).
# Enforce: documentation follows code — wiki must stay in sync with apps/packages.
# Usage: wiki-brain-inject.sh [sessionstart|postcompact|stop]
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
VAULT="${VAULT_PATH:-.planning/brain}"
HOT="$ROOT/$VAULT/wiki/hot.md"
WIKI_DIR="$ROOT/$VAULT/wiki"
MODE="${1:-sessionstart}"

emit_knowledge_refresh_rule() {
  cat <<'EOF'
=== Documentation follows code (binding — CLAUDE.md) ===
Wiki is living compass — must track code, not lag behind.
ANY product change in apps/ or packages/ (feature, component, hook, package,
router, service, integration, cron, schema, flag, env) → update matching
wiki in the SAME change set before done:
  • domains / patterns / structure / integrations pages
  • log.md + hot.md + pnpm check:wiki-brain + BM25 rebuild
  • graph / intel / MEMORY when applicable (see refresh-triggers.md)
Exempt: tests, generated, lockfiles, zero-behavior formatting only.
=== end documentation follows code ===
EOF
}

collect_changed_files() {
  if [ ! -d "$ROOT/.git" ]; then
    return 0
  fi
  {
    git -C "$ROOT" diff --name-only HEAD 2>/dev/null || true
    git -C "$ROOT" diff --name-only --cached 2>/dev/null || true
  } | sort -u
}

# Paths that never require a wiki companion update
is_doc_exempt() {
  local file="$1"
  case "$file" in
    */__tests__/*|*/__mocks__/*) return 0 ;;
    *\.test.ts|*\.test.tsx|*\.spec.ts) return 0 ;;
    packages/db/src/generated/*) return 0 ;;
    pnpm-lock.yaml|package-lock.json|yarn.lock) return 0 ;;
    */coverage/*|playwright-report/*|test-results/*) return 0 ;;
    .planning/brain/*) return 0 ;;
  esac
  return 1
}

# Product code paths — any change here should have wiki follow
is_product_code() {
  local file="$1"
  if is_doc_exempt "$file"; then
    return 1
  fi
  case "$file" in
    apps/*|packages/*) return 0 ;;
    render.yaml|.env.example) return 0 ;;
    .planning/MEMORY.md) return 0 ;;
  esac
  return 1
}

case "$MODE" in
  sessionstart|postcompact)
    emit_knowledge_refresh_rule
    GRAPH="$ROOT/.planning/graphs/graph.json"
    ROOT_TS="$ROOT/packages/api/src/root.ts"
    ROUTER_CAT="$ROOT/$VAULT/wiki/structure/api-routers-catalog.md"
    if [ ! -f "$GRAPH" ]; then
      printf 'WIKI_WARN: missing .planning/graphs/graph.json — run: graphify update . --no-cluster --force (see %s/README.md)\n' "$VAULT"
    fi
    if [ -f "$ROOT_TS" ] && [ -f "$ROUTER_CAT" ] && [ "$ROOT_TS" -nt "$ROUTER_CAT" ]; then
      printf 'WIKI_WARN: root.ts newer than api-routers-catalog.md — update wiki (CLAUDE.md § Documentation follows code)\n'
    fi
    if [ -f "$HOT" ]; then
      echo "=== Wiki hot cache ($VAULT) ==="
      cat "$HOT"
      echo "=== end wiki hot cache ==="
    fi
    LOCK="$ROOT/$VAULT/scripts/wiki-lock.sh"
    if [ -x "$LOCK" ]; then
      bash "$LOCK" clear-stale --max-age 3600 >/dev/null 2>&1 || true
    fi
    ;;
  stop)
    if [ ! -d "$WIKI_DIR" ] || [ ! -d "$ROOT/.git" ]; then
      exit 0
    fi
    changed_files="$(collect_changed_files)"
    wiki_changed=0
    product_code_changed=0
    if [ -n "$changed_files" ]; then
      while IFS= read -r f; do
        [ -z "$f" ] && continue
        case "$f" in
          .planning/brain/wiki/*) wiki_changed=1 ;;
        esac
        if is_product_code "$f"; then
          product_code_changed=1
        fi
      done <<<"$changed_files"
    fi
    if [ "$wiki_changed" -eq 1 ]; then
      printf 'WIKI_CHANGED: Wiki under %s/wiki/ modified. Finish: hot.md (overwrite), log.md (append), pnpm check:wiki-brain, BM25 rebuild.\n' "$VAULT"
    fi
    if [ "$product_code_changed" -eq 1 ]; then
      printf 'KNOWLEDGE_REFRESH_REQUIRED: Product code changed (apps/packages). Before done: update matching wiki pages — domains, patterns, structure, integrations as applicable. See CLAUDE.md § Documentation follows code.\n'
      if [ "$wiki_changed" -eq 0 ]; then
        printf 'DOC_DRIFT_WARN: Product code changed but NO wiki pages updated this session. Documentation must follow code — add or update wiki before marking work complete.\n'
      fi
    fi
    ;;
  *)
    printf 'wiki-brain-inject: unknown mode %s\n' "$MODE" >&2
    exit 1
    ;;
esac
