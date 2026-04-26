---
phase: 07-notifications-slack
plan: 04
subsystem: ui
tags: [react, settings, notifications, slack, oauth, preferences, reminder-rules, shadcn]

requires:
  - phase: 07-01
    provides: notification/reminder/integration tRPC routers and validators
  - phase: 07-02
    provides: Slack OAuth callback and user sync service
provides:
  - Notification preference matrix UI (per-type per-channel toggles)
  - Reminder rules CRUD UI with editor dialog
  - Slack connection card with OAuth flow UI
  - Slack user mapping table with link/unlink
  - Settings page extended with Notifications + Integrations tabs
affects: [07-05, notifications, settings]

tech-stack:
  added: []
  patterns:
    - nuqs URL-synced tab state for deep linking from OAuth callback
    - Tooltip render prop pattern for disabled switches (base-ui)

key-files:
  created:
    - apps/web/src/components/settings/notification-preferences.tsx
    - apps/web/src/components/settings/reminder-rules-section.tsx
    - apps/web/src/components/settings/reminder-rule-editor.tsx
    - apps/web/src/components/settings/slack-connection-card.tsx
    - apps/web/src/components/settings/slack-user-mapping.tsx
  modified:
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "nuqs parseAsString for tab state URL sync to support OAuth callback deep linking (?tab=integrations)"
  - "Tooltip render prop pattern (not asChild) for disabled switches per base-ui convention"
  - "Inline SVG for Slack logo (standard octothorpe) to avoid external dependencies"

patterns-established:
  - "Disabled Switch with Tooltip render prop: wrap in div for tooltip trigger"
  - "OAuth callback handling via URL searchParams with auto-cleanup"

requirements-completed: [NOTF-02, SLCK-01, SLCK-03]

duration: 8min
completed: 2026-03-22
---

# Phase 7 Plan 4: Settings UI for Notifications & Slack Summary

**Notification preference matrix with per-channel toggles, reminder rules CRUD dialog, Slack OAuth connection card, and user mapping table in Settings tabs**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T01:38:53Z
- **Completed:** 2026-03-22T01:47:04Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 6-row x 3-column notification preference matrix with in-app always-on, email toggleable, Slack disabled when not connected
- Reminder rules CRUD with card list, active toggle, AlertDialog delete confirmation, and full editor dialog with 8 fields
- Slack connection card with connected/disconnected/reauth/error states and OAuth redirect flow
- User mapping table with auto-matched/manually-linked/unmatched status badges and link/unlink actions
- Settings page extended with Notifications and Integrations tabs (admin-only) with nuqs URL sync

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification preferences matrix and reminder rules section with editor dialog** - `409a1f5` (feat)
2. **Task 2: Slack connection card, user mapping table, and settings tab wiring** - `4186314` (feat)

## Files Created/Modified
- `apps/web/src/components/settings/notification-preferences.tsx` - 6-row preference matrix with per-channel Switch toggles
- `apps/web/src/components/settings/reminder-rules-section.tsx` - Reminder rule card list with CRUD actions
- `apps/web/src/components/settings/reminder-rule-editor.tsx` - Dialog form with 8 fields, conditional display, Zod validation
- `apps/web/src/components/settings/slack-connection-card.tsx` - Slack connection status card with OAuth and disconnect flows
- `apps/web/src/components/settings/slack-user-mapping.tsx` - User mapping table with link/unlink Popover
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` - Settings page with 5 tabs, nuqs URL sync, admin gate
- `apps/web/messages/en.json` - English translations for notifications/integrations settings
- `apps/web/messages/pl.json` - Polish translations for notifications/integrations settings

## Decisions Made
- Used nuqs parseAsString for tab state URL sync to support OAuth callback deep linking (?tab=integrations)
- Used Tooltip render prop pattern (not asChild) for disabled Switch components per base-ui convention
- Used inline SVG for Slack logo to avoid external asset dependency
- Wrapped settings page in Suspense boundary for nuqs useSearchParams compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TooltipTrigger asChild to render prop pattern**
- **Found during:** Task 1 (Notification preferences matrix)
- **Issue:** Used asChild prop on TooltipTrigger which doesn't exist in base-ui pattern
- **Fix:** Changed to render prop pattern consistent with project convention
- **Files modified:** apps/web/src/components/settings/notification-preferences.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 409a1f5 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed reminder rule mutation type narrowing**
- **Found during:** Task 1 (Reminder rule editor)
- **Issue:** Form string fields not assignable to enum literal types required by tRPC mutations
- **Fix:** Added explicit type assertions for entityType, triggerType, channel, recipientMode
- **Files modified:** apps/web/src/components/settings/reminder-rule-editor.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 409a1f5 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed Tabs onValueChange type mismatch with nuqs setter**
- **Found during:** Task 2 (Settings page wiring)
- **Issue:** nuqs setActiveTab signature incompatible with base-ui Tabs onValueChange
- **Fix:** Wrapped in arrow function: `(val) => setActiveTab(val)`
- **Files modified:** apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 4186314 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for type safety. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all components are fully wired to tRPC API endpoints from Plan 01.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Settings UI complete for notifications and Slack integration
- Ready for Plan 05 (verification/UAT of full notification pipeline)

---
*Phase: 07-notifications-slack*
*Completed: 2026-03-22*
