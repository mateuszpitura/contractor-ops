---
phase: 17-ksef-integration
plan: 02
subsystem: api
tags: [ksef, sync, qstash, cron, duplicate-detection, trpc, xml-parser]

requires:
  - phase: 17-ksef-integration plan 01
    provides: KsefApiClient, parseFa3Xml, mapKsefToInvoiceFields, ksef validators
  - phase: 12-integration-foundation
    provides: credential-service, qstash-client, IntegrationConnection/SyncLog models

provides:
  - processKsefSync orchestrator (auth, query, parse, create, match, deduplicate, notify)
  - ksefRouter with connect/disconnect/triggerSync/syncHistory/connectionStatus
  - QStash cron endpoint at /api/ksef/_sync
  - Cross-source duplicate detection by invoiceNumber + sellerTaxId
  - KSEF_SYNC_COMPLETE notification type

affects: [17-ksef-integration plan 03, dashboard, invoices, settings]

tech-stack:
  added: []
  patterns: [qstash-cron-schedule-on-connect, cross-source-duplicate-detection, bidirectional-flag-linking]

key-files:
  created:
    - packages/api/src/services/ksef-sync-orchestrator.ts
    - packages/api/src/services/ksef-duplicate-detection.ts
    - packages/api/src/routers/ksef.ts
    - apps/web/src/app/api/ksef/_sync/route.ts
    - packages/api/src/services/__tests__/ksef-sync.test.ts
    - packages/api/src/services/__tests__/ksef-duplicate.test.ts
  modified:
    - packages/validators/src/notification.ts
    - packages/api/src/root.ts

key-decisions:
  - "dueDate fallback: issueDate + 14 days when KSeF invoice has no payment term"
  - "dispatch notification uses dispatch(NotificationEvent) with recipient lookup for admin/finance users"
  - "Skip distributed Redis lock for now since @upstash/redis not in api package; use externalInvoiceId dedup instead"

patterns-established:
  - "KSeF sync: findFirst by externalInvoiceId to skip already-fetched invoices"
  - "QStash schedule lifecycle: create on connect, delete on disconnect, immediate publish on triggerSync"
  - "Cross-source duplicate: invoiceNumber + sellerTaxId case-insensitive + bidirectional flagsJson linking"

requirements-completed: [KSEF-01, KSEF-03, KSEF-04]

duration: 4min
completed: 2026-03-27
---

# Phase 17 Plan 02: KSeF Sync Pipeline Summary

**KSeF sync orchestrator with hourly QStash cron, cross-source duplicate detection by invoiceNumber+sellerTaxId, tRPC router with connect/disconnect/triggerSync, and KSEF_SYNC_COMPLETE notification**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T17:25:13Z
- **Completed:** 2026-03-27T17:29:46Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Full KSeF sync pipeline: authenticate, query invoices, download XML, parse FA(3), create Invoice records, run auto-matching, detect and link cross-source duplicates
- KSeF tRPC router with credential verification on connect, QStash hourly cron scheduling, immediate sync trigger, sync history, and connection status
- QStash callback endpoint at /api/ksef/_sync with signature verification matching existing OCR pattern
- Cross-source duplicate detection flags invoices matching by invoiceNumber + sellerTaxId, with bidirectional linking in flagsJson

## Task Commits

Each task was committed atomically:

1. **Task 1: KSeF sync orchestrator, duplicate detection, and notification type** - `d69b9f9` (feat)
2. **Task 2: KSeF tRPC router, QStash cron route, and test stubs** - `e233480` (feat)

## Files Created/Modified
- `packages/api/src/services/ksef-sync-orchestrator.ts` - End-to-end sync: auth, query, parse, create invoices, match, notify
- `packages/api/src/services/ksef-duplicate-detection.ts` - Cross-source duplicate detection and bidirectional linking
- `packages/api/src/routers/ksef.ts` - tRPC router: connect, disconnect, triggerSync, syncHistory, connectionStatus
- `apps/web/src/app/api/ksef/_sync/route.ts` - QStash callback for scheduled/manual sync
- `packages/validators/src/notification.ts` - Added KSEF_SYNC_COMPLETE notification type
- `packages/api/src/root.ts` - Registered ksefRouter in app router
- `packages/api/src/services/__tests__/ksef-sync.test.ts` - 12 todo test stubs for sync orchestrator
- `packages/api/src/services/__tests__/ksef-duplicate.test.ts` - 7 todo test stubs for duplicate detection

## Decisions Made
- Used issueDate + 14 days as fallback dueDate when KSeF invoice has no payment terms (Prisma requires non-null dueDate)
- Used full NotificationEvent interface for dispatch (including recipientUserIds lookup for admin/finance members) rather than simplified interface from plan
- Skipped distributed Redis lock (not available in api package) and used externalInvoiceId uniqueness check to prevent duplicate fetching
- Used findFirst + create/update pattern instead of upsert since no @@unique([organizationId, provider]) constraint exists on IntegrationConnection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed null dueDate from mapKsefToInvoiceFields**
- **Found during:** Task 1 (sync orchestrator)
- **Issue:** mapKsefToInvoiceFields returns `dueDate: null` when payment info missing, but Prisma Invoice requires non-null dueDate
- **Fix:** Added fallback: `dueDate ?? new Date(issueDate + 14 days)`
- **Files modified:** packages/api/src/services/ksef-sync-orchestrator.ts
- **Verification:** `pnpm --filter @contractor-ops/api build` passes
- **Committed in:** d69b9f9

**2. [Rule 1 - Bug] Adapted dispatch call to NotificationEvent interface**
- **Found during:** Task 1 (sync orchestrator)
- **Issue:** Plan specified simplified dispatch({type, title, message, link}) but actual dispatch() requires full NotificationEvent with recipientUserIds, entityType, entityId
- **Fix:** Added member query for admin/finance users and built complete NotificationEvent
- **Files modified:** packages/api/src/services/ksef-sync-orchestrator.ts
- **Verification:** TypeScript build passes
- **Committed in:** d69b9f9

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for type correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. KSeF connection uses existing credential encryption pattern (requires KSEF_ENCRYPTION_KEY env var from Phase 17 Plan 01).

## Known Stubs
None - all services are fully wired to real data sources. Test files contain todo stubs per plan specification.

## Next Phase Readiness
- KSeF sync pipeline ready for UI integration (Plan 03: settings page, sync status, manual trigger button)
- ksefRouter registered and accessible via tRPC client
- QStash cron will activate automatically when organization connects to KSeF

---
*Phase: 17-ksef-integration*
*Completed: 2026-03-27*

## Self-Check: PASSED

All 7 files verified present. Both task commits (d69b9f9, e233480) verified in git log.
