---
phase: 40
slug: integration-cleanup-featuregate-type-safety
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
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
| 40-01-01 | 01 | 1 | BILL-09 | unit | `pnpm --filter web test -- --run apps/web/src/components/integrations/__tests__/jira-provider-section.test.tsx` | ❌ W0 | ⬜ pending |
| 40-01-02 | 01 | 1 | BILL-09 | unit | `pnpm --filter web test -- --run apps/web/src/components/settings/__tests__/org-calendar-section.test.tsx` | ✅ (needs update) | ⬜ pending |
| 40-02-01 | 02 | 1 | EQUIP-05, EQUIP-06, EQUIP-07, TEAM-02, BILL-10 | type-check | `pnpm --filter @contractor-ops/api build && pnpm --filter web tsc --noEmit` | N/A | ⬜ pending |
| 40-02-02 | 02 | 1 | TEAM-02 | unit | `pnpm --filter web test -- --run apps/web/src/components/integrations/__tests__/teams-channel-mapping-card.test.tsx` | ✅ (mock update) | ⬜ pending |
| 40-02-03 | 02 | 1 | BILL-10 | unit | `pnpm --filter web test -- --run apps/web/src/components/billing/__tests__/usage-dashboard.test.tsx` | ✅ (mock update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/integrations/__tests__/jira-provider-section.test.tsx` — stubs for BILL-09 (Jira FeatureGate)
- [ ] Update existing calendar section tests with FeatureGate mock assertions
- [ ] Update existing test mocks for proxy-removal files (remove proxy mock patterns, use proper tRPC paths)

*Existing infrastructure covers framework needs. Only test stubs/updates required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FeatureGate upgrade banner renders correctly for STARTER tier on Jira section | BILL-09 | Visual verification of banner styling | Navigate to integrations page as STARTER org, confirm Jira section shows upgrade prompt |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
