---
phase: 32-teams-integration
plan: 02
subsystem: integrations
tags: [teams, azure-ad, oauth, adaptive-cards, graph-api, botbuilder]

requires:
  - phase: 32-teams-integration-01
    provides: MessagingProvider interface, SlackMessagingProvider, schema foundations
provides:
  - TeamsAdapter with Azure AD OAuth and AES-256-GCM credential encryption
  - 5 Adaptive Card builders (approval, result, alert, reminder, reject-modal)
  - Graph API client for team/channel/user discovery
  - TeamsAdapter registered in adapter registry
affects: [32-teams-integration-03, 32-teams-integration-04]

tech-stack:
  added: [botbuilder, "@microsoft/microsoft-graph-client", "@azure/identity"]
  patterns: [adaptive-card-builder, graph-api-delegated-auth, msteams-task-fetch-modal]

key-files:
  created:
    - packages/integrations/src/adapters/teams-adapter.ts
    - packages/api/src/services/teams/cards/approval-card.ts
    - packages/api/src/services/teams/cards/approval-result-card.ts
    - packages/api/src/services/teams/cards/activity-alert-card.ts
    - packages/api/src/services/teams/cards/approval-reminder-card.ts
    - packages/api/src/services/teams/cards/reject-modal-card.ts
    - packages/api/src/services/teams/teams-graph-client.ts
    - packages/integrations/src/__tests__/teams-adapter.test.ts
    - packages/api/src/services/teams/__tests__/cards.test.ts
  modified:
    - packages/integrations/src/adapters/register-all.ts
    - packages/api/package.json

key-decisions:
  - "TeamsAdapter slug is microsoft_teams (underscore convention matches Prisma enum MICROSOFT_TEAMS)"
  - "Reject button uses msteams.type task/fetch to trigger Teams task module for rejection modal"
  - "Graph API client uses simple authProvider callback with delegated user tokens (no @azure/identity needed at runtime)"

patterns-established:
  - "Adaptive Card builder pattern: pure functions returning Record<string, unknown> JSON for v1.4 cards"
  - "msteams task/fetch in Action.Submit data triggers Teams task module dialog"

requirements-completed: [TEAM-01, TEAM-03]

duration: 5min
completed: 2026-04-04
---

# Phase 32 Plan 02: TeamsAdapter and Adaptive Cards Summary

**TeamsAdapter with Azure AD OAuth, 5 Adaptive Card templates for approval workflow, and Graph API client for channel discovery**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-04T08:48:48Z
- **Completed:** 2026-04-04T08:53:49Z
- **Tasks:** 1
- **Files modified:** 11

## Accomplishments
- TeamsAdapter extends BaseAdapter with Azure AD OAuth config, token exchange/refresh, and credential-service AES-256-GCM encryption
- 5 Adaptive Card builders: approval request, approval result, activity alert, approval reminder, and reject modal
- Graph API client with getJoinedTeams, getTeamsChannels, and getUserByEmail functions
- 28 tests passing (7 adapter identity/config + 21 card structure/payload tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: TeamsAdapter, Adaptive Card templates, Graph API client, and tests** - `a8580c6` (feat)

## Files Created/Modified
- `packages/integrations/src/adapters/teams-adapter.ts` - TeamsAdapter with Azure AD OAuth, credential encryption, health status
- `packages/integrations/src/adapters/register-all.ts` - Added TeamsAdapter registration
- `packages/api/src/services/teams/cards/approval-card.ts` - Approval request card with approve/reject buttons
- `packages/api/src/services/teams/cards/approval-result-card.ts` - Approval/rejection result card
- `packages/api/src/services/teams/cards/activity-alert-card.ts` - Compact activity alert card for channels
- `packages/api/src/services/teams/cards/approval-reminder-card.ts` - Overdue reminder card with action buttons
- `packages/api/src/services/teams/cards/reject-modal-card.ts` - Reject modal card for task module dialog
- `packages/api/src/services/teams/teams-graph-client.ts` - Graph API wrapper for team/channel/user discovery
- `packages/integrations/src/__tests__/teams-adapter.test.ts` - Adapter identity and OAuth config tests
- `packages/api/src/services/teams/__tests__/cards.test.ts` - All 5 card builder tests
- `packages/api/package.json` - Added botbuilder, @microsoft/microsoft-graph-client, @azure/identity

## Decisions Made
- TeamsAdapter slug is `microsoft_teams` (underscore convention so toUpperCase maps to MICROSOFT_TEAMS Prisma enum)
- Reject button uses `msteams.type: "task/fetch"` in data to trigger Teams task module for rejection modal dialog
- Graph API client uses simple authProvider callback with delegated user tokens rather than @azure/identity ClientSecretCredential
- supportsWebhooks set to false because Bot Framework handles messaging channel directly, not through generic webhook pipeline

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- pnpm install failed due to missing @contractor-ops/logger workspace package (being created by parallel agent) -- used npx vitest directly for test execution

## User Setup Required

None - no external service configuration required. Environment variables (AZURE_BOT_APP_ID, AZURE_BOT_APP_SECRET, MICROSOFT_TEAMS_ENCRYPTION_KEY) will be documented in Plan 04.

## Next Phase Readiness
- TeamsAdapter and card builders ready for Plan 03 (Bot Framework handler and TeamsMessagingProvider)
- Graph API client ready for channel mapping in provider settings UI
- All Adaptive Card JSON structures tested and ready to be sent via Bot Framework

---
*Phase: 32-teams-integration*
*Completed: 2026-04-04*

## Self-Check: PASSED
