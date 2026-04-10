---
phase: 29
slug: linear-integration
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-02
audited: 2026-04-08
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `packages/integrations/vitest.config.ts` |
| **Quick run command** | `cd packages/integrations && pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm turbo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/integrations && pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm turbo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | LIN-01 | unit | `cd packages/integrations && pnpm vitest run src/adapters/__tests__/linear-adapter.test.ts -x` | Yes | green |
| 29-01-02 | 01 | 1 | LIN-04 | unit | `cd packages/integrations && pnpm vitest run src/adapters/__tests__/linear-adapter.test.ts -x` | Yes | green |
| 29-02-01 | 02 | 1 | LIN-02 | unit | `cd packages/api && pnpm vitest run src/__tests__/linear-status-mapping.test.ts -x` | Yes | green |
| 29-02-02 | 02 | 1 | LIN-03 | unit | `cd packages/api && pnpm vitest run src/__tests__/linear-issue-sync.test.ts -x` | Yes | green |
| 29-02-03 | 02 | 1 | LIN-05 | unit | `cd packages/api && pnpm vitest run src/__tests__/linear-issue-sync.test.ts -x` | Yes | green |
| 29-03-01 | 03 | 2 | LIN-06 | manual-only | Visual verification in browser | N/A | manual-only |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `packages/integrations/src/adapters/__tests__/linear-adapter.test.ts` — 21 tests for LIN-01, LIN-04 (all green)
- [x] `packages/api/src/__tests__/linear-status-mapping.test.ts` — 13 tests for LIN-02 (all green)
- [x] `packages/api/src/__tests__/linear-issue-sync.test.ts` — 20 tests for LIN-03, LIN-05, LIN-04 webhook handler (all green)
- [x] `packages/validators/src/__tests__/linear.test.ts` — 10 tests for webhook payload validation (all green)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Linear issue chip renders with purple brand accent and status dot | LIN-06 | Visual/styling verification requires browser render | 1. Navigate to workflow task with linked Linear issue 2. Verify chip shows issue ID + colored status dot 3. Verify purple accent distinct from Jira blue chips 4. Click chip to verify opens Linear in new tab |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

---

## Validation Audit 2026-04-08

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

**Details:**
- `packages/api/src/__tests__/linear-status-mapping.test.ts` was missing (referenced in Plan 02 SUMMARY but not on disk). Created with 13 passing tests covering getStatusMapping, saveStatusMapping (including D-03 PENDING_MAPPING transition), resolveLinearStateId, and resolveInternalStatus (including D-04 unmapped logging).
- `packages/api/src/__tests__/linear-issue-sync.test.ts` was missing (referenced in Plan 02 SUMMARY but not on disk). Created with 20 passing tests covering linearGraphQL, createLinearIssue (including D-07 assignee fallback), syncTaskStatusToLinear (including loop prevention), processLinearWebhook (including D-04 unmapped logging), and detectScopeExpansionNeeded.

**Total automated test count:** 64 tests across 4 files (21 + 13 + 20 + 10), all green.
