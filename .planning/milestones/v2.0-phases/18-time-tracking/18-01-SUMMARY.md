---
phase: 18-time-tracking
plan: 01
subsystem: database, api
tags: [prisma, zod, time-tracking, status-machine, timesheet]

requires:
  - phase: 12-integration-foundation
    provides: IntegrationProvider enum, IntegrationConnection model
provides:
  - Timesheet + TimeEntry Prisma models with status lifecycle
  - TimesheetStatus and TimeEntrySource enums
  - CLOCKIFY IntegrationProvider, TIMESHEET EntityType
  - Zod validators for all time tracking operations (12 schemas)
  - Time entry service with status machine (DRAFT->SUBMITTED->APPROVED/REJECTED)
affects: [18-02, 18-03, 18-04, 18-05]

tech-stack:
  added: []
  patterns: [optimistic-locking-via-updateMany, inline-iso-monday-helper, integer-minutes-storage]

key-files:
  created:
    - packages/db/prisma/schema/time-tracking.prisma
    - packages/validators/src/time-tracking.ts
    - packages/api/src/services/time-entry.ts
  modified:
    - packages/db/prisma/schema/integration.prisma
    - packages/db/prisma/schema/contract.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/validators/src/index.ts

key-decisions:
  - "Inline ISO Monday helper instead of date-fns dependency (matches Phase 4 convention)"
  - "PrismaClient type annotation on transaction callback to avoid implicit any"

patterns-established:
  - "Optimistic locking: updateMany with status where clause for concurrent-safe state transitions"
  - "Integer minutes storage: all time values stored as minutes (Int), not hours (Decimal/Float)"
  - "Imported entry protection: source !== MANUAL entries are read-only"

requirements-completed: [TIME-01, TIME-02]

duration: 6min
completed: 2026-03-28
---

# Phase 18 Plan 01: Database Schema + Validators + Service Summary

**Timesheet/TimeEntry Prisma models with DRAFT->SUBMITTED->APPROVED/REJECTED status machine, 12 Zod validators, and core service layer using optimistic locking**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-27T23:18:25Z
- **Completed:** 2026-03-27T23:24:11Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Timesheet + TimeEntry models in database with weekly unique constraint and source tracking
- CLOCKIFY added to IntegrationProvider, TIMESHEET to EntityType
- 12 Zod validators covering draft saves, submissions, approvals, rejections, bulk ops, external sync, and reconciliation
- Time entry service with full status machine, optimistic locking, and imported entry protection

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema for Timesheet + TimeEntry models and enum extensions** - `4ca3bc9` (feat)
2. **Task 2: Zod validators and time entry service with status machine** - `e788815` (feat)

## Files Created/Modified
- `packages/db/prisma/schema/time-tracking.prisma` - Timesheet, TimeEntry models, TimesheetStatus, TimeEntrySource enums
- `packages/db/prisma/schema/integration.prisma` - Added CLOCKIFY to IntegrationProvider
- `packages/db/prisma/schema/contract.prisma` - Added TIMESHEET to EntityType, timeEntries relation on Contract
- `packages/db/prisma/schema/organization.prisma` - Added timesheets/timeEntries relations
- `packages/db/prisma/schema/contractor.prisma` - Added timesheets/timeEntries relations
- `packages/db/prisma/schema/auth.prisma` - Added reviewedTimesheets relation on User
- `packages/validators/src/time-tracking.ts` - 12 Zod schemas with inferred types
- `packages/validators/src/index.ts` - Re-exports for time-tracking module
- `packages/api/src/services/time-entry.ts` - Core service with status machine and optimistic locking

## Decisions Made
- Inlined ISO Monday calculation helper instead of adding date-fns dependency (follows Phase 4 convention of avoiding external date lib dependency in API package)
- Used explicit PrismaClient type on transaction callback parameter to satisfy strict typing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree missing helpers.ts file causing validators build to fail on pre-existing imports (not related to this plan's changes). The new time-tracking.ts file compiles cleanly in isolation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Database schema ready for tRPC router (Plan 02)
- Validators ready for input validation in router procedures
- Service layer ready for portal and admin UI integration (Plans 03-05)

---
*Phase: 18-time-tracking*
*Completed: 2026-03-28*
