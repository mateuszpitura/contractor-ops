---
phase: 29-linear-integration
plan: 02
subsystem: api
tags: [linear, graphql, webhooks, bidirectional-sync, status-mapping, loop-prevention]

requires:
  - phase: 29-linear-integration
    provides: LinearAdapter, Zod validators, tRPC router shell, PENDING_MAPPING status, LINEAR enum
  - phase: 12-integration-framework
    provides: BaseAdapter, credential encryption, webhook pipeline
  - phase: 19-jira-integration
    provides: Jira sync service patterns (status mapping, issue sync, webhook handler)
provides:
  - Linear status mapping service with bidirectional resolution and PENDING_MAPPING->CONNECTED transition (D-03)
  - Linear issue sync service with GraphQL helper, email-based assignee lookup, outbound status sync with 30s loop prevention
  - Linear webhook handler processing inbound state changes with dedup and unmapped state logging (D-04)
  - Webhook registration/deregistration via Linear GraphQL mutations
  - Workflow router wired for auto-issue creation on task start and outbound sync on complete/skip
affects: [29-03, linear-ui, linear-webhooks]

tech-stack:
  added: []
  patterns:
    - "linearGraphQL reusable helper for all Linear API calls (shared across services and router)"
    - "Fire-and-forget outbound sync pattern: void syncTaskStatusToLinear().catch() on status transitions"
    - "Webhook registration triggered by first saveStatusMapping call per team"

key-files:
  created:
    - packages/api/src/services/linear-status-mapping.ts
    - packages/api/src/services/linear-issue-sync.ts
    - packages/api/src/services/linear-webhook-handler.ts
    - packages/api/src/__tests__/linear-status-mapping.test.ts
    - packages/api/src/__tests__/linear-issue-sync.test.ts
  modified:
    - packages/api/src/routers/linear.ts
    - packages/api/src/routers/workflow.ts

key-decisions:
  - "linearGraphQL helper exported from linear-issue-sync.ts for reuse across services and tRPC router"
  - "Webhook registration fires as fire-and-forget on first saveStatusMapping per team, not as a separate admin action"
  - "syncTaskStatusToLinear resolves teamId from task template configJson, consistent with Jira pattern"

patterns-established:
  - "Linear bidirectional sync: outbound via syncTaskStatusToLinear, inbound via processLinearWebhook, both with 30s loop prevention window"
  - "State cache in configJson.stateCache[teamId] for fast webhook reverse-lookup without API calls"

requirements-completed: [LIN-02, LIN-03, LIN-04, LIN-05]

duration: 6min
completed: 2026-04-02
---

# Phase 29 Plan 02: Linear Bidirectional Sync Engine Summary

**Bidirectional Linear sync with status mapping (PENDING_MAPPING->CONNECTED D-03), GraphQL issue creation with email assignee lookup, inbound webhook processing, and workflow router integration for auto-issue creation and outbound status sync**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-01T23:23:06Z
- **Completed:** 2026-04-01T23:29:35Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Status mapping service with bidirectional resolution (resolveLinearStateId / resolveInternalStatus) and PENDING_MAPPING->CONNECTED transition on first save (D-03)
- Issue sync service with linearGraphQL helper, createLinearIssue with email-based assignee lookup (D-07 fallback), syncTaskStatusToLinear with 30s loop prevention
- Webhook handler processing inbound state changes with dedup, loop prevention, unmapped state logging (D-04), and state cache auto-population
- Workflow router wired: linear-enabled tasks auto-create Linear issues on run start, completeTask/skipTask trigger outbound sync
- Webhook registration/deregistration via Linear GraphQL mutations, triggered on first saveStatusMapping

## Task Commits

Each task was committed atomically:

1. **Task 0: Create Wave 0 test stubs** - `81b164a` (test)
2. **Task 1: Status mapping service + Linear GraphQL helper + issue sync service** - `409c633` (feat)
3. **Task 2: Webhook handler + workflow task start hook wiring** - `478804f` (feat)

## Files Created/Modified
- `packages/api/src/services/linear-status-mapping.ts` - Status mapping CRUD, bidirectional resolution, D-03 PENDING_MAPPING->CONNECTED transition
- `packages/api/src/services/linear-issue-sync.ts` - linearGraphQL helper, createLinearIssue, syncTaskStatusToLinear with loop prevention
- `packages/api/src/services/linear-webhook-handler.ts` - processLinearWebhook, registerLinearWebhook, deregisterLinearWebhook
- `packages/api/src/__tests__/linear-status-mapping.test.ts` - 11 test stubs for status mapping service
- `packages/api/src/__tests__/linear-issue-sync.test.ts` - 14 test stubs for issue sync and webhook processing
- `packages/api/src/routers/linear.ts` - Updated teams query to use linearGraphQL, added webhook registration on saveStatusMapping
- `packages/api/src/routers/workflow.ts` - Added Linear issue creation on startRun, outbound sync on completeTask/skipTask

## Decisions Made
- linearGraphQL helper exported from linear-issue-sync.ts for reuse across services and tRPC router
- Webhook registration fires as fire-and-forget on first saveStatusMapping per team, not as a separate admin action
- syncTaskStatusToLinear resolves teamId from task template configJson, consistent with Jira pattern
- State cache in configJson.stateCache[teamId] enables fast webhook reverse-lookup without extra API calls

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no additional external service configuration required beyond Plan 01 env variables.

## Next Phase Readiness
- All sync services are wired and ready for Plan 03 (UI components)
- linearGraphQL is reusable for any Linear API calls in the UI layer
- Webhook handler ready to receive Linear webhooks at /api/webhooks/linear endpoint
- Status mapping, issue creation, and bidirectional sync all compile and run

---
*Phase: 29-linear-integration*
*Completed: 2026-04-02*
