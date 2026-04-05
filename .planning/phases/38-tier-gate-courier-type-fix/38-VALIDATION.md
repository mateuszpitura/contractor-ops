---
phase: 38
slug: tier-gate-courier-type-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (workspace config) |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `cd packages/api && npx vitest run --reporter=verbose` |
| **Full suite command** | `npx turbo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/api && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx turbo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | BILL-09 | unit | `cd packages/api && npx vitest run src/routers/__tests__/teams.test.ts -x` | ✅ (needs tier test) | ⬜ pending |
| 38-01-02 | 01 | 1 | BILL-09 | unit | `cd packages/api && npx vitest run src/routers/__tests__/google-workspace.test.ts -x` | ✅ (needs tier tests) | ⬜ pending |
| 38-01-03 | 01 | 1 | BILL-09 | unit | `cd packages/api && npx vitest run src/routers/__tests__/onboarding-import.test.ts -x` | ✅ (needs tier tests) | ⬜ pending |
| 38-02-01 | 02 | 1 | EQUIP-05/06/07 | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/ -x` | ✅ (needs type updates) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add `subscription.findUnique` mock to `teams.test.ts`, `google-workspace.test.ts`, `onboarding-import.test.ts`
- [ ] Update courier test files to reference `BaseShipmentParams` and `InPostShipmentParams` instead of removed types

*Existing test infrastructure covers framework needs. Wave 0 is mock/type updates only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FeatureGate renders upgrade banner for STARTER tier | BILL-09 | UI component rendering | Render Teams/GWS/Onboarding pages with STARTER subscription, verify UpgradeInlineBanner visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
