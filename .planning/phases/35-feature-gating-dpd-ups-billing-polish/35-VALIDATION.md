---
phase: 35
slug: feature-gating-dpd-ups-billing-polish
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-05
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via vitest.config.ts) |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `cd packages/api && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/api && npx vitest run && cd ../../packages/validators && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/api && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/api && npx vitest run && cd ../../packages/validators && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 1 | BILL-09 | unit | `cd packages/api && npx vitest run src/middleware/__tests__/tier.test.ts -x` | W0 | pending |
| 35-01-02 | 01 | 1 | BILL-10 | unit | `cd packages/api && npx vitest run src/routers/__tests__/billing-dashboard.test.ts -x` | W0 | pending |
| 35-02-01 | 02 | 1 | EQUIP-06 | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/dpd-client.test.ts -x` | W0 | pending |
| 35-02-02 | 02 | 1 | EQUIP-07 | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/ups-client.test.ts -x` | W0 | pending |
| 35-03-01 | 03 | 2 | EQUIP-06/07 | tsc+suite | `cd packages/api && npx tsc --noEmit && npx vitest run --reporter=verbose 2>&1 \| tail -20` | n/a | pending |
| 35-03-02 | 03 | 2 | EQUIP-06/07 | tsc | `cd apps/web && npx tsc --noEmit 2>&1 \| head -20` | n/a | pending |
| 35-04-01 | 04 | 2 | BILL-09 | tsc | `cd apps/web && npx tsc --noEmit 2>&1 \| head -20` | n/a | pending |
| 35-04-02 | 04 | 2 | BILL-10 | tsc | `cd apps/web && npx tsc --noEmit 2>&1 \| head -20` | n/a | pending |
| 35-05-01 | 05 | 2 | EQUIP-06/07 | tsc | `cd apps/web && npx tsc --noEmit 2>&1 \| head -20` | n/a | pending |
| 35-05-02 | 05 | 2 | EQUIP-06/07 | tsc | `cd apps/web && npx tsc --noEmit 2>&1 \| head -20` | n/a | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/middleware/__tests__/tier.test.ts` — stubs for BILL-09 requireTier middleware
- [ ] `packages/api/src/routers/__tests__/billing-dashboard.test.ts` — stubs for BILL-10 usage dashboard endpoint
- [ ] `packages/api/src/services/courier/__tests__/dpd-client.test.ts` — stubs for EQUIP-06 DPD client
- [ ] `packages/api/src/services/courier/__tests__/dpd-status-mapper.test.ts` — stubs for EQUIP-06 DPD status mapping
- [ ] `packages/api/src/services/courier/__tests__/ups-client.test.ts` — stubs for EQUIP-07 UPS client + OAuth
- [ ] `packages/api/src/services/courier/__tests__/ups-status-mapper.test.ts` — stubs for EQUIP-07 UPS status mapping
- [ ] `packages/validators/src/__tests__/dpd-ups-equipment.test.ts` — stubs for DPD/UPS Zod schemas

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upgrade prompt UI displays correct plan name and feature | BILL-09 | Frontend component rendering | Visit gated page as free-tier user, verify modal shows feature name and required plan |
| Usage dashboard displays real-time data | BILL-10 | Requires Stripe test clock for billing cycle | Create test subscription, verify dashboard shows correct plan, seats, credits, next billing date |

---

## Nyquist Compliance Notes

Wave 2 plans (03, 04, 05) use `tsc --noEmit` and vitest suite runs as behavioral verification. Plan 03 Task 1 runs the full vitest suite after tsc to confirm no regressions from router changes. Plans 04 and 05 use `tsc --noEmit` for `apps/web` to verify frontend component type safety. This ensures no 3 consecutive tasks lack automated behavioral verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
