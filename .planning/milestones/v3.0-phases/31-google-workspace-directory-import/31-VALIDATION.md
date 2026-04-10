---
phase: 31
slug: google-workspace-directory-import
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-02
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (workspace root) |
| **Quick run command** | `pnpm test --filter=@contractor-ops/api --filter=@contractor-ops/integrations` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --filter=@contractor-ops/api --filter=@contractor-ops/integrations`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Wave 0 Plan

31-00-PLAN.md creates all 4 test stub files before implementation begins:
- `packages/integrations/src/__tests__/google-workspace-adapter.test.ts` (GOOG-01)
- `packages/integrations/src/__tests__/google-workspace-directory.test.ts` (GOOG-02, GOOG-04)
- `packages/api/src/__tests__/google-workspace-sync.test.ts` (GOOG-03, GOOG-05)
- `packages/validators/src/__tests__/google-workspace.test.ts` (Zod schemas)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-00-01 | 00 | 0 | GOOG-01/02/04 | stub | `pnpm test --filter=@contractor-ops/integrations` | W0 creates | pending |
| 31-00-02 | 00 | 0 | GOOG-03/05 | stub | `pnpm test --filter=@contractor-ops/api --filter=@contractor-ops/validators` | W0 creates | pending |
| 31-01-01 | 01 | 1 | GOOG-01 | unit | `pnpm test --filter=@contractor-ops/integrations` | W0 | pending |
| 31-01-02 | 01 | 1 | GOOG-01/02/03/04 | unit | `pnpm test --filter=@contractor-ops/api` | W0 | pending |
| 31-02-01 | 02 | 2 | GOOG-02 | tsc | `pnpm --filter web exec tsc --noEmit` | n/a (UI) | pending |
| 31-02-02 | 02 | 2 | GOOG-02/03/04 | tsc | `pnpm --filter web exec tsc --noEmit` | n/a (UI) | pending |
| 31-03-01 | 03 | 2 | GOOG-05 | unit | `pnpm test --filter=@contractor-ops/api -- --grep "directory-sync"` | W0 | pending |
| 31-03-02 | 03 | 2 | GOOG-05 | tsc | `pnpm --filter web exec tsc --noEmit` | n/a | pending |

*Status: pending -- updated during execution*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth consent screen | GOOG-01 | Requires real Google admin account | Connect Google Workspace in settings, verify Admin SDK scopes requested |
| Import wizard UX flow | GOOG-02, GOOG-03 | Visual/interaction testing | Preview directory, select users, assign roles, confirm import |
| Sync notifications | GOOG-05 | Requires time-based trigger | Trigger manual sync, verify new hire/departure notifications appear |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (31-00-PLAN.md)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [ ] `wave_0_complete: true` set after 31-00 execution

**Approval:** pending execution
