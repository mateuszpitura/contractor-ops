---
phase: 14-portal-self-service-branding
plan: 03
subsystem: ui
tags: [branding, css-custom-property, color-picker, change-request, diff-card, r2-upload, shadcn]

requires:
  - phase: 14-portal-self-service-branding
    provides: "Plan 01 API: updateBranding, listChangeRequests, reviewChangeRequest endpoints"
  - phase: 13-contractor-portal-auth-core-views
    provides: "Portal layout, PortalTopBar, portal auth middleware"
provides:
  - "Portal layout CSS custom property injection (--brand-accent) from org settingsJson"
  - "AdminBrandingSection with logo upload, 8-swatch color picker, hex input, live preview strip"
  - "ChangeRequestDiffCard with field-by-field diff table and approve/reject actions"
  - "Profile Changes tab in admin approvals page"
  - "getBranding and getLogoUploadUrl settings router endpoints"
affects: []

tech-stack:
  added: []
  patterns:
    - "CSS custom property injection for org branding in server component layout"
    - "Presigned URL upload for org logo via dedicated settings endpoint"
    - "Field-by-field diff card pattern for admin change request review"

key-files:
  created:
    - apps/web/src/components/settings/admin-branding-section.tsx
    - apps/web/src/components/settings/brand-color-picker.tsx
    - apps/web/src/components/settings/brand-preview-strip.tsx
    - apps/web/src/components/settings/change-request-diff-card.tsx
  modified:
    - apps/web/src/app/[locale]/(portal)/layout.tsx
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx
    - packages/api/src/routers/settings.ts

key-decisions:
  - "Inject only --brand-accent (not override --primary) to avoid affecting all shadcn components globally"
  - "Added getBranding query and getLogoUploadUrl mutation to settings router (not in Plan 01 scope but needed for UI)"

patterns-established:
  - "Brand color picker: 8 preset swatches in Popover + hex input with validation"
  - "Change request diff card: table-based old vs new value comparison with approve/reject actions"
  - "Logo upload: dedicated presigned URL endpoint in settings router for org branding assets"

requirements-completed: [PORT-06, PORT-08]

duration: 6min
completed: 2026-03-23
---

# Phase 14 Plan 03: Admin Branding UI & Change Request Review Summary

**Portal CSS custom property brand injection, admin branding section with 8-swatch color picker + logo upload, and change request diff cards with approve/reject in approvals tab**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T20:08:13Z
- **Completed:** 2026-03-23T20:14:33Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Portal layout injects --brand-accent CSS custom property from org settingsJson.brandColor for white-label theming
- Admin branding section in settings General tab with logo upload (R2 presigned URL), 8-swatch color picker + hex input, live preview strip, and save button
- Change request diff card with field-by-field current-vs-requested diff table, approve (immediate) and reject (dialog with optional comment) actions
- Profile Changes tab added to admin approvals page with pending count badge and empty state

## Task Commits

Each task was committed atomically:

1. **Task 1: Update portal layout for brand color injection + create admin branding UI** - `04b4251` (feat)
2. **Task 2: Create change request diff card and add to admin approval queue** - `afb419f` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(portal)/layout.tsx` - Added settingsJson select, brandColor extraction, --brand-accent CSS custom property injection
- `apps/web/src/components/settings/admin-branding-section.tsx` - Portal Branding card with logo upload, color picker, preview strip, save button
- `apps/web/src/components/settings/brand-color-picker.tsx` - 8-swatch Popover color picker with hex input validation
- `apps/web/src/components/settings/brand-preview-strip.tsx` - Live preview of sample button, link, and accent bar in selected color
- `apps/web/src/components/settings/change-request-diff-card.tsx` - Field-by-field diff table with approve/reject actions and rejection dialog
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` - Added AdminBrandingSection to General tab
- `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx` - Added Profile Changes tab with ChangeRequestDiffCard list and empty state
- `packages/api/src/routers/settings.ts` - Added getBranding query, getLogoUploadUrl mutation for admin branding UI

## Decisions Made
- Inject only `--brand-accent` as a separate CSS custom property, not override `--primary`, to avoid unintended side effects across all shadcn components
- Added `getBranding` query and `getLogoUploadUrl` mutation to settings router -- Plan 01 only provided updateBranding, not a read endpoint or upload URL endpoint

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added getBranding query endpoint to settings router**
- **Found during:** Task 1 (admin branding section creation)
- **Issue:** Plan 01 provided updateBranding mutation but no read endpoint for current branding values. AdminBrandingSection needs to read current brandColor and logo on mount.
- **Fix:** Added `getBranding` query to settings router that returns brandColor from settingsJson and logo from org record
- **Files modified:** packages/api/src/routers/settings.ts
- **Verification:** TypeScript compilation passes, query used by AdminBrandingSection
- **Committed in:** 04b4251 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added getLogoUploadUrl mutation to settings router**
- **Found during:** Task 1 (logo upload implementation)
- **Issue:** Plan specified "upload to R2 via presigned URL" but no dedicated endpoint existed for org logo upload. Existing document router creates Document records (overkill for logo).
- **Fix:** Added `getLogoUploadUrl` mutation with image MIME type validation, generates presigned URL for `orgs/{orgId}/branding/logo.{ext}` key
- **Files modified:** packages/api/src/routers/settings.ts
- **Verification:** TypeScript compilation passes, mutation used by AdminBrandingSection
- **Committed in:** 04b4251 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical functionality)
**Impact on plan:** Both endpoints necessary for admin branding UI to function. No scope creep -- minimal read/upload endpoints to support the planned UI.

## Issues Encountered
None beyond the auto-fixed deviations above.

## Known Stubs
None - all components are wired to real tRPC endpoints with production data access patterns.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 14 plans complete (01: API, 02: portal self-service UI, 03: admin branding UI)
- Full brand theming pipeline: admin sets color -> stored in settingsJson -> portal layout injects CSS custom property
- Change request review flow: contractor submits -> admin sees diff -> approve/reject with notification

---
*Phase: 14-portal-self-service-branding*
*Completed: 2026-03-23*

## Self-Check: PASSED
