---
phase: 14-portal-self-service-branding
plan: 01
subsystem: api
tags: [prisma, trpc, change-request, notification-preferences, branding, portal]

requires:
  - phase: 13-contractor-portal-auth-core-views
    provides: "Portal auth middleware (portalProcedure), portal router, PortalSession model"
provides:
  - "ContractorChangeRequest and ContractorNotificationPreference Prisma models"
  - "Change request service (create/approve/reject with transactional approval)"
  - "6 portal endpoints: getProfile, updateContactInfo, submitFinancialChangeRequest, getNotificationPreferences, updateNotificationPreference, getOrgBranding"
  - "3 admin endpoints: updateBranding, listChangeRequests, reviewChangeRequest"
affects: [14-02, 14-03]

tech-stack:
  added: []
  patterns:
    - "Financial field changes via approval workflow (ContractorChangeRequest JSON diff)"
    - "Contractor notification preferences with immutable SECURITY_ALERTS category"
    - "Organization branding via settingsJson merge pattern"

key-files:
  created:
    - packages/api/src/services/portal-change-request.ts
  modified:
    - packages/db/prisma/schema/portal.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/api/src/routers/portal.ts
    - packages/api/src/routers/settings.ts

key-decisions:
  - "Followed existing bank account pattern (whitespace-stripped storage + masked last 4 digits) for change request encryption"
  - "Used non-null assertion for ctx.user in tenantProcedure-guarded endpoints (tenantProcedure guarantees user exists)"

patterns-established:
  - "ContractorChangeRequest JSON diff pattern: requestedChanges + previousValues for audit trail"
  - "Notification preference defaults: return all 5 categories with emailEnabled:true for missing rows"
  - "Portal branding: brandColor stored in org settingsJson, logo in org.logo field"

requirements-completed: [PORT-06, PORT-07, PORT-08]

duration: 4min
completed: 2026-03-23
---

# Phase 14 Plan 01: Portal Self-Service API Summary

**Two Prisma models (change request + notification prefs), change request service with transactional approval, 6 portal endpoints, and 3 admin endpoints for contractor self-service and org branding**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T20:00:39Z
- **Completed:** 2026-03-23T20:05:36Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ContractorChangeRequest model with PENDING/APPROVED/REJECTED enum and JSON diff fields for financial field change tracking
- ContractorNotificationPreference model with 5-category support, unique constraint per contractor+category
- Change request service with duplicate guard, transactional approval (billing profile update + status change), and reject flow
- Portal router extended with profile read, contact update (immediate), financial change request (approval required), notification preferences CRUD, and org branding read
- Settings router extended with branding save (hex color + logo URL), change request listing with contractor info, and approve/reject review endpoint
- bankAccountEncrypted never exposed in any portal select statement

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Prisma models + update relations** - `796040f` (feat)
2. **Task 2: Create change request service + extend routers** - `877e0b9` (feat)

## Files Created/Modified
- `packages/db/prisma/schema/portal.prisma` - ContractorChangeRequest, ContractorChangeRequestStatus enum, ContractorNotificationPreference models
- `packages/db/prisma/schema/contractor.prisma` - Added changeRequests and notificationPreferences relations
- `packages/db/prisma/schema/organization.prisma` - Added contractorChangeRequests and contractorNotificationPrefs relations
- `packages/db/prisma/schema/auth.prisma` - Added reviewedChangeRequests relation to User model
- `packages/api/src/services/portal-change-request.ts` - Create/approve/reject change request business logic
- `packages/api/src/routers/portal.ts` - 6 new portal endpoints for self-service
- `packages/api/src/routers/settings.ts` - 3 new admin endpoints for branding and change request review

## Decisions Made
- Followed existing bank account pattern (whitespace-stripped + masked last 4 digits) rather than introducing real encryption -- consistent with codebase convention
- Used `ctx.user!.id` non-null assertion in tenantProcedure-guarded endpoints since middleware guarantees authenticated user

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added User model relation for ContractorChangeRequest.reviewedBy**
- **Found during:** Task 1 (Prisma model creation)
- **Issue:** Plan specified reviewedBy User? relation on ContractorChangeRequest but did not mention adding the inverse relation to auth.prisma User model, which Prisma requires
- **Fix:** Added `reviewedChangeRequests ContractorChangeRequest[]` to User model in auth.prisma
- **Files modified:** packages/db/prisma/schema/auth.prisma
- **Verification:** Prisma generate succeeds
- **Committed in:** 796040f (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeScript type errors in service and settings router**
- **Found during:** Task 2 (endpoint implementation)
- **Issue:** Three type issues: (1) Prisma Json fields require InputJsonValue cast, (2) ctx.userId does not exist on tenant context (correct: ctx.user.id), (3) ctx.user possibly null requiring non-null assertion
- **Fix:** Added InputJsonValue cast for JSON fields, used ctx.user!.id with non-null assertion, typed settingsJson update correctly
- **Files modified:** packages/api/src/services/portal-change-request.ts, packages/api/src/routers/settings.ts
- **Verification:** `npx tsc --noEmit` passes with 0 errors
- **Committed in:** 877e0b9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## Known Stubs
None - all endpoints are wired to real Prisma queries with production data access patterns.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full API surface ready for Plan 02 (portal self-service UI) and Plan 03 (admin branding UI)
- All 6 portal endpoints available for frontend consumption
- All 3 admin endpoints available for settings page integration

---
*Phase: 14-portal-self-service-branding*
*Completed: 2026-03-23*

## Self-Check: PASSED
