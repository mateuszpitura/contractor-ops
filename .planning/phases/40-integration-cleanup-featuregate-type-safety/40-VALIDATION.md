---
phase: 40
slug: integration-cleanup-featuregate-type-safety
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-06
audited: 2026-04-08
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `apps/web/vitest.config.ts`) |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api build && pnpm --filter web tsc --noEmit` |
| **Full suite command** | `pnpm --filter web test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api build && pnpm --filter web tsc --noEmit`
- **After every plan wave:** Run `pnpm --filter web test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | BILL-09 | unit | `pnpm --filter web test -- --run src/components/integrations/__tests__/jira-provider-section.test.tsx` | ✅ | ✅ green |
| 40-01-02 | 01 | 1 | BILL-09 | unit | `pnpm --filter web test -- --run src/components/settings/__tests__/org-calendar-section.test.tsx` | ✅ | ✅ green |
| 40-02-01 | 02 | 1 | EQUIP-05, EQUIP-06, EQUIP-07, TEAM-02, BILL-10 | type-check | `pnpm --filter web tsc --noEmit` | N/A | ✅ green |
| 40-02-02 | 02 | 1 | TEAM-02 | unit | `pnpm --filter web test -- --run src/components/integrations/__tests__/teams-channel-mapping-card.test.tsx` | ✅ | ✅ green |
| 40-02-03 | 02 | 1 | BILL-10 | unit | `pnpm --filter web test -- --run src/components/billing/__tests__/usage-dashboard.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/web/src/components/integrations/__tests__/jira-provider-section.test.tsx` — created for BILL-09 (Jira FeatureGate)
- [x] Existing calendar section tests already mock FeatureGate correctly (pass-through pattern)
- [x] Existing test mocks for proxy-removal files already use proper tRPC paths (no updates needed)

*All Wave 0 requirements satisfied. Test infrastructure complete.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FeatureGate upgrade banner renders correctly for STARTER tier on Jira section | BILL-09 | Visual verification of banner styling | Navigate to integrations page as STARTER org, confirm Jira section shows upgrade prompt |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-08

---

## Validation Audit 2026-04-08

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Details:**
- **40-01-01 (MISSING):** Created `jira-provider-section.test.tsx` — 3 tests covering FeatureGate tier gating (STARTER upgrade banner, PRO access, status mapping button). All passing.
- **40-01-02, 40-02-01, 40-02-02, 40-02-03:** Already COVERED — existing tests pass (377 files, 3594 tests green).
- **Full suite:** `pnpm --filter web test -- --run` passes with 0 failures.
