---
status: complete
phase: 92-theme-b-leave-management-kp-grade-time-tracking
source:
  - 92-01 + 92-06..16 SUMMARY.md (12 recorded)
  - 92-02..05 built-but-untracked (reconciled — schemas/enums/ewidencja/registries; UAE+KSA leave/WT gap closed this session)
started: 2026-07-06
updated: 2026-07-06
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill running server, start fresh. Leave/employee-time/ewidencja migrations apply; /leave loads live behind module.workforce-employees with no errors.
result: pass

### 2. Leave request rides the generic approval chain
expected: submitLeaveRequest creates an ApprovalFlow (resourceType=LEAVE_REQUEST); approve/reject happens in the existing /approvals inbox — no leave-specific approval fork. Blackout overlap + insufficient balance rejected at submit.
result: pass

### 3. Leave balance = append-only ledger fold
expected: Balance = Σ LeaveLedgerEntry.minutes (LeaveLedgerEntry is append-only). Corrections are reversing ADJUSTMENT rows, never edits. Balance compute never throws on missing entitlement.
result: pass

### 4. Sick absence is direct (no approval)
expected: recordSickAbsence writes a negative DEDUCTION row + dispatches LEAVE_SICK_RECORDED to approver roles; zero ApprovalFlow rows.
result: pass

### 5. Team calendar conflict heatmap
expected: listTeamCalendar buckets PENDING/APPROVED per team; a day flags conflict when ≥2 overlap; three-tier signal (nobody out / someone out / conflict), RTL-mirrored, keyboard nav.
result: pass

### 6. Employee time is a distinct day-grain model
expected: EmployeeTimeRecord (one row per worker per workDate) keyed on workerId — separate from contractor TimeEntry. web-vite calls employeeTime.*, never time.* (check:web-vite-data-layer enforces).
result: pass

### 7. On-save working-time check is non-blocking
expected: upsertRecord returns {record, findings}; the sync per-jurisdiction checkWtLimits flags daily-ceiling/current-week breaches as advisory findings (dotted i18n keys) — never throws, save always commits.
result: pass

### 8. WT daily rolling scan → digest
expected: runWtLimitScan (in the reminders cron) fans out over regions, computes per-worker rolling weekly averages, dispatches ONE employee.wt_limit_breach digest per recipient/day, deduped by a region-prefixed key.
result: pass

### 9. Ewidencja INSERT-only + DB-immutable
expected: generate freezes the KP §149 field set; regenerating INSERTs a superseding version (version+1 + previousSnapshotId); a BEFORE UPDATE trigger app.reject_ewidencja_update rejects any UPDATE at the DB. No edit/delete offered in UI.
result: pass

### 10. Per-market statutory leave + working-time rules
expected: PL/DE/UK/UAE/KSA each resolve an ANNUAL leave-accrual rule + a working-time limit (UAE 30d/48h/25-50% OT; KSA 21→30d/48h/50% OT). US resolves undefined (no federal floor → org policy). All values cited + PENDING legal review. (compliance-policy tests 61/61 green.)
result: pass

### 11. RBAC / BFLA fence on leave approval
expected: leave_approver / hr_admin action a LEAVE_REQUEST via employee:approve_leave and never gain invoice:approve — the resourceType→permission gate holds the fence.
result: pass

### 12. UI surfaces + states + i18n
expected: /leave, /leave/calendar, /employee-time, /employee-time/ewidencja render behind module.workforce-employees with loading/empty/error states, WCAG, and i18n parity (en/en-US/de/pl/ar-RTL).
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none]

## Notes

Reconciliation: 92 was "partial 12/16" — plans 02-05 were built-but-untracked (schemas/enums/ewidencja/
registries). A real gap in 92-05 (UAE/KSA statutory leave + working-time rules missing) was CLOSED this
session (commit 5cef9740f: UAE + KSA registered, US documented as correctly-absent, tests 61/61 green).
User accepted the verified surface via "pass all". Remaining accepted deferral: 92-06 live per-region
migration apply (human gate, EXTERNAL-ENABLEMENT).
