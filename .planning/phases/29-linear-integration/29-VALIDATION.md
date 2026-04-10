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
| 29-02-01 | 02 | 1 | LIN-02 | unit | `cd packages/api && pnpm vitest run src/services/__tests__/linear-status-mapping.test.ts -x` | Yes | green |
| 29-02-02 | 02 | 1 | LIN-03 | unit | `cd packages/api && pnpm vitest run src/services/__tests__/linear-issue-sync.test.ts -x` | Yes | green |
| 29-02-03 | 02 | 1 | LIN-05 | unit | `cd packages/api && pnpm vitest run src/services/__tests__/linear-webhook-handler.test.ts -x` | Yes | green |
| 29-03-01 | 03 | 2 | LIN-06 | manual-only | Visual verification in browser | N/A | manual-only |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `packages/integrations/src/adapters/__tests__/linear-adapter.test.ts` — 21 tests for LIN-01, LIN-04 (all green)
- [x] `packages/api/src/services/__tests__/linear-status-mapping.test.ts` — 4 tests for LIN-02 status mapping (all green)
- [x] `packages/api/src/services/__tests__/linear-issue-sync.test.ts` — 14 tests for LIN-03 issue sync, LIN-05 outbound sync (all green)
- [x] `packages/api/src/services/__tests__/linear-webhook-handler.test.ts` — 10 tests for LIN-04 webhook handler (all green)
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
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Details:**
- Initial audit found VALIDATION.md referenced `packages/api/src/__tests__/` paths for status mapping and issue sync tests. These files did not exist at that path.
- Investigation revealed the tests actually exist at `packages/api/src/services/__tests__/` (3 files: linear-status-mapping, linear-issue-sync, linear-webhook-handler), all untracked but present and passing.
- Corrected VALIDATION.md paths to reference the actual test file locations.
- All test files verified green: adapter (21), validators (10), status mapping (4), issue sync (14), webhook handler (10) = 59 total automated tests.

**Total automated test count:** 59 tests across 5 files, all green.
