---
phase: 07-notifications-slack
plan: 03
subsystem: ui
tags: [react, next-intl, nuqs, popover, notifications, bell-icon, pagination]

requires:
  - phase: 07-01
    provides: notification tRPC router (list, unreadCount, markRead, markAllRead)
  - phase: 07-02
    provides: email dispatch and Slack notification delivery
provides:
  - Notification popover (bell icon dropdown with unread count badge, scrollable list, mark all read)
  - NotificationItem reusable component (6 event types with icons/colors, entity navigation)
  - Full /notifications page with type filter chips, unread toggle, pagination
  - Sidebar navigation item for /notifications
affects: [07-04, 07-05]

tech-stack:
  added: []
  patterns: [notification-popover-polling, url-state-filters-nuqs, entity-url-routing]

key-files:
  created:
    - apps/web/src/components/notifications/notification-item.tsx
    - apps/web/src/components/notifications/notification-popover.tsx
    - apps/web/src/components/notifications/notification-center.tsx
    - apps/web/src/app/[locale]/(dashboard)/notifications/page.tsx
  modified:
    - apps/web/src/components/layout/top-bar.tsx
    - apps/web/src/lib/navigation.ts
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Entity URL routing via inline getEntityUrl helper mapping EntityType enum to app routes"
  - "Single notification type filter per API call (multi-type filters like approvals show all types)"

patterns-established:
  - "NotificationItem: reusable notification row with type-specific icons/colors, unread dot, relative timestamps"
  - "Popover polling: unreadCount query with 30s refetchInterval, list query refetched on popover open"

requirements-completed: [NOTF-03]

duration: 4min
completed: 2026-03-22
---

# Phase 07 Plan 03: Notification UI Summary

**Bell icon popover with 30s unread count polling, scrollable notification list, and full /notifications page with type filters, unread toggle, and pagination**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T01:38:43Z
- **Completed:** 2026-03-22T01:43:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- NotificationItem component rendering 6 event types with distinct icons/colors per UI-SPEC
- NotificationPopover replacing plain bell icon in top bar with live unread count badge and 30s polling
- Full /notifications page with type filter chips (All/Approvals/Tasks/Contracts/Invoices), unread-only toggle, and Previous/Next pagination
- Sidebar navigation updated with Notifications item before Settings

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification item component and notification popover with bell icon wiring** - `83af2b5` (feat)
2. **Task 2: Full /notifications page with filters, pagination, and sidebar nav** - `4766fd1` (feat)

## Files Created/Modified
- `apps/web/src/components/notifications/notification-item.tsx` - Reusable notification row with type-specific icons, unread dot, entity URL helper, relative time
- `apps/web/src/components/notifications/notification-popover.tsx` - Bell icon popover with unread badge, mark all read, scrollable list, empty state
- `apps/web/src/components/notifications/notification-center.tsx` - Full page notification list with nuqs URL state, type filters, unread toggle, pagination
- `apps/web/src/app/[locale]/(dashboard)/notifications/page.tsx` - Notifications page wrapped in Suspense for nuqs
- `apps/web/src/components/layout/top-bar.tsx` - Replaced bell Tooltip+Button with NotificationPopover
- `apps/web/src/lib/navigation.ts` - Added Notifications nav item with Bell icon before Settings
- `apps/web/messages/en.json` - Added Notifications i18n namespace (EN)
- `apps/web/messages/pl.json` - Added Notifications i18n namespace (PL)

## Decisions Made
- Entity URL routing via inline `getEntityUrl` helper mapping EntityType enum values to app routes (INVOICE -> /invoices/:id, etc.)
- Single notification type filter per API call -- multi-type filters like "approvals" (APPROVAL_REQUEST + APPROVAL_DECISION) show all types rather than making multiple API calls
- API package rebuild required for tRPC type inference (notification router types not in dist cache)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt API package for tRPC type inference**
- **Found during:** Task 1 (NotificationPopover implementation)
- **Issue:** `trpc.notification.*` methods not found -- API dist types were stale and didn't include notification router
- **Fix:** Ran `npx turbo run build --filter=@contractor-ops/api` to regenerate type declarations
- **Files modified:** None (build output only)
- **Verification:** TypeScript check passed after rebuild

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for type safety. No scope creep.

## Issues Encountered
None beyond the API rebuild noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notification popover and full page ready for end-to-end testing
- NotificationItem component reusable across popover and page views
- Notification preferences UI (Plan 04) can build on this foundation

---
*Phase: 07-notifications-slack*
*Completed: 2026-03-22*
