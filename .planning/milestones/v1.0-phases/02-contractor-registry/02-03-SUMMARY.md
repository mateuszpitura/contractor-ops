---
phase: 02-contractor-registry
plan: 03
subsystem: ui
tags: [react, next-intl, trpc, tabs, compliance-health, contractor-profile, breadcrumb, skeleton, lifecycle]

# Dependency graph
requires:
  - phase: 02-contractor-registry
    provides: contractorRouter with getById, updateLifecycleStage, archive, update tRPC procedures
  - phase: 01-foundation-auth
    provides: shadcn UI components (tabs, badge, card, avatar, button, dropdown-menu, breadcrumb, skeleton, separator, tooltip)
provides:
  - Contractor profile page at /contractors/[id] with header, lifecycle actions, 8-tab navigation
  - Overview tab with company details, billing info, compliance health card, key dates
  - Compliance tab with document status checklist and upload placeholders
  - Sticky right rail with activity timeline, quick notes, reminders section
  - ComplianceHealthBadge reusable component
  - ContractorProfile i18n namespace (EN + PL)
affects: [03-contract-management, future-phase-tabs]

# Tech tracking
tech-stack:
  added: []
  patterns: [URL query param tab state via useSearchParams, compliance health factor clickable tab switching, right-rail sticky positioning]

key-files:
  created:
    - apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx
    - apps/web/src/components/contractors/contractor-profile/profile-header.tsx
    - apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx
    - apps/web/src/components/contractors/contractor-profile/tab-overview.tsx
    - apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx
    - apps/web/src/components/contractors/contractor-profile/tab-placeholder.tsx
    - apps/web/src/components/contractors/contractor-profile/right-rail.tsx
    - apps/web/src/components/contractors/compliance-health-badge.tsx
  modified:
    - apps/web/messages/en.json
    - apps/web/messages/pl.json
    - packages/validators/src/contractor.ts

key-decisions:
  - "Added notes field to contractorUpdateSchema for right-rail quick notes editing"
  - "Used URL query param (?tab=overview) for tab state to support deep-linking"
  - "Used as-any cast for notes mutation to work around stale incremental type cache"

patterns-established:
  - "Tab navigation via URL searchParams with useSearchParams/useRouter/usePathname"
  - "Compliance health card with clickable factors that switch to relevant tabs"
  - "Right-rail sticky layout at top-80px, full-width below lg breakpoint"
  - "Lifecycle action conditional rendering based on LEGAL_TRANSITIONS state machine"

requirements-completed: [CONT-07, CONT-08, CONT-09]

# Metrics
duration: 14min
completed: 2026-03-20
---

# Phase 2 Plan 3: Contractor Profile Page Summary

**Contractor profile page with header/lifecycle actions, 8-tab navigation (overview + compliance fully implemented), compliance health card with per-factor scoring, and sticky right rail with activity timeline and quick notes**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-20T12:22:54Z
- **Completed:** 2026-03-20T12:36:49Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Full contractor profile page at /contractors/[id] with breadcrumb, skeleton loading, error/404 states
- Profile header with lifecycle stage badges, type badge, owner avatar, and conditional lifecycle action dropdown
- 8-tab navigation with URL deep-linking: 2 fully implemented (overview, compliance), 5 placeholders, 1 activity
- Overview tab with 5 cards: company details, billing info, active contract summary, compliance health with clickable factors, key dates
- Compliance tab showing document checklist with color-coded status badges and missing item highlighting
- Sticky right rail (280px) with activity timeline, quick notes editor, and reminders placeholder
- ComplianceHealthBadge reusable component with green/yellow/red pill display
- Full i18n support (100+ translation keys) in ContractorProfile namespace for EN and PL

## Task Commits

Each task was committed atomically:

1. **Task 1: Create contractor profile page with header, lifecycle actions, and tab navigation** - `4f31c33` (feat)
2. **Task 2: Create Overview tab with health card, Compliance tab with document checklist, and right rail** - `46cb5bd` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx` - Profile page with data fetching, skeleton states, layout
- `apps/web/src/components/contractors/contractor-profile/profile-header.tsx` - Header with name, badges, owner, lifecycle actions dropdown
- `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` - 8-tab navigation with URL query param state
- `apps/web/src/components/contractors/contractor-profile/tab-overview.tsx` - 5 cards: company details, billing, contract, health, dates
- `apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx` - Document checklist with status badges
- `apps/web/src/components/contractors/contractor-profile/tab-placeholder.tsx` - Reusable placeholder with phase number and icon
- `apps/web/src/components/contractors/contractor-profile/right-rail.tsx` - Sticky rail with activity, notes, reminders
- `apps/web/src/components/contractors/compliance-health-badge.tsx` - Health status pill badge component
- `apps/web/messages/en.json` - Added ContractorProfile namespace
- `apps/web/messages/pl.json` - Added ContractorProfile namespace (Polish)
- `packages/validators/src/contractor.ts` - Added notes field to contractorUpdateSchema

## Decisions Made
- **Notes in update schema:** Added optional `notes` field to `contractorUpdateSchema` (extending the `.partial()` of create schema) to support right-rail quick notes editing via the existing `contractor.update` mutation.
- **URL tab state:** Used `useSearchParams` + `useRouter.replace()` for tab navigation to enable deep-linking (e.g., `?tab=compliance`) without adding a dependency like nuqs.
- **Type cast for notes mutation:** Used `as any` cast on mutation call to work around stale incremental TypeScript type cache in Next.js build. The validators dist contains the notes field but the builder's type cache doesn't pick it up until a clean build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed asChild -> render prop in Plan 02-02 bulk actions**
- **Found during:** Task 1 (build verification)
- **Issue:** Three files from Plan 02-02 used Radix `asChild` prop but project uses base-ui which uses `render` prop pattern
- **Fix:** Replaced all `asChild` with `render={(props) => <Component {...props} />}` pattern
- **Files modified:** data-table-bulk-actions.tsx, data-table-toolbar.tsx, data-table-column-toggle.tsx
- **Verification:** Build passes
- **Committed in:** 4f31c33 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed useRef missing initial value in Plan 02-02 toolbar**
- **Found during:** Task 1 (build verification)
- **Issue:** `useRef<ReturnType<typeof setTimeout>>()` requires initial value argument
- **Fix:** Added `undefined` as initial value
- **Files modified:** data-table-toolbar.tsx
- **Verification:** Build passes
- **Committed in:** 4f31c33 (Task 1 commit)

**3. [Rule 2 - Missing Critical] Added notes field to contractor update schema**
- **Found during:** Task 2 (right-rail implementation)
- **Issue:** Right-rail quick notes needs to persist via contractor.update but notes wasn't in the Zod schema
- **Fix:** Extended contractorUpdateSchema with optional notes field
- **Files modified:** packages/validators/src/contractor.ts
- **Verification:** Build passes, notes field available in update mutation input
- **Committed in:** 4f31c33 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking from Plan 02-02, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correct compilation and feature completeness. No scope creep.

## Issues Encountered
- Next.js incremental TypeScript build used stale type cache from old API dist, causing `notes` field to not be recognized even after validators rebuild. Required clean build and `as any` cast workaround.
- Stale tsc build info in API package caused missing dist/index.js on incremental builds. Required full clean rebuild of validators -> api -> web chain.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Contractor profile page complete with all planned functionality
- 5 placeholder tabs ready to be replaced in future phases (Contracts P3, Documents P3, Workflows P4, Invoices P5, Payments P8)
- Activity tab uses derived data; will need real Activity model query in future phase
- Right-rail reminders section is placeholder until Phase 3 contract expiry reminders

## Self-Check: PASSED

All 8 key files verified present. Both task commits (4f31c33, 46cb5bd) confirmed in git log.

---
*Phase: 02-contractor-registry*
*Completed: 2026-03-20*
