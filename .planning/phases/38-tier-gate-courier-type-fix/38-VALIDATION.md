---
phase: 38
slug: tier-gate-courier-type-fix
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
audited: 2026-04-08
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
| 38-01-01 | 01 | 1 | BILL-09 | unit (structural) | `cd packages/api && npx vitest run src/routers/__tests__/teams.test.ts -x` | ✅ | ✅ green |
| 38-01-02 | 01 | 1 | BILL-09 | unit (behavioral) | `cd packages/api && npx vitest run src/routers/__tests__/google-workspace.test.ts -x` | ✅ | ✅ green |
| 38-01-03 | 01 | 1 | BILL-09 | unit (behavioral) | `cd packages/api && npx vitest run src/routers/__tests__/onboarding-import.test.ts -x` | ✅ | ✅ green |
| 38-02-01 | 02 | 1 | EQUIP-05/06/07 | unit | `cd packages/api && npx vitest run src/services/courier/__tests__/ -x` | ✅ | ✅ green |
| 38-03-01 | 03 | 1 | BILL-09 | manual | N/A — UI rendering requires browser | ✅ (source verified) | ✅ manual-only |
| 38-03-02 | 03 | 1 | BILL-09 | manual | N/A — UI rendering requires browser | ✅ (source verified) | ✅ manual-only |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Add `subscription.findUnique` mock to `teams.test.ts`, `google-workspace.test.ts`, `onboarding-import.test.ts`
- [x] Update courier test files to reference `BaseShipmentParams` and `InPostShipmentParams` instead of removed types

*All Wave 0 requirements completed during phase execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FeatureGate renders upgrade banner for STARTER tier on Teams, GWS, Onboarding | BILL-09 | UI component rendering requires live browser with STARTER-tier session | Log in as STARTER-tier org user. Navigate to Teams channel mapping, GWS directory import, and onboarding import wizard. Verify UpgradeInlineBanner visible instead of feature content. |
| API TIER_REQUIRED error format in client | BILL-09 | Requires live session with real DB subscription record | Trigger gated endpoint as STARTER-tier user. Verify TRPCClientError with code FORBIDDEN and TIER_REQUIRED message JSON. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
