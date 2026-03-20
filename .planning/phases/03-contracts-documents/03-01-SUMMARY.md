---
phase: 03-contracts-documents
plan: 01
subsystem: api
tags: [trpc, zod, prisma, tsvector, fts, state-machine, contracts]

requires:
  - phase: 01-foundation-auth
    provides: tenantProcedure, requirePermission RBAC middleware, appRouter registration pattern
  - phase: 02-contractor-registry
    provides: contractor.ts router pattern (plain() helper, FTS via tsvector, LEGAL_TRANSITIONS)
provides:
  - Contract Zod validators (create, update, list, statusTransition, amendmentCreate, expiryReminder, orgExpiryReminderDefaults)
  - Contract tRPC router with 10 procedures (CRUD, list with FTS, status machine, amendments, expiry config)
  - Settings router expiry reminder defaults (getExpiryReminderDefaults, updateExpiryReminderDefaults)
  - Contract FTS tsvector migration with GIN index
affects: [03-contracts-documents, 04-workflow-engine, 05-invoice-pipeline]

tech-stack:
  added: []
  patterns: [contract-status-state-machine, per-contract-metadata-json-for-reminders, org-settings-json-for-defaults]

key-files:
  created:
    - packages/validators/src/contract.ts
    - packages/api/src/routers/contract.ts
    - packages/db/prisma/schema/migrations/20260320140000_add_contract_search_vector/migration.sql
  modified:
    - packages/validators/src/index.ts
    - packages/api/src/routers/settings.ts
    - packages/api/src/root.ts

key-decisions:
  - "contractUpdateSchema uses plain .partial() without .refine() to preserve type inference in tRPC input -- date validation moved to procedure"
  - "Org-level expiry reminder defaults stored in Organization.settingsJson under contractExpiryReminderDaysBefore key"
  - "Per-contract reminder overrides stored in Contract.metadataJson under reminderDaysBefore key"

patterns-established:
  - "CONTRACT_TRANSITIONS state machine map for contract status flow enforcement"
  - "Amendment auto-numbering via AME-{count+1} pattern"
  - "Organization.settingsJson for domain-specific org-level configuration"

requirements-completed: [CNTR-01, CNTR-03, CNTR-04, CNTR-05]

duration: 5min
completed: 2026-03-20
---

# Phase 03 Plan 01: Contract Backend Summary

**Contract tRPC router with 10 CRUD/list/status/amendment procedures, Zod validators, FTS tsvector migration, and org-level expiry reminder defaults in settings router**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T14:00:38Z
- **Completed:** 2026-03-20T14:06:17Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Contract Zod validators with 7 schemas covering create, update, list, status transition, amendment, per-contract reminders, and org-level defaults
- Contract tRPC router with full CRUD, paginated list with PostgreSQL tsvector FTS, state machine status transitions, amendments with auto-numbering, expiry reminder config, soft-delete, and bulk transitions
- Settings router extended with getExpiryReminderDefaults and updateExpiryReminderDefaults procedures using Organization.settingsJson
- FTS tsvector migration with GIN index for contract title, contractNumber, and notes search

## Task Commits

Each task was committed atomically:

1. **Task 1: Contract and amendment Zod validators + tsvector migration** - `edaff90` (feat)
2. **Task 2: Contract tRPC router with CRUD, list, status machine, amendments, expiry config, and org-level reminder defaults in settings** - `402252c` (feat)

## Files Created/Modified
- `packages/validators/src/contract.ts` - 7 Zod schemas for contract domain validation
- `packages/validators/src/index.ts` - Re-exports all contract schemas and types
- `packages/api/src/routers/contract.ts` - Contract tRPC router with 10 procedures
- `packages/api/src/routers/settings.ts` - Added expiry reminder defaults (get + update)
- `packages/api/src/root.ts` - Registered contractRouter in appRouter
- `packages/db/prisma/schema/migrations/20260320140000_add_contract_search_vector/migration.sql` - tsvector + GIN index migration

## Decisions Made
- Used plain `.partial()` for contractUpdateSchema without `.refine()` to preserve tRPC type inference -- endDate > startDate validation moved to the update procedure as a TRPCError check
- Org-level expiry reminder defaults stored in `Organization.settingsJson` under `contractExpiryReminderDaysBefore` key with fallback to `[30, 60, 90]`
- Per-contract reminder overrides stored in `Contract.metadataJson` under `reminderDaysBefore` key
- Used `displayName` instead of plan's `companyName` for contractor select (field does not exist)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed companyName to displayName in contractor select**
- **Found during:** Task 2 (Contract router implementation)
- **Issue:** Plan referenced `companyName` field on Contractor model, but the actual field is `displayName`
- **Fix:** Changed all contractor select clauses to use `displayName` instead of `companyName`
- **Files modified:** packages/api/src/routers/contract.ts
- **Verification:** TypeScript compiles without errors for contract.ts
- **Committed in:** 402252c (Task 2 commit)

**2. [Rule 1 - Bug] Fixed contractUpdateSchema type inference loss from .refine()**
- **Found during:** Task 2 (Contract router compilation)
- **Issue:** `z.object().partial().refine()` returns `ZodEffects` which loses property type inference when used as tRPC `.input()`, causing `input.data` to be typed as `unknown`
- **Fix:** Removed `.refine()` from contractUpdateSchema, moved date validation into the update procedure
- **Files modified:** packages/validators/src/contract.ts, packages/api/src/routers/contract.ts
- **Verification:** TypeScript compiles without errors, date validation still enforced
- **Committed in:** 402252c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct compilation. No scope creep.

## Issues Encountered
- Pre-existing compilation errors in `packages/api/src/routers/document.ts` (Permission type missing `documents` key). Logged to deferred-items.md -- out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Contract backend is complete and ready for UI plans (03-02 through 03-06)
- Contract router accessible as `trpc.contract.*` from client
- Settings router provides org-level expiry reminder defaults for configuration UI

## Self-Check: PASSED

All 6 files verified present. Both task commits (edaff90, 402252c) confirmed in git log.

---
*Phase: 03-contracts-documents*
*Completed: 2026-03-20*
