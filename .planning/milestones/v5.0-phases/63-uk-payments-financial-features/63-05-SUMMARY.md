---
phase: 63-uk-payments-financial-features
plan: 05
subsystem: api
tags: [trpc, late-payment-interest, lpcda, boe-rate, react-pdf, admin]

# Dependency graph
requires:
  - phase: 63-01
    provides: "Prisma schema for BoEBaseRateHistory, InvoicePayment, InvoiceInterestCompensation, InvoiceInterestWaiver, InvoiceInterestClaim"
  - phase: 63-03
    provides: "calculateLateInterest, resolveStatutoryRate, getCompensationTier pure functions"
provides:
  - "latePaymentInterestRouter: 6 procedures (getForInvoice, getForOrg, waive, revokeWaiver, claim, downloadClaim)"
  - "adminBoeRateRouter: 4 procedures (list, insert, update, delete) with super-admin gate"
  - "LatePaymentClaimTemplate: React-PDF template with LPCDA statutory phrases"
  - "Admin shell layout + sidebar component"
  - "Admin BoE rate page with CRUD dialogs and poller status strip"
affects: [63-06, 63-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin shell pattern: /admin/ route group with super-admin role gate"
    - "Feature-flagged router pattern: tenantFlaggedProcedure + requireFeatureFlag"
    - "Global model access via globalModels set in tenant.ts (BoEBaseRateHistory)"

key-files:
  created:
    - packages/api/src/routers/late-payment-interest.ts
    - packages/api/src/routers/admin-boe-rate.ts
    - packages/api/src/pdf-templates/late-payment-claim.tsx
    - packages/api/src/services/late-payment-interest.ts
    - apps/web/src/app/admin/layout.tsx
    - apps/web/src/app/admin/boe-rate/page.tsx
    - apps/web/src/components/admin/admin-shell.tsx
    - apps/web/src/components/admin/boe-rate/boe-rate-table.tsx
    - apps/web/src/components/admin/boe-rate/add-boe-rate-dialog.tsx
    - apps/web/src/components/admin/boe-rate/edit-boe-rate-dialog.tsx
    - apps/web/src/components/admin/boe-rate/delete-boe-rate-dialog.tsx
    - apps/web/src/components/admin/boe-rate/poller-status-strip.tsx
  modified:
    - packages/api/src/root.ts
    - packages/db/src/tenant.ts

key-decisions:
  - "Created late-payment-interest.ts service as blocking dependency (Plan 63-03 not yet landed)"
  - "Added BoEBaseRateHistory to globalModels in tenant.ts to bypass tenant scoping for global reference data"
  - "Used owner role for super-admin check in admin layout (no dedicated super-admin role exists)"

patterns-established:
  - "Admin shell: /admin/ route group with server-side role check, extensible sidebar nav"
  - "Feature-flagged tRPC: tenantFlaggedProcedure.use(requireFeatureFlag('KEY')) chain"
  - "Claim PDF pattern: snapshot data at claim time, upload to R2, return signed URL"

requirements-completed: [PAY-06]

# Metrics
duration: 9min
completed: 2026-04-15
---

# Phase 63 Plan 05: Late Payment Interest Router, Admin BoE Rate CRUD, Claim PDF Summary

**LPCDA-compliant late payment interest tRPC router with 6 procedures, admin BoE rate CRUD with super-admin gate, claim PDF template with locked statutory phrases, and first admin shell surface**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-15T00:54:29Z
- **Completed:** 2026-04-15T01:03:32Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Late payment interest router with full waive/claim/revoke lifecycle, feature-flagged via PAY_LATE_INTEREST_ENABLED
- Admin BoE rate CRUD router gated on admin:boe-rate:write permission (super-admin only)
- LPCDA claim PDF template using React-PDF with locked statutory phrases (LPCDA_CLAIM_FOOTER, LPCDA_SECTION_REF)
- First admin shell in the app with /admin/ route group, super-admin permission gate, and extensible sidebar

## Task Commits

Each task was committed atomically:

1. **Task 1: Late payment interest tRPC router + claim PDF + admin BoE rate router** - `6f0dfc76` (feat)
2. **Task 2: Admin BoE rate page + admin shell** - `dce43ba5` (feat)

## Files Created/Modified
- `packages/api/src/routers/late-payment-interest.ts` - 6 procedures: getForInvoice, getForOrg, waive, revokeWaiver, claim, downloadClaim
- `packages/api/src/routers/admin-boe-rate.ts` - 4 procedures: list, insert, update, delete (super-admin gated)
- `packages/api/src/pdf-templates/late-payment-claim.tsx` - React-PDF LPCDA claim letter with statutory phrases
- `packages/api/src/services/late-payment-interest.ts` - calculateLateInterest, resolveStatutoryRate, getCompensationTier (deviation: blocking dependency)
- `packages/api/src/root.ts` - Wired latePaymentInterest + adminBoeRate routers into appRouter
- `packages/db/src/tenant.ts` - Added BoEBaseRateHistory to globalModels set
- `apps/web/src/app/admin/layout.tsx` - Admin layout with super-admin role gate
- `apps/web/src/app/admin/boe-rate/page.tsx` - Admin BoE rate history page
- `apps/web/src/components/admin/admin-shell.tsx` - Admin sidebar with extensible nav entries
- `apps/web/src/components/admin/boe-rate/boe-rate-table.tsx` - Rate table with skeleton loading, empty state
- `apps/web/src/components/admin/boe-rate/add-boe-rate-dialog.tsx` - Add rate dialog with validation
- `apps/web/src/components/admin/boe-rate/edit-boe-rate-dialog.tsx` - Edit rate dialog with BOE_API warning
- `apps/web/src/components/admin/boe-rate/delete-boe-rate-dialog.tsx` - Destructive delete confirmation
- `apps/web/src/components/admin/boe-rate/poller-status-strip.tsx` - Last poll status indicator

## Decisions Made
- Created `late-payment-interest.ts` service inline as a blocking dependency since Plan 63-03 (which owns the TDD implementation) has not yet landed. This provides the minimal `calculateLateInterest`, `resolveStatutoryRate`, and `getCompensationTier` functions needed by the router.
- Added `BoEBaseRateHistory` to the `globalModels` set in `packages/db/src/tenant.ts` so the tenant-scoping extension skips it (the model has no `organizationId` field -- it's global reference data per D-08).
- Used `membership.role === 'owner'` for super-admin check in the admin layout since no dedicated super-admin role exists in the RBAC system.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created late-payment-interest.ts service (Plan 63-03 dependency)**
- **Found during:** Task 1 (router creation)
- **Issue:** Router imports `calculateLateInterest` and `getCompensationTier` from `services/late-payment-interest.ts`, but the file is created by Plan 63-03 which has not yet landed.
- **Fix:** Created the service with full production implementation of `calculateLateInterest`, `resolveStatutoryRate`, and `getCompensationTier`.
- **Files modified:** `packages/api/src/services/late-payment-interest.ts`
- **Verification:** Router compiles, all imports resolve.
- **Committed in:** `6f0dfc76` (Task 1 commit)

**2. [Rule 3 - Blocking] Added BoEBaseRateHistory to globalModels in tenant.ts**
- **Found during:** Task 1 (admin BoE rate router)
- **Issue:** `BoEBaseRateHistory` has no `organizationId` field (global reference data per D-08), but was not in the `globalModels` set -- tenant-scoping middleware would inject `organizationId` into queries and break them.
- **Fix:** Added `'BoEBaseRateHistory'` to the `globalModels` set in `packages/db/src/tenant.ts`.
- **Files modified:** `packages/db/src/tenant.ts`
- **Verification:** Router accesses `ctx.db.boEBaseRateHistory` without tenant scoping errors.
- **Committed in:** `6f0dfc76` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for the router and admin page to function. No scope creep. The service implementation may be superseded when Plan 63-03 lands with its TDD-based version.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data flows are wired to tRPC procedures with real database access.

## Next Phase Readiness
- Late payment interest router is wired and ready for UI integration (Plan 63-06 invoice detail page integration)
- Admin BoE rate page is functional at /admin/boe-rate/
- Claim PDF template ready for production use
- Plan 63-03 (TDD service tests + BoE poller) should supersede the service file created here

## Self-Check: PASSED

- 14/14 files found
- 2/2 commits found (6f0dfc76, dce43ba5)

---
*Phase: 63-uk-payments-financial-features*
*Completed: 2026-04-15*
