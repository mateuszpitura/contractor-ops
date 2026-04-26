---
phase: 43
slug: dpd-ups-notification-dispatch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `npx vitest run packages/api/src/services/courier/__tests__/dpd-polling-service.test.ts packages/api/src/services/courier/__tests__/ups-polling-service.test.ts packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts` |
| **Full suite command** | `npx vitest run packages/api/src/services/courier/__tests__/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/api/src/services/courier/__tests__/dpd-polling-service.test.ts packages/api/src/services/courier/__tests__/ups-polling-service.test.ts packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts`
- **After every plan wave:** Run `npx vitest run packages/api/src/services/courier/__tests__/`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 1 | EQUIP-06, EQUIP-07 | — | N/A | unit | `npx vitest run packages/api/src/services/courier/__tests__/shipment-notification.test.ts` | ❌ W0 | ⬜ pending |
| 43-01-02 | 01 | 1 | EQUIP-06 | — | N/A | unit | `npx vitest run packages/api/src/services/courier/__tests__/dpd-polling-service.test.ts` | ✅ | ⬜ pending |
| 43-01-03 | 01 | 1 | EQUIP-07 | — | N/A | unit | `npx vitest run packages/api/src/services/courier/__tests__/ups-polling-service.test.ts` | ✅ | ⬜ pending |
| 43-01-04 | 01 | 1 | — | — | N/A | unit | `npx vitest run packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts` | ✅ | ⬜ pending |
| 43-01-05 | 01 | 1 | — | — | N/A | unit | `npx vitest run packages/api/src/services/courier/__tests__/inpost-webhook-handler.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/courier/__tests__/shipment-notification.test.ts` — stubs for shared helper unit tests

*Existing test infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
