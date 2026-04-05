---
phase: 37
slug: shipment-task-auto-completion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
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
| 37-01-01 | 01 | 1 | EQUIP-09 | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/inpost-webhook-handler.test.ts -x` | ✅ extend | ⬜ pending |
| 37-01-02 | 01 | 1 | EQUIP-10 | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/inpost-polling-service.test.ts -x` | ✅ extend | ⬜ pending |
| 37-01-03 | 01 | 1 | EQUIP-10 | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/dpd-polling-service.test.ts -x` | ❌ W0 | ⬜ pending |
| 37-01-04 | 01 | 1 | EQUIP-10 | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/ups-polling-service.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/courier/__tests__/dpd-polling-service.test.ts` — stubs for EQUIP-10 (DPD polling). Follow inpost-polling-service.test.ts pattern
- [ ] `packages/api/src/services/courier/__tests__/ups-polling-service.test.ts` — stubs for EQUIP-10 (UPS polling). Follow inpost-polling-service.test.ts pattern

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| E2E webhook → task completion | EQUIP-09 | Requires running InPost webhook with real DB state | 1. Create equipment + shipment linked to workflow task. 2. Send webhook with DELIVERED status. 3. Verify task status = DONE |
| E2E polling → task completion | EQUIP-10 | Requires mocked courier API + DB state | 1. Create equipment + shipment linked to workflow task. 2. Trigger polling with mocked carrier response. 3. Verify task status = DONE |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
