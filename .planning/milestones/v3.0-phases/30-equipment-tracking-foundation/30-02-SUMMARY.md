---
phase: 30-equipment-tracking-foundation
plan: 02
subsystem: ui
tags: [react, tanstack-table, tanstack-query, next-intl, shadcn, equipment, shipment]

# Dependency graph
requires:
  - Equipment tRPC router with 13 endpoints (from 30-01)
  - Existing contractor profile ProfileTabs pattern
  - shadcn component library (Dialog, Table, Badge, Tabs, Select, Command)
provides:
  - Equipment list page at /equipment with table, filters, search, pagination
  - Equipment detail page at /equipment/[id] with info, assignments, shipments tabs
  - Equipment CRUD form dialog with Zod validation
  - Assignment dialog with contractor Command picker
  - Shipment form dialog with carrier/tracking/direction
  - Shipment timeline component with status events and add-event form
  - Contractor profile Equipment tab with condensed shipment status
  - Equipment nav item in sidebar operations group
  - Full EN/PL i18n strings for Equipment namespace
affects: [30-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Equipment table with server-side pagination/sort/filter via tRPC
    - Shipment timeline with chronological events and pending future statuses
    - Equipment type icon mapping (Lucide icons per EquipmentType)
    - Equipment/shipment status badge variant mapping

key-files:
  created:
    - apps/web/src/app/[locale]/(dashboard)/equipment/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx
    - apps/web/src/components/equipment/equipment-table/equipment-columns.tsx
    - apps/web/src/components/equipment/equipment-table/equipment-table.tsx
    - apps/web/src/components/equipment/equipment-table/equipment-toolbar.tsx
    - apps/web/src/components/equipment/equipment-detail/equipment-detail-header.tsx
    - apps/web/src/components/equipment/equipment-detail/equipment-detail-tabs.tsx
    - apps/web/src/components/equipment/equipment-detail/tab-info.tsx
    - apps/web/src/components/equipment/equipment-detail/tab-assignments.tsx
    - apps/web/src/components/equipment/equipment-detail/tab-shipments.tsx
    - apps/web/src/components/equipment/equipment-form.tsx
    - apps/web/src/components/equipment/assignment-dialog.tsx
    - apps/web/src/components/equipment/shipment-timeline.tsx
    - apps/web/src/components/equipment/shipment-form.tsx
    - apps/web/src/components/equipment/shipment-condensed.tsx
    - apps/web/src/components/equipment/equipment-status-badge.tsx
    - apps/web/src/components/equipment/shipment-status-badge.tsx
    - apps/web/src/components/equipment/equipment-type-icon.tsx
    - apps/web/src/components/contractors/contractor-profile/tab-equipment.tsx
  modified:
    - apps/web/src/lib/navigation.ts
    - apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx
    - apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "base-ui Select onValueChange receives nullable value -- guard with val && before setValue calls"
  - "Equipment table uses local state for filters instead of nuqs URL state (simpler for first version)"
  - "Shipment timeline renders SHIPMENT_STATUS_ORDER as full sequence with completed/current/pending visual states"

patterns-established:
  - "EquipmentTypeIcon maps EquipmentType enum to Lucide icon with Box fallback for custom types"
  - "EquipmentStatusBadge and ShipmentStatusBadge map enum values to Badge variants per UI-SPEC"
  - "Equipment detail page follows contractor profile pattern: header + tabbed content"

requirements-completed: [EQUIP-01, EQUIP-02, EQUIP-03, EQUIP-04, EQUIP-08]

# Metrics
duration: 12min
completed: 2026-04-02
---

# Phase 30 Plan 02: Equipment UI Summary

**Equipment list/detail pages with TanStack Table, CRUD/assignment/shipment dialogs, shipment timeline, contractor profile Equipment tab, and full EN/PL i18n**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-02T11:08:13Z
- **Completed:** 2026-04-02T11:20:51Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments
- Equipment list page at /equipment with sortable table, type/status filters, search, pagination, and all CRUD/assignment/shipment action dialogs
- Equipment detail page at /equipment/[id] with header (icon, name, serial, badges, action buttons), info/assignments/shipments tabs
- Shipment timeline component with chronological events, visual status indicators (completed/current/pending), and inline add-status-update form
- Contractor profile extended with Equipment tab showing assigned items and condensed shipment status
- Full Equipment i18n namespace in both EN and PL with 100+ translation keys

## Task Commits

Each task was committed atomically:

1. **Task 1: Equipment list page, detail page, all components, and nav item** - `34c45de` (feat)
2. **Task 2: Contractor profile Equipment tab and i18n strings** - `b95b074` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(dashboard)/equipment/page.tsx` - Equipment list page with table, dialogs, empty/loading states
- `apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx` - Equipment detail page with header, tabs, dialogs
- `apps/web/src/components/equipment/equipment-table/equipment-columns.tsx` - TanStack Table column definitions with type icon, name link, serial, status badge, assignee, actions dropdown
- `apps/web/src/components/equipment/equipment-table/equipment-table.tsx` - Server-side paginated table wrapper with sort/filter state
- `apps/web/src/components/equipment/equipment-table/equipment-toolbar.tsx` - Search input with debounce, type/status filter popover, add button
- `apps/web/src/components/equipment/equipment-detail/equipment-detail-header.tsx` - Detail header with icon, name, badges, edit/assign/unassign/shipment/retire actions
- `apps/web/src/components/equipment/equipment-detail/equipment-detail-tabs.tsx` - URL-synced tabs (info/assignments/shipments)
- `apps/web/src/components/equipment/equipment-detail/tab-info.tsx` - Equipment info card with all metadata
- `apps/web/src/components/equipment/equipment-detail/tab-assignments.tsx` - Assignment history table with current highlighted
- `apps/web/src/components/equipment/equipment-detail/tab-shipments.tsx` - Shipment cards with timeline, delete action
- `apps/web/src/components/equipment/equipment-form.tsx` - React Hook Form + Zod create/edit dialog
- `apps/web/src/components/equipment/assignment-dialog.tsx` - Contractor Command picker for assignment
- `apps/web/src/components/equipment/shipment-timeline.tsx` - Vertical timeline with status events and add-event form
- `apps/web/src/components/equipment/shipment-form.tsx` - Shipment creation dialog with direction/carrier/tracking fields
- `apps/web/src/components/equipment/shipment-condensed.tsx` - Inline shipment status display for contractor tab
- `apps/web/src/components/equipment/equipment-status-badge.tsx` - Equipment status to Badge variant mapping
- `apps/web/src/components/equipment/shipment-status-badge.tsx` - Shipment status to Badge variant mapping
- `apps/web/src/components/equipment/equipment-type-icon.tsx` - Equipment type to Lucide icon mapping
- `apps/web/src/components/contractors/contractor-profile/tab-equipment.tsx` - Contractor profile Equipment tab
- `apps/web/src/lib/navigation.ts` - Added equipment nav item with Package icon to operations group
- `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` - Added equipment to TAB_KEYS and equipmentContent prop
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx` - Wired TabEquipment into ProfileTabs
- `apps/web/messages/en.json` - Added Equipment namespace with 100+ EN strings
- `apps/web/messages/pl.json` - Added Equipment namespace with 100+ PL strings

## Decisions Made
- base-ui Select onValueChange passes nullable value (string | null) -- guarded with `val &&` before calling form.setValue, consistent with existing invite-dialog pattern
- Equipment table uses local React state for filters instead of nuqs URL state -- simpler first version, can upgrade later if shareable filter URLs needed
- Shipment timeline renders the full SHIPMENT_STATUS_ORDER sequence showing completed events with solid connectors, current with primary highlight, and pending as dashed/faded

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed base-ui Select onValueChange type mismatch**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** base-ui Select.Root onValueChange signature is `(value: string | null, eventDetails) => void`, not `(value: string) => void`
- **Fix:** Added null guard (`val &&`) before calling form.setValue in equipment-form, shipment-form, and shipment-timeline
- **Files modified:** equipment-form.tsx, shipment-form.tsx, shipment-timeline.tsx
- **Verification:** TypeScript compiles without errors

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type mismatch fix. No scope creep.

## Issues Encountered
- Pre-existing build failure in `apps/web/src/app/api/ksef/_sync/route.ts` (missing module export from Phase 17) prevents full `next build` completion -- unrelated to equipment changes, TypeScript type-checking passes for all equipment files

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are fully wired to tRPC equipment router endpoints from Plan 01.

## Next Phase Readiness
- Equipment UI complete, ready for workflow integration (30-03)
- All 19 new component files consume the 13 tRPC endpoints from Plan 01
- Contractor profile now includes Equipment tab for cross-domain visibility

---
*Phase: 30-equipment-tracking-foundation*
*Completed: 2026-04-02*
