---
phase: 34
slug: intelligent-onboarding-wizard
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
audited: 2026-04-08
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- --run` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test -- --run`
- **After every plan wave:** Run `pnpm --filter @contractor-ops/api test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | ONBD-01 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ✅ `packages/api/src/routers/__tests__/onboarding-import.test.ts` | ✅ green |
| 34-01-02 | 01 | 1 | ONBD-02 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ✅ `packages/api/src/routers/__tests__/onboarding-import.test.ts` | ✅ green |
| 34-01-03 | 01 | 1 | ONBD-03 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ✅ `packages/api/src/routers/__tests__/onboarding-import.test.ts` | ✅ green |
| 34-01-04 | 01 | 1 | ONBD-04 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ✅ `packages/api/src/routers/__tests__/onboarding-import.test.ts` | ✅ green |
| 34-01-05 | 01 | 1 | ONBD-05 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ✅ `packages/api/src/routers/__tests__/onboarding-import.test.ts` | ✅ green |
| 34-02-01 | 02 | 2 | ONBD-01 | component | `pnpm --filter @contractor-ops/web test -- --run` | ✅ `apps/web/src/components/onboarding/__tests__/source-selection-step.test.tsx` | ✅ green |
| 34-02-02 | 02 | 2 | ONBD-02 | component | `pnpm --filter @contractor-ops/web test -- --run` | ✅ `apps/web/src/components/onboarding/__tests__/people-review-step.test.tsx` | ✅ green |
| 34-02-03 | 02 | 2 | ONBD-03 | component | `pnpm --filter @contractor-ops/web test -- --run` | ✅ `apps/web/src/components/onboarding/__tests__/project-import-step.test.tsx` | ✅ green |
| 34-02-04 | 02 | 2 | ONBD-04 | component | `pnpm --filter @contractor-ops/web test -- --run` | ✅ `apps/web/src/components/onboarding/__tests__/conflict-resolution-popover.test.tsx` | ✅ green |
| 34-02-05 | 02 | 2 | ONBD-05 | component | `pnpm --filter @contractor-ops/web test -- --run` | ✅ `apps/web/src/components/onboarding/__tests__/import-progress-tracker.test.tsx` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/api/src/routers/__tests__/onboarding-import.test.ts` — 16 tests covering ONBD-01 through ONBD-05 (backend)
- [x] `apps/web/src/components/onboarding/__tests__/*.test.tsx` — 85 tests across 9 files covering ONBD-01 through ONBD-05 (frontend)

*All Wave 0 requirements satisfied. Existing vitest infrastructure used for both packages.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-step wizard UI flow | ONBD-01 | Visual wizard interaction | Navigate onboarding, verify source selection renders with connected tool icons |
| Preview diff indicators | ONBD-04 | Visual rendering of new/duplicate/conflict badges | Import data, verify diff indicators display correctly in preview table |
| Progress bar during async import | ONBD-05 | Real-time UI update via polling/SSE | Start import, verify progress bar updates and retry button appears on failure |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (backend: 353ms, frontend: 5.8s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-08

---

## Validation Audit 2026-04-08

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Backend tests | 16 passing |
| Frontend tests | 85 passing |
| Total automated tests | 101 |
| Requirements covered | 5/5 (ONBD-01 through ONBD-05) |
| Test files (backend) | 1 |
| Test files (frontend) | 9 |

### Coverage by Requirement

| Requirement | Backend Tests | Frontend Tests | Total | Status |
|-------------|--------------|----------------|-------|--------|
| ONBD-01 | 1 (listSources) + 4 (tier gating) | 9 (source-selection-step) + source-card | 14+ | COVERED |
| ONBD-02 | 4 (fetchPeople, mergeByEmail, Slack filter) | 15 (people-review-step) | 19 | COVERED |
| ONBD-03 | 2 (fetchProjects, importProjects) | 8 (project-import-step) | 10 | COVERED |
| ONBD-04 | 1 (batchImport) | 15 (people-review-step) + 2 (conflict-resolution-popover) | 18 | COVERED |
| ONBD-05 | 2 (startImport/getProgress, retryFailedItem) | 4 (import-progress-tracker) + 3 (confirm-import-step) | 9 | COVERED |
