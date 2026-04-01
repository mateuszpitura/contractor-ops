---
phase: 14-portal-self-service-branding
plan: 02
subsystem: ui
tags: [react, portal, settings, react-hook-form, optimistic-update, collapsible, shadcn]

requires:
  - phase: 14-portal-self-service-branding
    provides: "Portal self-service API: getProfile, updateContactInfo, submitFinancialChangeRequest, getNotificationPreferences, updateNotificationPreference endpoints"
provides:
  - "Portal settings page at /portal/settings with 3 collapsible sections"
  - "ProfileSection component with view/edit toggle and react-hook-form"
  - "PendingChangeBanner for financial change request tracking"
  - "NotificationPreferencesSection with optimistic toggle updates"
  - "Settings nav link in portal top bar and mobile menu"
affects: [14-03]

tech-stack:
  added: []
  patterns:
    - "Collapsible section with inline edit toggle (view mode -> edit mode with form)"
    - "Optimistic mutation with manual query cache update and rollback"
    - "Dynamic Zod schema from field config for reusable form sections"

key-files:
  created:
    - apps/web/src/app/[locale]/(portal)/settings/page.tsx
    - apps/web/src/components/portal/portal-settings-page.tsx
    - apps/web/src/components/portal/profile-section.tsx
    - apps/web/src/components/portal/pending-change-banner.tsx
    - apps/web/src/components/portal/notification-preferences-section.tsx
  modified:
    - apps/web/src/components/portal/portal-top-bar.tsx
    - apps/web/src/components/portal/portal-mobile-menu.tsx

key-decisions:
  - "NotificationPreferencesSection created in Task 1 (not Task 2) because portal-settings-page.tsx imports it -- blocking dependency"
  - "Used manual mutationFn extraction for optimistic update mutation to avoid type conflict with spread mutationOptions"
  - "Cast requestedChanges from JsonValue to Record<string, unknown> at consumption site for type safety"

patterns-established:
  - "Collapsible profile section pattern: Card > Collapsible > trigger row with chevron + title + badge + edit button > content with view/edit toggle"
  - "Optimistic toggle pattern: extract mutationFn from tRPC, define onMutate/onError/onSettled with typed query cache manipulation"

requirements-completed: [PORT-06, PORT-07]

duration: 5min
completed: 2026-03-23
---

# Phase 14 Plan 02: Portal Self-Service UI Summary

**Portal settings page with collapsible profile sections (immediate contact edit + approval-flow financial edit), notification preference toggles with optimistic updates, and Settings nav link in portal navigation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T20:08:09Z
- **Completed:** 2026-03-23T20:13:45Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Portal settings page at /portal/settings with heading, subtitle, and max-w-640px layout containing 3 collapsible sections
- ProfileSection reusable component with view/edit toggle, dynamic Zod schema from fields config, "Requires Approval" badge, and inline edit with Save Changes / Discard Changes
- PendingChangeBanner with Clock icon, expandable submitted changes view, and warning amber styling
- NotificationPreferencesSection with 5 category rows, Switch toggles, optimistic cache updates with rollback, and locked Security Alerts toggle
- Settings nav link added to both desktop top bar and mobile Sheet menu

## Task Commits

Each task was committed atomically:

1. **Task 1: Create portal settings page with all sections** - `dd8fb0c` (feat)
2. **Task 2: Add Settings nav link to portal top bar and mobile menu** - `87b4ac2` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(portal)/settings/page.tsx` - Settings route page rendering PortalSettingsPage
- `apps/web/src/components/portal/portal-settings-page.tsx` - Main settings page with profile query, 3 sections, skeleton loading
- `apps/web/src/components/portal/profile-section.tsx` - Reusable collapsible section with view/edit toggle and react-hook-form
- `apps/web/src/components/portal/pending-change-banner.tsx` - Warning banner for pending financial change requests
- `apps/web/src/components/portal/notification-preferences-section.tsx` - 5 notification toggle rows with optimistic updates
- `apps/web/src/components/portal/portal-top-bar.tsx` - Added Settings icon and nav item
- `apps/web/src/components/portal/portal-mobile-menu.tsx` - Added Settings icon and nav item

## Decisions Made
- Created NotificationPreferencesSection in Task 1 commit (not Task 2) because portal-settings-page.tsx directly imports it -- TypeScript compilation would fail without it (Rule 3 blocking dependency)
- Used manual `mutationFn` extraction from tRPC mutation options to avoid TypeScript type conflict when spreading `mutationOptions()` with custom `onMutate` return type
- Cast Prisma `JsonValue` to `Record<string, unknown>` at the consumption site in portal-settings-page.tsx for pendingChangeRequest prop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created NotificationPreferencesSection in Task 1 instead of Task 2**
- **Found during:** Task 1 (portal-settings-page.tsx imports the component)
- **Issue:** Plan assigns NotificationPreferencesSection to Task 2 but portal-settings-page.tsx (Task 1) imports it, causing TypeScript compilation failure
- **Fix:** Created the full component in Task 1 commit
- **Files modified:** apps/web/src/components/portal/notification-preferences-section.tsx
- **Verification:** TypeScript compilation passes with 0 errors in new files
- **Committed in:** dd8fb0c (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeScript type mismatches in optimistic update and JSON value**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** (1) Spreading tRPC mutationOptions with custom onMutate created incompatible return types, (2) Prisma JsonValue not assignable to Record<string, unknown>, (3) category type needed to be specific union not string
- **Fix:** Extracted mutationFn manually, added explicit type annotations, cast JsonValue at consumption site, defined NotificationCategory type alias
- **Files modified:** notification-preferences-section.tsx, portal-settings-page.tsx
- **Verification:** `npx tsc --noEmit` passes with 0 errors in all new files
- **Committed in:** dd8fb0c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep -- all planned functionality delivered.

## Issues Encountered
- API package types needed force rebuild (`turbo build --force`) after Plan 01 commits to pick up new portal router endpoints

## Known Stubs
None - all sections are wired to real tRPC queries/mutations with production data access patterns.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All portal self-service UI complete -- contractor can view/edit profile, submit financial changes, toggle notifications
- Plan 03 (admin branding UI) can proceed with the admin-side components
- Settings page integrated into portal navigation flow

---
*Phase: 14-portal-self-service-branding*
*Completed: 2026-03-23*

## Self-Check: PASSED
