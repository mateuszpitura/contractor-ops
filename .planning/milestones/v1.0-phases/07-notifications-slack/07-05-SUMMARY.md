---
phase: 07-notifications-slack
plan: 05
subsystem: api
tags: [trpc, resend, slack, notifications, dispatch, i18n, next-intl]

requires:
  - phase: 07-01
    provides: notification dispatch service, preferences, deduplication
  - phase: 07-02
    provides: Slack client, email templates, React Email, cron reminders
  - phase: 07-03
    provides: notification popover and center UI
  - phase: 07-04
    provides: notification preferences, reminder rules, Slack settings UI
provides:
  - Real notification dispatch wired into approval, workflow, and invoice routers
  - Resend email integration with React Email templates for all 6 event types
  - Slack DM integration with Block Kit approval cards for APPROVAL_REQUEST
  - Full EN + PL i18n for all Phase 7 notification surfaces
affects: [notifications, approvals, workflows, invoices]

tech-stack:
  added: [resend]
  patterns:
    - "Fire-and-forget dispatch with .catch() to avoid blocking main operations"
    - "getFinanceTeamUserIds helper for role-based recipient resolution"

key-files:
  created: []
  modified:
    - packages/api/src/services/notification-service.ts
    - packages/api/src/routers/approval.ts
    - packages/api/src/routers/workflow.ts
    - packages/api/src/routers/invoice.ts
    - packages/api/package.json
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Resend added to api package for email delivery; Resend client lazily initialized"
  - "All dispatch calls are fire-and-forget (.catch) to never block the main mutation"
  - "Structured Notifications i18n namespace with sub-keys matching component usage patterns"
  - "Backward-compatible flat keys preserved alongside new structured sub-keys for Plan 03-04 components"

patterns-established:
  - "Fire-and-forget notification dispatch: dispatch(...).catch(console.error) after mutations"
  - "getFinanceTeamUserIds: role-based recipient lookup for broadcast notifications"

requirements-completed: [NOTF-01, NOTF-02, SLCK-01]

duration: 7min
completed: 2026-03-22
---

# Phase 7 Plan 05: Event Wiring & i18n Summary

**Real notification dispatch wired into approval/workflow/invoice routers with Resend email delivery, Slack Block Kit DMs, and full EN+PL i18n for all Phase 7 surfaces**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T01:49:24Z
- **Completed:** 2026-03-22T01:57:11Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Replaced placeholder sendNotificationEmail/sendSlackDM with real Resend and Slack client implementations
- Wired APPROVAL_REQUEST, APPROVAL_DECISION, TASK_ASSIGNED, INVOICE_RECEIVED dispatch into 3 tRPC routers (6 dispatch points total)
- Added complete Notifications i18n namespace with 13 sub-sections covering all UI-SPEC copywriting in both EN and PL

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire dispatch calls into routers and implement real email/Slack senders** - `f209e55` (feat)
2. **Task 2: Full i18n translations for all Phase 7 UI strings** - `c183e7c` (feat)

## Files Created/Modified
- `packages/api/src/services/notification-service.ts` - Real email via Resend and Slack DM via slack-client, replacing placeholders
- `packages/api/src/routers/approval.ts` - APPROVAL_REQUEST after submitForApproval and next-level, APPROVAL_DECISION after approve/reject
- `packages/api/src/routers/workflow.ts` - TASK_ASSIGNED after startRun and reassignTask
- `packages/api/src/routers/invoice.ts` - INVOICE_RECEIVED to finance team after create, getFinanceTeamUserIds helper
- `packages/api/package.json` - Added resend dependency
- `apps/web/messages/en.json` - Full Notifications namespace with 13 sub-sections, Navigation.notifications
- `apps/web/messages/pl.json` - Full Polish translations matching EN structure

## Decisions Made
- Added resend package (v4.8.0) to api package for email delivery -- lazily initialized to avoid startup errors without API key
- All dispatch calls wrapped in fire-and-forget pattern (`.catch()`) so notification failures never block the main operation
- Maintained backward-compatible flat keys in Notifications namespace alongside new structured sub-keys to avoid breaking Plan 03-04 components
- CONTRACT_EXPIRING and TASK_OVERDUE not wired inline -- they are handled by the cron reminder route (Plan 02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added resend package dependency**
- **Found during:** Task 1 (notification-service.ts implementation)
- **Issue:** resend package not in api package.json; import would fail
- **Fix:** Added resend via pnpm, resolved to v4.8.0
- **Files modified:** packages/api/package.json, pnpm-lock.yaml
- **Verification:** TypeScript compilation passes
- **Committed in:** f209e55 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential dependency addition. No scope creep.

## Issues Encountered
None

## User Setup Required
None - Resend API key already documented in .env.example from Phase 5 email intake.

## Next Phase Readiness
- All 6 notification event types are fully wired and operational
- Phase 7 is complete: backend API, email/Slack delivery, UI components, settings, and event wiring all done
- Ready for end-to-end verification/UAT

---
*Phase: 07-notifications-slack*
*Completed: 2026-03-22*
