---
phase: 33-inpost-courier-integration
plan: 03
subsystem: ui
tags: [react, nextjs, inpost, geowidget, iframe, postmessage, i18n, portal, trpc]

# Dependency graph
requires:
  - phase: 33-inpost-courier-integration/02
    provides: tRPC equipment and portal routers with InPost shipment, return, and label endpoints
  - phase: 30-equipment-tracking/02
    provides: equipment detail page, EquipmentTypeIcon, EquipmentStatusBadge components
provides:
  - Paczkomat picker modal with Geowidget iframe and origin-validated postMessage
  - InPost shipment creation form with pre-filled Paczkomat and parcel size selection
  - Shipment label/QR viewer with download and print functionality
  - Admin return approval banner with approve/reject actions
  - Portal Equipment tab with assigned items and return status
  - Contractor 3-step return flow modal (select Paczkomat, confirm, view label)
  - Portal navigation updated with Equipment link
  - Complete en/pl i18n translations for all InPost UI strings
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Geowidget iframe postMessage with origin validation for secure cross-origin picker"
    - "Multi-step dialog flow with step indicator for complex portal workflows"
    - "Base64 blob URL download pattern for label/PDF delivery"

key-files:
  created:
    - apps/web/src/components/equipment/paczkomat-picker.tsx
    - apps/web/src/components/equipment/paczkomat-display.tsx
    - apps/web/src/components/equipment/inpost-shipment-form.tsx
    - apps/web/src/components/equipment/shipment-label-view.tsx
    - apps/web/src/components/equipment/return-approval-banner.tsx
    - apps/web/src/components/portal/portal-equipment-tab.tsx
    - apps/web/src/components/portal/portal-return-flow.tsx
    - apps/web/src/app/[locale]/(portal)/portal/equipment/page.tsx
  modified:
    - apps/web/src/components/portal/portal-top-bar.tsx
    - apps/web/src/components/portal/portal-mobile-menu.tsx
    - apps/web/src/components/equipment/equipment-detail/tab-shipments.tsx
    - apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Geowidget iframe with postMessage origin validation for secure Paczkomat selection"
  - "Base64 blob URL pattern for label download/print to avoid server round-trips"
  - "Multi-step dialog with step indicator for contractor return flow UX"

patterns-established:
  - "Geowidget iframe postMessage: listen for message events, validate origin against geowidget.inpost.pl, extract point data"
  - "Portal multi-step modal: step state with indicator dots, back/next navigation, mutation on final confirm"

requirements-completed: [EQUIP-05, EQUIP-11]

# Metrics
duration: 5min
completed: 2026-04-04
---

# Phase 33 Plan 03: InPost UI Components Summary

**Complete InPost courier UI: Paczkomat picker with Geowidget iframe, shipment creation form, label viewer with download/print, admin return approval banner, portal equipment tab, and contractor 3-step return flow with en/pl i18n**

## Performance

- **Duration:** 5 min (continuation -- visual verification approval only)
- **Started:** 2026-04-04T21:23:37Z
- **Completed:** 2026-04-04T21:24:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 14

## Accomplishments
- Built 6 new admin/portal components for InPost integration (Paczkomat picker, shipment form, label view, return approval banner, equipment tab, return flow)
- Created portal Equipment page at /portal/equipment with full contractor return workflow
- Added comprehensive en/pl i18n translations for all InPost UI strings
- Wired return approval banner into admin equipment detail page
- Visual verification approved by user across all 11 verification steps

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin UI components** - `c838c62` (feat)
2. **Task 2: Portal equipment page and contractor return flow** - `44a28d2` (feat)
3. **Task 3: Visual verification** - checkpoint approved, no commit needed

## Files Created/Modified
- `apps/web/src/components/equipment/paczkomat-picker.tsx` - Geowidget iframe modal with origin-validated postMessage
- `apps/web/src/components/equipment/paczkomat-display.tsx` - Read-only Paczkomat card display
- `apps/web/src/components/equipment/inpost-shipment-form.tsx` - InPost shipment creation dialog with parcel size selection
- `apps/web/src/components/equipment/shipment-label-view.tsx` - Label/QR display with download and print
- `apps/web/src/components/equipment/return-approval-banner.tsx` - Admin approve/reject banner for return requests
- `apps/web/src/components/portal/portal-equipment-tab.tsx` - Contractor equipment list with return status
- `apps/web/src/components/portal/portal-return-flow.tsx` - 3-step return modal (select Paczkomat, confirm, view label)
- `apps/web/src/app/[locale]/(portal)/portal/equipment/page.tsx` - Portal equipment route page
- `apps/web/src/components/portal/portal-top-bar.tsx` - Added Equipment navigation link
- `apps/web/src/components/portal/portal-mobile-menu.tsx` - Added Equipment mobile navigation
- `apps/web/src/components/equipment/equipment-detail/tab-shipments.tsx` - Wired return approval banner
- `apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx` - Added return request data fetching
- `apps/web/messages/en.json` - English i18n translations for InPost UI
- `apps/web/messages/pl.json` - Polish i18n translations for InPost UI

## Decisions Made
- Geowidget iframe with postMessage origin validation for secure Paczkomat selection
- Base64 blob URL pattern for label download/print to avoid server round-trips
- Multi-step dialog with step indicator for contractor return flow UX

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** See plan frontmatter for:
- `INPOST_SHIPX_API_TOKEN` - InPost Manager portal API token
- `INPOST_SHIPX_ORGANIZATION_ID` - Organization ID from InPost Manager
- `INPOST_GEOWIDGET_TOKEN` - Geowidget token for Paczkomat picker iframe
- `INPOST_WEBHOOK_SECRET` - Webhook signature verification (optional)
- `INPOST_SANDBOX` - Sandbox/production mode flag

## Next Phase Readiness
- InPost courier integration is feature-complete across all 3 plans (schema, API, UI)
- All admin and portal workflows functional end-to-end
- Ready for next milestone phase

## Self-Check: PASSED

- All 8 created files verified on disk
- Both task commits (c838c62, 44a28d2) verified in git log

---
*Phase: 33-inpost-courier-integration*
*Completed: 2026-04-04*
