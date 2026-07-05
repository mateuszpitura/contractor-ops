# 92-01 SUMMARY — Wave-0 RED/HOLD test scaffolds

**Status:** complete
**Plan:** 92-01 (wave 1)

## What shipped

14 test files + 1 fixture module registering an automated contract for every
LEAVE-01..03 / TIME-EMP-01..03 behavior before implementation. Written fresh
(the prior partial 92-01 was discarded).

| File | Package | Disposition |
|------|---------|-------------|
| `__tests__/leave-registry.test.ts` | compliance-policy | GREEN (registry merged in 92-05) |
| `__tests__/wt-registry.test.ts` | compliance-policy | GREEN (registry merged in 92-05) |
| `services/__tests__/leave-balance.test.ts` | api | RED (Cannot-find-module → Plan 07) |
| `services/__tests__/wt-limit-check.test.ts` | api | RED (Cannot-find-module → Plan 08) |
| `services/__tests__/ewidencja-builder.test.ts` | api | RED (Cannot-find-module → Plan 08) |
| `services/__tests__/employee-time-record.test.ts` | api | GREEN (schema-shape, reads prisma DSL) |
| `services/__tests__/wt-limit-scan.test.ts` | api | HOLD skip (harness → Plan 10) |
| `__tests__/leave-approval.test.ts` | api | HOLD skip (router → Plan 07/09) |
| `__tests__/leave-approval-rbac.test.ts` | api | HOLD skip (Blocker-1 gate → Plan 07) |
| `__tests__/leave-sick-direct.test.ts` | api | HOLD skip (router → Plan 09) |
| `__tests__/leave-blackout.test.ts` | api | HOLD skip (router → Plan 09) |
| `__tests__/leave-time-cross-org-leak.test.ts` | api | GREEN (fake-client withTenantScope, 4 model families) |
| `__tests__/fixtures/employee-leave-fixtures.ts` | api | fixture module (pure builders, no P90 import) |
| `db/__tests__/ewidencja-immutable.test.ts` | db | RED (migration.sql absent → authored in Plan 06 completion) |
| `components/leave/__tests__/team-calendar.test.tsx` | web-vite | RED (missing component → Plan 13) |

## Key decisions

- **Blocker-1 RBAC contract** (`leave-approval-rbac`) registered as a `describe.skip`
  HOLD documenting all three directions (leave_approver→LEAVE_REQUEST succeeds;
  invoice-only→LEAVE_REQUEST forbidden; leave_approver→INVOICE forbidden). Plan 07
  builds the resourceType-aware gate; making the contract EXECUTE GREEN needs the
  role-session + approval-flow integration harness (flagged for Plan 07).
- **Cross-org leak** runs over 4 tenant model families (LeaveLedgerEntry,
  LeaveRequest, EmployeeTimeRecord, EwidencjaSnapshot) via the real
  `withTenantScope` over a fake base client — no live DB. `LeaveLedgerEntry` is in
  `APPEND_ONLY_MODELS`, so its cross-org mutation rejects via the append-only guard
  (asserted as `.rejects.toThrow()`), the others via P2025.
- **employee-time-record** and **ewidencja-immutable** are schema/migration
  file-reading contracts (mirror `auditlog-append-only.test.ts`) — deterministic,
  no generated client / live DB needed.
- Heavy router/scan integration tests are `describe.skip` HOLD scaffolds (visible
  in the run, tsc-clean — no missing imports at load) rather than terminal-RED, so
  they register the contract without a router harness that lands in later waves.

## Verification

- compliance-policy `leave-registry wt-registry`: 11 passed.
- api `employee-time-record leave-time-cross-org-leak`: 21 passed.
- api `leave-balance wt-limit-check ewidencja-builder`: RED (Cannot-find-module) as designed.
- api 5 integration/scan files: 17 tests skipped (HOLD), collected.
- web-vite `team-calendar`: RED (missing component import) as designed.
- db `ewidencja-immutable`: RED (migration.sql absent) as designed.
- tsc not bricked — every package's tsconfig excludes `src/**/__tests__`.
