---
phase: 37
slug: shipment-task-auto-completion
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
audited: 2026-04-08
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via packages/api/vitest.config.ts) |
| **Config file** | packages/api/vitest.config.ts |
| **Quick run command** | `cd packages/api && npx vitest run src/services/courier/__tests__/ --reporter=verbose` |
| **Full suite command** | `cd packages/api && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/api && npx vitest run src/services/courier/__tests__/ --reporter=verbose`
- **After every plan wave:** Run `cd packages/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | EQUIP-09 | unit + integration | `cd packages/api && npx vitest run src/services/courier/__tests__/inpost-webhook-handler.test.ts -x` | ✅ | ✅ green |
| 37-01-02 | 01 | 1 | EQUIP-10 | unit + integration | `cd packages/api && npx vitest run src/services/courier/__tests__/inpost-polling-service.test.ts -x` | ✅ | ✅ green |
| 37-01-03 | 01 | 1 | EQUIP-10 | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/dpd-polling-service.test.ts -x` | ✅ | ✅ green |
| 37-01-04 | 01 | 1 | EQUIP-10 | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/ups-polling-service.test.ts -x` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/api/src/services/courier/__tests__/dpd-polling-service.test.ts` — stubs for EQUIP-10 (DPD polling). Follow inpost-polling-service.test.ts pattern
- [x] `packages/api/src/services/courier/__tests__/ups-polling-service.test.ts` — stubs for EQUIP-10 (UPS polling). Follow inpost-polling-service.test.ts pattern

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| E2E webhook → task completion | EQUIP-09 | Requires running InPost webhook with real DB state | 1. Create equipment + shipment linked to workflow task. 2. Send webhook with DELIVERED status. 3. Verify task status = DONE |
| E2E polling → task completion | EQUIP-10 | Requires mocked courier API + DB state | 1. Create equipment + shipment linked to workflow task. 2. Trigger polling with mocked carrier response. 3. Verify task status = DONE |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-08

---

## Validation Audit 2026-04-08

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Audit result:** All 4 tasks have automated verification (unit tests + integration tests). 98 tests across 11 test files pass green. No gaps detected. Phase is Nyquist-compliant.

Test coverage breakdown:
- `inpost-webhook-handler.test.ts`: 2 task completion wiring tests (positive + negative)
- `inpost-polling-service.test.ts`: 2 task completion wiring tests (positive + negative)
- `dpd-polling-service.test.ts`: 5 tests including task completion wiring
- `ups-polling-service.test.ts`: 5 tests including task completion wiring
- `shipment-task-completion-integration.test.ts`: 4 integration tests (real checkShipmentTaskCompletion, not mocked)
