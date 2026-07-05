# 92-09 SUMMARY — leave tRPC router (request/approval + direct sick + config + calendar)

**Status:** complete. Three Wave-0 HOLD tests turned GREEN.
**Plan:** 92-09 (wave 4)

## What shipped

**`routers/workforce/leave.ts` (`leaveRouter`)** — every procedure re-asserts the
workforce flag (`assertWorkforceEnabled`), is HR-RBAC gated on the `employee`
resource (reads → `employee:read`, mutations → `employee:update`; never
`invoice:approve`), Zod-validated, and audit-logs mutations inside the caller tx:

- `submitLeaveRequest` — one `$transaction`: find EMPLOYEE worker → active leave
  type → **blackout overlap guard** (BAD_REQUEST on any org-wide or same-team
  overlap) → **balance guard** (`computeLeaveBalance` of the ledger; BAD_REQUEST
  when requested > available) → `routeToLeaveChain` (BAD_REQUEST if no chain) →
  create `LeaveRequest` PENDING → `createApprovalFlow({resourceType:'LEAVE_REQUEST'})`
  → back-link `approvalFlowId` → `writeAuditLog('leave.request.submitted')`.
  Post-commit: dispatch `APPROVAL_REQUEST` (entityType `LEAVE_REQUEST`) to the
  first step's approver. **No approve/reject here** — delegated to the Plan-07
  resourceType-gated shared approval procedures (the BFLA fence).
- `recordSickAbsence` — DIRECT absence: resolve the org SICK leave type, insert a
  negative `DEDUCTION` ledger row on that type (own ledger, never touches annual),
  recompute its balance cache, `writeAuditLog('leave.sick.recorded')`. Creates
  ZERO ApprovalFlow rows. Post-commit dispatches a plain `LEAVE_SICK_RECORDED`
  notification to the org's leave approvers (`hr_admin` + `leave_approver`), never
  `APPROVAL_REQUEST`.
- `getBalance` (optionally year-scoped) + `listRequests` (paginated) reads.
- `leaveType.list/upsert/archive` + `blackout.list/upsert/delete` org-config CRUD,
  all flag + RBAC + audit gated.
- `listTeamCalendar({from,to,teamId?})` — per-day capacity per same-team bucket +
  a `conflict` flag on ≥2 overlapping same-team requests + seeded `PublicHoliday`
  rows (scoped to the org's countryCode when set). Read-only.

## Drift reconciled (as flagged by the prior stream)

1. **LeaveType `code` / `colorHex`.** `leaveTypeUpsertInput` carried a `colorHex`
   the schema lacks and omitted the schema-required `code`. Reconciled by
   **dropping `colorHex`** from the validator (the UI-SPEC color system is
   status/semantic-token based, never per-type hex — confirmed in 92-UI-SPEC.md
   §Color) and **deriving `code` deterministically** from the name (upper-snake
   slug, bounded to 40 chars) in the upsert. No schema/migration change.
2. **Notification chain (required for 09 to typecheck).**
   - `@contractor-ops/validators` NOTIFICATION_TYPES += `LEAVE_SICK_RECORDED`.
   - notification-service LOCAL `EntityType` union += `LEAVE_REQUEST`,
     `EMPLOYEE_TIME_RECORD` (`ENTITY_ROUTES` already listed them; the union did
     not). `AuditEntityType` already carried both (added in 92-07).
   - Sick/leave notifications pass literal copy (resolveEventCopy passes
     non-dotted strings through). `LEAVE_SICK_RECORDED` has no email template —
     consistent with the existing template-less types (classification.*,
     compliance.*, tax.*); the email path is best-effort and the in-app
     notification is the primary channel.
   - New `errors.ts` keys: `LEAVE_WORKER_NOT_FOUND`, `LEAVE_TYPE_NOT_FOUND`,
     `LEAVE_SICK_TYPE_NOT_CONFIGURED`, `LEAVE_BLACKOUT_OVERLAP`,
     `LEAVE_INSUFFICIENT_BALANCE`, `LEAVE_NO_CHAIN_CONFIGURED`,
     `LEAVE_REQUEST_NOT_FOUND`, `BLACKOUT_PERIOD_NOT_FOUND`.

## OQ4 decision (same-team grouping)

Team grouping keys on **`LeaveRequest.teamId`** (the requester's team snapshot at
submit time). `EmployeeProfile` carries no direct team link, so a null `teamId`
falls into a shared **"unassigned"** bucket. The calendar counts approved+pending
per bucket per day and flags a conflict at ≥2 overlapping same-team requests.

## HOLD tests turned GREEN (3 of 5)

Rewrote the three Wave-0 `describe.skip` scaffolds as real tests over a
`createCaller(leaveRouter)` harness (mirrors `routers/__tests__/approval.test.ts`):
the mocked ctx runs the REAL flag + RBAC + `$transaction` control flow; only the
I/O boundaries (Prisma delegates, approval-engine, dispatch, cache/logger/sentry)
are mocked — the assertions verify real branching, not a faked pass.

- `leave-approval` GREEN (3): submit calls `createApprovalFlow` with
  `resourceType='LEAVE_REQUEST'` + creates a PENDING request; `finalizeApprovedLeave`
  (Plan 07, tested directly with a mock tx) inserts the `-480` DEDUCTION,
  recomputes the cache, and writes `leave.approved`.
- `leave-sick-direct` GREEN (4): direct DEDUCTION ledger row, `LEAVE_SICK_RECORDED`
  (never `APPROVAL_REQUEST`), zero ApprovalFlow (`createApprovalFlow` not called),
  audit `leave.sick.recorded`.
- `leave-blackout` GREEN (3): blackout overlap → BAD_REQUEST; over-balance →
  BAD_REQUEST; clear request routes to the chain.

**Still SKIPPED (documented HOLD):** `leave-approval-rbac` (the Blocker-1
resourceType RBAC contract) — this exercises the Plan-07 SHARED approval
procedures, not the leave router. It needs a role-session integration harness (a
`leave_approver`-only vs `invoice`-only session over a seeded LEAVE_REQUEST vs
INVOICE flow) that the current caller/mock harness does not model. The gate itself
is proven by api typecheck + the invoice-approval regression suite (per 92-07).
`wt-limit-scan` remains for Plan 10.

## Verification

- `pnpm --filter @contractor-ops/db build` — clean.
- `pnpm --filter @contractor-ops/api typecheck` — clean (db rebuilt first).
- `pnpm --filter @contractor-ops/validators typecheck` — clean.
- `pnpm --filter @contractor-ops/api test leave-approval leave-sick-direct leave-blackout`
  — 10 passed, 3 skipped (the rbac HOLD).
- `pnpm --filter @contractor-ops/api test approval notification leave` — 161
  passed, 3 skipped, 0 failed (invoice-approval + notification regression intact).
- `pnpm lint:no-breadcrumbs` — my files clean (pre-existing 92-06/07/08 test-header
  req-IDs remain repo-wide debt, out of this plan's scope / owed by the v6
  standards audit).

## Notes

- No new migrations in this plan (router only). No new deps.
- Statutory copy stays adviser-verify per the LOCAL-ONLY posture (post-deploy
  legal checkpoint).
