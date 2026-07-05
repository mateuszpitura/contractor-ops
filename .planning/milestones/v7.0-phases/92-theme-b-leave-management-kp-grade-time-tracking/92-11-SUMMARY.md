# 92-11 SUMMARY — employee-time + ewidencja routers + workforce mount

**Status:** complete. The workforce-flag test is GREEN for all three new namespaces.
**Plan:** 92-11 (wave 5)

## What shipped

**`routers/workforce/employee-time.ts` (`employeeTimeRouter`)**
- `upsertRecord` (input `upsertEmployeeTimeRecordInput`): upserts the day-grain
  `EmployeeTimeRecord` on `(organizationId, workerId, workDate)`, writes the audit
  row, then runs the **synchronous** `checkWtLimits(jurisdiction, record,
  recentWeekMinutes)` and returns `{ record, findings }`. Jurisdiction resolves
  from `EmployeeProfile.countryCode` via `mapCountryCodeToJurisdiction`;
  `recentWeekMinutes` is the ISO-week (Mon–Sun) worked-minutes sum including the
  saved row. **Findings are a non-blocking warning payload — a breach never
  throws** (the save has already committed).
- `listRecords` (worker + date range) and `weekSummary` (ISO-week totals) reads.

**`routers/workforce/ewidencja.ts` (`ewidencjaRouter`)** — PL KP §149 register:
- `generate({workerId, periodStart, periodEnd})`: in one tx, `buildEwidencjaSnapshot`
  + **INSERT-only** `supersedeAndInsertEwidencja` (a new `version` row +
  `previousSnapshotId`, never an UPDATE of a prior row — the append-only trigger
  forbids UPDATE) + `writeAuditLog('ewidencja.generated')`. Returns `{id, version,
  periodKey}`.
- `list` (per worker, optional periodKey) + `get` (the current register = highest
  `version` row) reads.

Both routers: `assertWorkforceEnabled` first, HR-RBAC (reads → `employee:read`
[payroll_officer + all HR]; mutations → `employee:update` [hr_admin/hr_manager]),
Zod inputs, audited mutations, no `console.*`.

**Mount (`root.ts`):** `leave`, `employeeTime`, `ewidencja` added to the
`workforceRouters` const (imported directly from `./routers/workforce/*`), so they
inherit the `isWorkforceRegistered()` conditional spread — present in appRouter
only when `module.workforce-employees` is on (or `QA_DEFAULT_ORG_ID` set),
`METHOD_NOT_FOUND` otherwise. The spread TYPE stays constant across branches, so
client typing always sees the namespaces. `contractor.*` is unchanged.

**Supporting additions:** `errors.ts` += `EMPLOYEE_WORKER_NOT_FOUND`;
`audit-writer.ts` `AuditEntityType` += `EWIDENCJA_SNAPSHOT`.

## Tests

- `workforce-flag.test.ts` extended: `WORKFORCE_NAMESPACES` now also asserts
  `leave.` / `employeeTime.` / `ewidencja.` are absent when the flag is OFF and
  present when ON; `contractor.*` unaffected. GREEN.
- New `workforce-time-router.test.ts` (createCaller harness, real
  compliance-policy + wt-limit-check + ewidencja-builder over mocked I/O): a DE
  660-minute day returns a daily-ceiling **breach finding without throwing**;
  `ewidencja.generate` calls `ewidencjaSnapshot.create` **once**, never
  `update`/`updateMany`, returns version 1 + periodKey `2026-01`, and writes the
  `ewidencja.generated` audit. GREEN.
- `employee-time-record` + `ewidencja-builder` service tests still GREEN.

## Verification

- `pnpm --filter @contractor-ops/api typecheck` — clean.
- `pnpm --filter @contractor-ops/api test workforce-flag employee-time-record ewidencja-builder workforce-time-router`
  — all GREEN.
- `pnpm lint:no-breadcrumbs` — my files clean.

## Notes

- No new migrations, no new deps.
- RBAC choice recorded: ewidencja `generate` gates on `employee:update`
  (hr_admin/hr_manager) while `list`/`get` gate on `employee:read` (payroll_officer
  + all HR read the frozen register; generating it is an HR-admin action).
