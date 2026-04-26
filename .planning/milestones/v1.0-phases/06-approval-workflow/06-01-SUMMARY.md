---
phase: 06-approval-workflow
plan: 01
subsystem: api
tags: [tRPC, zod, approval-workflow, state-machine, prisma, sla]

requires:
  - phase: 05-invoice-intake-matching
    provides: Invoice model with matchStatus, status fields, and invoice router patterns
  - phase: 01-foundation-auth
    provides: RBAC middleware, tenant middleware, permissions system
provides:
  - Zod validators for approval chain config CRUD, actions, and queue queries
  - Approval engine service with chain routing, flow creation, flow advancement, SLA computation
  - Complete approval tRPC router (14 procedures) registered in root
affects: [06-02, 06-03, 06-04, 06-05, 07-notifications]

tech-stack:
  added: []
  patterns: [approval-state-machine, chain-routing-first-match, sla-deadline-computation, bulk-operations-promise-allsettled]

key-files:
  created:
    - packages/validators/src/approval.ts
    - packages/api/src/services/approval-engine.ts
    - packages/api/src/routers/approval.ts
  modified:
    - packages/validators/src/index.ts
    - packages/api/src/root.ts

key-decisions:
  - "JSON.parse(JSON.stringify()) for stepsJson serialization to satisfy Prisma InputJsonValue type constraint"
  - "Member.role string field lookup for role-based approver resolution (not UserRole enum cast)"
  - "approverRole enum includes all 8 UserRole values from Prisma schema for flexibility"
  - "SLA percentage computed from slaHours config (passed explicitly) rather than inferring from createdAt"

patterns-established:
  - "Approval engine as pure service functions (evaluateConditions, routeToChain, createApprovalFlow, advanceFlow, computeSlaStatus) called from router within $transaction"
  - "Canonical SLA breach event shape: { type: system, label: sla_breached, levelName: step.name, timestamp: step.slaDeadline.toISOString() }"
  - "Bulk operations via Promise.allSettled with individual $transaction per item, returning { succeeded, failed, errors }"

requirements-completed: [APPR-01, APPR-02, APPR-05, APPR-07, APPR-08, APPR-09, ORG-08]

duration: 5min
completed: 2026-03-21
---

# Phase 06 Plan 01: Approval Backend Summary

**Approval engine with configurable chain routing, 4-action state machine (approve/reject/delegate/clarify), SLA computation, and 14-procedure tRPC router including bulk ops and audit trail**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T22:16:14Z
- **Completed:** 2026-03-21T22:21:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Approval engine service with chain routing (first-match + default fallback), flow creation with step snapshotting, flow advancement, and SLA computation
- Complete tRPC router: 5 chain CRUD procedures, queue query with SLA enrichment, 4 approval actions, 2 bulk operations, submit-for-approval, and audit trail
- All state transitions wrapped in prisma.$transaction for atomicity
- TypeScript compiles cleanly across both validators and api packages

## Task Commits

Each task was committed atomically:

1. **Task 1: Approval validators and engine service** - `2aa7e8f` (feat)
2. **Task 2: Approval tRPC router with chain CRUD, actions, queue, and audit trail** - `7f7d8ad` (feat)

## Files Created/Modified
- `packages/validators/src/approval.ts` - Zod schemas for chain config, conditions, steps, actions, queue, bulk ops
- `packages/validators/src/index.ts` - Barrel export for approval validators
- `packages/api/src/services/approval-engine.ts` - Pure functions: evaluateConditions, routeToChain, createApprovalFlow, advanceFlow, computeSlaStatus
- `packages/api/src/routers/approval.ts` - 14-procedure tRPC router: chain CRUD, queue, actions, bulk ops, submit, audit trail
- `packages/api/src/root.ts` - Registered approvalRouter in root router

## Decisions Made
- JSON.parse(JSON.stringify()) for stepsJson to satisfy Prisma's InputJsonValue type (same pattern as conditionsJson in workflow router)
- Member.role lookup for role-based approver resolution -- uses string comparison since Member.role is a String field (not the UserRole enum)
- approverRole validator includes all 8 UserRole values from Prisma schema, not just the 4 originally planned (ADMIN, FINANCE_ADMIN, OPS_MANAGER, TEAM_MANAGER)
- SLA percentage computed by passing slaHours explicitly to computeSlaStatus rather than inferring activation time

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed approverRole enum values to match Prisma UserRole**
- **Found during:** Task 1 (validator creation)
- **Issue:** Plan specified "ADMIN" but Prisma UserRole enum uses "ORG_ADMIN". Also expanded to include all 8 roles.
- **Fix:** Used exact Prisma UserRole enum values in stepConfigSchema
- **Files modified:** packages/validators/src/approval.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 2aa7e8f (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed bulk operations input access pattern**
- **Found during:** Task 2 (router creation)
- **Issue:** Initial code used ctx.input which doesn't exist in tRPC -- input is destructured from second parameter
- **Fix:** Changed to destructured { ctx, input } pattern matching all other procedures
- **Files modified:** packages/api/src/routers/approval.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 7f7d8ad (Task 2 commit)

**3. [Rule 3 - Blocking] Fixed Prisma InputJsonValue type constraint for stepsJson**
- **Found during:** Task 2 (router creation)
- **Issue:** Record<string, unknown>[] cast failed Prisma type check for Json fields
- **Fix:** Used JSON.parse(JSON.stringify()) pattern to produce plain JSON that satisfies InputJsonValue
- **Files modified:** packages/api/src/routers/approval.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 7f7d8ad (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all procedures are fully wired to Prisma database operations.

## Next Phase Readiness
- Approval backend complete, ready for UI plans (06-02 through 06-05)
- All 14 router procedures available for frontend consumption via tRPC client
- Audit trail with canonical SLA breach event shape ready for Plan 05 verification

---
*Phase: 06-approval-workflow*
*Completed: 2026-03-21*
