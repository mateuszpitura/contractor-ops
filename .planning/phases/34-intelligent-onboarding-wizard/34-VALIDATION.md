---
phase: 34
slug: intelligent-onboarding-wizard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
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
| TBD | 01 | 1 | ONBD-01 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | ONBD-02 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| TBD | 02 | 1 | ONBD-03 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| TBD | 03 | 2 | ONBD-04 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| TBD | 03 | 2 | ONBD-05 | integration | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/routers/__tests__/onboarding-import.test.ts` — stubs for ONBD-01 through ONBD-05

*Existing infrastructure covers test framework — vitest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-step wizard UI flow | ONBD-01 | Visual wizard interaction | Navigate onboarding, verify source selection renders with connected tool icons |
| Preview diff indicators | ONBD-04 | Visual rendering of new/duplicate/conflict badges | Import data, verify diff indicators display correctly in preview table |
| Progress bar during async import | ONBD-05 | Real-time UI update via polling/SSE | Start import, verify progress bar updates and retry button appears on failure |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
