---
phase: 13-contractor-portal-auth-core-views
plan: 02
subsystem: api
tags: [trpc, portal, middleware, cookie-auth, magic-link, invoices, contracts]

requires:
  - phase: 13-contractor-portal-auth-core-views
    plan: 01
    provides: PortalSession model, portal-session.ts, portal-magic-link.ts services
provides:
  - portalProcedure middleware authenticating via portal_session cookie
  - portalPublicProcedure for unauthenticated portal endpoints
  - Complete portal tRPC router with 15 endpoints
  - Portal router merged into appRouter
affects: [13-03, 13-04, 13-05, portal-frontend]

tech-stack:
  added: []
  patterns: [portal cookie auth middleware, double-scoped queries (org + contractorId), anti-email-enumeration pattern]

key-files:
  created:
    - packages/api/src/middleware/portal-auth.ts
    - packages/api/src/routers/portal.ts
  modified:
    - packages/api/src/root.ts

key-decisions:
  - "Raw prisma client used in portal router (same pattern as all other routers) with explicit organizationId in creates"
  - "Organization fetched separately in getSession since validatePortalSession only includes contractor"
  - "ActivityEntry interface exported to satisfy TS2742 appRouter type inference"
  - "PaymentRunItem.markedPaidAt used as paidAt for payment history (matching existing schema field)"

patterns-established:
  - "Portal cookie parsing: manual split on '; ' to extract portal_session= prefix"
  - "Portal double-scoping: tenantStore.run() for downstream tenant context + explicit contractorId filter on all queries"
  - "Anti-enumeration: requestMagicLink always returns { success: true } regardless of email match"

requirements-completed: [PORT-01, PORT-02, PORT-03, PORT-04, PORT-05]

duration: 6min
completed: 2026-03-23
---

# Phase 13 Plan 02: Portal API Layer Summary

**portalProcedure middleware with cookie auth + 15-endpoint portal tRPC router covering magic link auth, contracts, invoices, documents, payments, and invoice submission**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T15:31:40Z
- **Completed:** 2026-03-23T15:37:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- portalProcedure middleware authenticates via portal_session cookie, validates session, sets tenant context, and provides contractor info
- Complete portal tRPC router with 15 endpoints: 4 auth, 8 read, 3 write
- Invoice submission creates RECEIVED invoice with PORTAL source, verifies contract ownership
- All read queries double-scoped by org (via explicit organizationId) + contractorId, no internal data leakage

## Task Commits

Each task was committed atomically:

1. **Task 1: Create portalProcedure middleware and portal auth helpers** - `daa6404` (feat)
2. **Task 2: Create portal tRPC router with all endpoints and merge into appRouter** - `c58ca57` (feat)

## Files Created/Modified
- `packages/api/src/middleware/portal-auth.ts` - portalProcedure and portalPublicProcedure middleware with cookie parsing and session validation
- `packages/api/src/routers/portal.ts` - Complete portal router with 15 endpoints (auth, contracts, invoices, documents, payments)
- `packages/api/src/root.ts` - Added portal: portalRouter to appRouter

## Decisions Made
- Used raw prisma client (same as all other routers) with explicit organizationId in all create operations
- Organization data for getSession fetched separately since validatePortalSession only includes contractor relation
- Exported ActivityEntry interface to satisfy TypeScript TS2742 constraint on appRouter type inference
- Used PaymentRunItem.markedPaidAt as the payment date (existing schema field, no paidAt on PaymentRunItem directly)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated Prisma client to include portal models**
- **Found during:** Task 2 (portal router compilation)
- **Issue:** Generated Prisma client did not include PortalSession, PortalMagicToken, and other models -- all prisma model references failed with TS2339
- **Fix:** Ran `npx prisma generate --schema packages/db/prisma/schema` to regenerate client types
- **Files modified:** packages/db/generated/prisma/client/ (generated files)
- **Verification:** TypeScript compilation passes for portal files
- **Committed in:** Not committed (generated files are gitignored)

**2. [Rule 1 - Bug] Added organizationId to Document, Invoice, InvoiceFile creates**
- **Found during:** Task 2 (submitInvoice TypeScript errors)
- **Issue:** Plan's create calls omitted organizationId which is required by Prisma schema (all tenant-scoped models require it explicitly since raw prisma client is used)
- **Fix:** Added `organizationId: ctx.organizationId` to all three create operations
- **Files modified:** packages/api/src/routers/portal.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** c58ca57 (Task 2 commit)

**3. [Rule 1 - Bug] Fetched organization separately in getSession**
- **Found during:** Task 2 (getSession TypeScript errors)
- **Issue:** ctx.contractor does not include organization relation (validatePortalSession only does `include: { contractor: true }`)
- **Fix:** Added separate `prisma.organization.findUnique()` call in getSession endpoint
- **Files modified:** packages/api/src/routers/portal.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** c58ca57 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in slack-client.ts, health-service.ts, token-refresh.ts, webhook-dispatcher.ts (integrations package Prisma types) -- out of scope, not related to portal work

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all endpoints are fully wired to database queries and services.

## Next Phase Readiness
- Portal API layer complete, ready for frontend implementation (Plan 03-05)
- All 15 endpoints type-check and match the portal UI page requirements
- Invoice submission flows into existing intake pipeline (RECEIVED status, UNMATCHED match status)

---
*Phase: 13-contractor-portal-auth-core-views*
*Completed: 2026-03-23*
