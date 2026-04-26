#!/usr/bin/env bash
# Security scans for local dev and CI.
#
# Usage (from repo root):
#   ./scripts/security-scan.sh
#   pnpm run security:scan
#
# Environment:
#   SECURITY_SCAN_USE_DOCKER=1   — force Gitleaks via Docker even if binary exists
#   SECURITY_AUDIT_LEVEL=high    — pnpm audit minimum severity to fail (low|moderate|high|critical|none)
#                                  default: moderate. Use "none" to never fail on audit (report only).
#
# Future CI (GitHub Actions):
#   - See .github/workflows/security-scan.yml (manual dispatch; enable pull_request when stable)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { printf '%b\n' "$*"; }
info() { log "${CYAN}==>${NC} $*"; }
warn() { log "${YELLOW}WARN:${NC} $*"; }
fail() { log "${RED}FAIL:${NC} $*"; }
ok() { log "${GREEN}OK:${NC} $*"; }

EXIT_CODE=0

run_gitleaks() {
  info "Gitleaks (secret scan)"
  local args=(
    detect
    --source "$ROOT"
    --verbose
    --redact
  )

  if [[ "${SECURITY_SCAN_USE_DOCKER:-}" == "1" ]]; then
    if ! command -v docker &>/dev/null; then
      warn "SECURITY_SCAN_USE_DOCKER=1 but docker not found — skipping Gitleaks"
      return 0
    fi
    info "Using Docker image zricethezav/gitleaks:latest"
    # Config and ignore live in repo root (mounted at /repo)
    if docker run --rm -v "$ROOT:/repo" zricethezav/gitleaks:latest detect --source=/repo --verbose --redact; then
      ok "Gitleaks: no leaks"
    else
      fail "Gitleaks reported leaks"
      EXIT_CODE=1
    fi
    return 0
  fi

  if command -v gitleaks &>/dev/null; then
    if gitleaks "${args[@]}"; then
      ok "Gitleaks: no leaks"
    else
      fail "Gitleaks reported leaks"
      EXIT_CODE=1
    fi
    return 0
  fi

  if command -v docker &>/dev/null; then
    info "gitleaks binary not in PATH — using Docker"
    if docker run --rm -v "$ROOT:/repo" zricethezav/gitleaks:latest detect --source=/repo --verbose --redact; then
      ok "Gitleaks: no leaks"
    else
      fail "Gitleaks reported leaks"
      EXIT_CODE=1
    fi
    return 0
  fi

  warn "Gitleaks skipped — install https://github.com/gitleaks/gitleaks or Docker"
}

run_pnpm_audit() {
  info "pnpm audit (dependency advisories)"
  if ! command -v pnpm &>/dev/null; then
    warn "pnpm not found — skipping audit"
    return 0
  fi

  local level="${SECURITY_AUDIT_LEVEL:-moderate}"

  if [[ "$level" == "none" ]]; then
    pnpm audit || true
    ok "pnpm audit completed (exit code ignored — SECURITY_AUDIT_LEVEL=none)"
    return 0
  fi

  # pnpm 9 supports --audit-level (same semantics as npm)
  set +e
  pnpm audit --audit-level "$level" 2>&1
  local audit_exit=$?
  set -e

  if [[ "$audit_exit" -eq 0 ]]; then
    ok "pnpm audit: no issues at or above $level"
  else
    fail "pnpm audit: vulnerabilities at or above $level (exit $audit_exit)"
    EXIT_CODE=1
  fi
}

log ""
log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "${CYAN}  contractor-ops — security scan${NC}"
log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log ""

run_gitleaks
log ""
run_pnpm_audit
log ""

if [[ "$EXIT_CODE" -eq 0 ]]; then
  ok "All security checks passed"
else
  fail "One or more checks failed (exit $EXIT_CODE)"
fi

exit "$EXIT_CODE"
