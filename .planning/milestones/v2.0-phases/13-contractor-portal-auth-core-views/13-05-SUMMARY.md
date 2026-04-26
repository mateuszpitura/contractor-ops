---
phase: 13-contractor-portal-auth-core-views
plan: 05
subsystem: ui
tags: [react, next.js, portal, invoices, timeline, activity-log, upload, presigned-url, zod, react-hook-form]

# Dependency graph
requires:
  - phase: 13-contractor-portal-auth-core-views
    plan: 02
    provides: "portal tRPC router with listInvoices, getInvoice, submitInvoice, getActiveContracts, getUploadUrl endpoints"
  - phase: 13-contractor-portal-auth-core-views
    plan: 03
    provides: "Portal layout, top bar, session management"
provides:
  - "Invoice list page with status badges and responsive table/card layout"
  - "Invoice detail page with 3-layer status tracking (badges + timeline + activity log)"
  - "StatusTimeline component with 5-step horizontal/vertical timeline"
  - "ActivityLog component with icons and relative timestamps"
  - "Invoice submission form with contract picker, PDF upload, metadata entry"
  - "Submission success page with confirmation and navigation"
  - "Badge component extended with info, warning, success, success-outline, success-solid variants"
affects: [portal-frontend, 14-contractor-portal-profile-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status badge mapping: derive display status from status/approvalStatus/paymentStatus combination"
    - "Portal file upload: getUploadUrl mutation -> XHR PUT to presigned URL -> store documentId/storageKey in state"
    - "Amount conversion: parseFloat * 100 + Math.round for grosze"
    - "Responsive layouts: Table on desktop + Card stack on mobile via md: breakpoint"

key-files:
  created:
    - apps/web/src/components/portal/status-timeline.tsx
    - apps/web/src/components/portal/activity-log.tsx
    - apps/web/src/components/portal/invoice-submit-form.tsx
    - apps/web/src/app/[locale]/(portal)/invoices/page.tsx
    - apps/web/src/app/[locale]/(portal)/invoices/[id]/page.tsx
    - apps/web/src/app/[locale]/(portal)/invoices/submit/page.tsx
    - apps/web/src/app/[locale]/(portal)/invoices/submit/success/page.tsx
  modified:
    - apps/web/src/components/ui/badge.tsx

key-decisions:
  - "Added info/warning/success/success-outline/success-solid badge variants to existing Badge component rather than creating portal-specific badge"
  - "Custom portal PDF upload instead of reusing admin DropZone (admin DropZone coupled to document.requestUpload tRPC, portal uses portal.getUploadUrl)"
  - "Derive submitted date from activityLog first entry since getInvoice excludes receivedAt from response spread"

patterns-established:
  - "Status display derivation: paymentStatus > approvalStatus > status > default for both badges and timeline"
  - "Portal form pattern: React Hook Form + Zod + controlled Select + inline upload state management"

requirements-completed: [PORT-03, PORT-04]

# Metrics
duration: 6min
completed: 2026-03-23
---

# Phase 13 Plan 05: Invoice Views & Submission Flow Summary

**Invoice list with status badges, detail page with 3-layer status tracking (StatusTimeline + ActivityLog), submission form with contract picker and presigned PDF upload, and success confirmation page**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T15:01:47Z
- **Completed:** 2026-03-23T15:07:47Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Invoice list page with responsive Table (desktop) / Card (mobile) layout, status badges using 6 semantic variants, loading skeletons, and empty state
- Invoice detail page with 3-layer status tracking: status Badge (layer 1), StatusTimeline 5-step horizontal/vertical component (layer 2), ActivityLog with icons and relative timestamps (layer 3)
- Invoice submission form with contract auto-select, presigned URL PDF upload with XHR progress tracking, Zod validation with due date refinement, review summary card
- Success page with confirmation, next steps card, Track Status and Submit Another links

## Task Commits

Each task was committed atomically:

1. **Task 1: Create StatusTimeline, ActivityLog components, and invoice list/detail pages** - `00cb967` (feat)
2. **Task 2: Create invoice submission form and success page** - `36ea2a2` (feat)

## Files Created/Modified
- `apps/web/src/components/portal/status-timeline.tsx` - Horizontal (desktop) + vertical (mobile) 5-step timeline with rejected state handling
- `apps/web/src/components/portal/activity-log.tsx` - Scrollable activity log with event icons, descriptions, and relative timestamps
- `apps/web/src/components/portal/invoice-submit-form.tsx` - Full invoice submission form with contract picker, PDF upload, metadata, review summary
- `apps/web/src/app/[locale]/(portal)/invoices/page.tsx` - Invoice list with table/card responsive layout, status badges, empty state
- `apps/web/src/app/[locale]/(portal)/invoices/[id]/page.tsx` - Invoice detail with timeline, details card, payment section, activity log
- `apps/web/src/app/[locale]/(portal)/invoices/submit/page.tsx` - Submit page wrapper with back navigation
- `apps/web/src/app/[locale]/(portal)/invoices/submit/success/page.tsx` - Success confirmation with Track Status and Submit Another links
- `apps/web/src/components/ui/badge.tsx` - Added info, warning, success, success-outline, success-solid variants

## Decisions Made
- Extended existing Badge component with semantic color variants (info/warning/success/success-outline/success-solid) rather than creating portal-specific badge -- reusable across all portal pages and potentially admin
- Created custom portal PDF upload handler instead of reusing admin DropZone -- the admin DropZone is tightly coupled to `trpc.document.requestUpload` while portal needs `portal.getUploadUrl`
- Derived submission date from activityLog entries since `getInvoice` response excludes `receivedAt` from the spread

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added semantic Badge variants**
- **Found during:** Task 1 (Invoice list page)
- **Issue:** Plan requires info, warning, success, success-outline, success-solid Badge variants but existing Badge only has default, secondary, destructive, outline, ghost, link
- **Fix:** Added 5 new variants to badge.tsx with appropriate color tokens (blue for info, amber for warning, green for success variants)
- **Files modified:** apps/web/src/components/ui/badge.tsx
- **Verification:** TypeScript compilation passes, variants render correctly
- **Committed in:** 00cb967 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed nullable rateValueGrosze in contract display**
- **Found during:** Task 2 (Invoice submission form)
- **Issue:** TypeScript reported rateValueGrosze as possibly null from the portal.getActiveContracts response
- **Fix:** Added nullish coalescing: `(contract.rateValueGrosze ?? 0)`
- **Files modified:** apps/web/src/components/portal/invoice-submit-form.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 36ea2a2 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed Select onValueChange nullable string parameter**
- **Found during:** Task 2 (Invoice submission form)
- **Issue:** Base UI Select's onValueChange passes `string | null` but setValue expects `string`
- **Fix:** Added nullish coalescing: `val ?? ""`
- **Files modified:** apps/web/src/components/portal/invoice-submit-form.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 36ea2a2 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None -- pre-existing TypeScript errors in other modules (login/verify, oauth, webhooks, import) are out of scope.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are fully wired to portal tRPC endpoints.

## Next Phase Readiness
- All portal invoice views complete: list, detail, submission, success
- StatusTimeline and ActivityLog components reusable for any future portal status views
- Badge component now has semantic variants usable across the entire app
- Phase 13 portal core views complete (plans 03-05)

---
*Phase: 13-contractor-portal-auth-core-views*
*Completed: 2026-03-23*
