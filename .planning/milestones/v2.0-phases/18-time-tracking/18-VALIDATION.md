---
phase: 18
slug: time-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (workspace root) |
| **Quick run command** | `pnpm test --filter @contractor-ops/api -- --run` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --filter @contractor-ops/api -- --run`
- **After every plan wave:** Run `pnpm test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | TIME-01 | unit | `pnpm test --filter @contractor-ops/api -- --run -t "time-entry"` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | TIME-01 | unit | `pnpm test --filter @contractor-ops/api -- --run -t "timesheet"` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | TIME-02 | unit | `pnpm test --filter @contractor-ops/api -- --run -t "time-approval"` | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 2 | TIME-03 | unit | `pnpm test --filter @contractor-ops/api -- --run -t "clockify"` | ❌ W0 | ⬜ pending |
| 18-03-02 | 03 | 2 | TIME-04 | unit | `pnpm test --filter @contractor-ops/api -- --run -t "jira-worklog"` | ❌ W0 | ⬜ pending |
| 18-04-01 | 04 | 3 | TIME-05 | unit | `pnpm test --filter @contractor-ops/api -- --run -t "reconciliation"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/__tests__/time-entry.test.ts` — stubs for TIME-01 (manual time entry CRUD)
- [ ] `packages/api/src/__tests__/timesheet.test.ts` — stubs for TIME-01 (timesheet submission)
- [ ] `packages/api/src/__tests__/time-approval.test.ts` — stubs for TIME-02 (approve/reject flow)
- [ ] `packages/api/src/__tests__/clockify.test.ts` — stubs for TIME-03 (Clockify import)
- [ ] `packages/api/src/__tests__/jira-worklog.test.ts` — stubs for TIME-04 (Jira worklog import)
- [ ] `packages/api/src/__tests__/reconciliation.test.ts` — stubs for TIME-05 (invoice reconciliation)

*Existing infrastructure covers test framework — only test stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Timesheet grid renders correctly | TIME-01 | Visual layout | Open portal /time, verify Mon-Sun grid displays with project rows |
| Manager review table displays | TIME-02 | Visual layout | Open admin /time, verify pending timesheets table renders |
| Clockify OAuth flow completes | TIME-03 | External API redirect | Connect Clockify from admin settings, verify token stored |
| Jira OAuth flow completes | TIME-04 | External API redirect | Connect Jira from admin settings, verify token stored |
| Deviation flag visible on invoice | TIME-05 | Visual indicator | Submit invoice with hours mismatch, verify flag on invoice detail |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
