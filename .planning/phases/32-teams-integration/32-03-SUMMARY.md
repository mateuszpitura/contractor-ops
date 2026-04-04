---
phase: 32-teams-integration
plan: 03
subsystem: api
tags: [botbuilder, teams, bot-framework, adaptive-cards, trpc, zod]

requires:
  - phase: 32-teams-integration/01
    provides: MessagingProvider interface, SlackMessagingProvider, getConnectedMessagingProviders factory
  - phase: 32-teams-integration/02
    provides: Adaptive Card builders, Graph API client (stub compatibility)
provides:
  - TeamsBotHandler processing card actions with Zod-validated payloads
  - TeamsMessagingProvider for proactive messaging via Bot Framework
  - Bot Framework endpoint at /api/teams/messages
  - tRPC teams router for channel discovery and mapping CRUD
  - ConversationReference storage/retrieval for proactive messaging
  - Azure Bot Service setup documentation per D-11
affects: [32-teams-integration/04, notification-service]

tech-stack:
  added: [botbuilder@4.23.3]
  patterns: [req/res shim for Bot Framework in Next.js, Zod validation on invoke payloads, ConversationReference persistence in configJson]

key-files:
  created:
    - packages/api/src/services/teams/teams-bot-handler.ts
    - packages/api/src/services/messaging/teams-messaging-provider.ts
    - packages/api/src/routers/teams.ts
    - apps/web/src/app/api/teams/messages/route.ts
    - packages/api/src/services/teams/__tests__/teams-bot-handler.test.ts
    - packages/api/src/services/teams/__tests__/conversation-ref.test.ts
    - packages/api/src/routers/__tests__/teams.test.ts
    - docs/setup/teams-bot-setup.md
  modified:
    - packages/api/src/services/messaging/index.ts
    - packages/api/src/root.ts
    - packages/api/package.json

key-decisions:
  - "Stub card builders and graph client for Plan 02 merge compatibility -- will be replaced when Plan 02 merges"
  - "ConversationReference stored in IntegrationConnection.configJson keyed by aadObjectId"
  - "CloudAdapter singleton pattern shared between endpoint and messaging provider"
  - "Bot approval flow uses direct Prisma transactions matching existing approval router pattern"
  - "Override onTeamsMembersAdded/onInstallationUpdateAdd instead of onConversationUpdateActivity to avoid TeamsActivityHandler internal channelData access"

patterns-established:
  - "Req/res shim pattern: Buffer Next.js Request body, create plain headers object, capture response via shim for Bot Framework CloudAdapter.process()"
  - "Zod schema per invoke action type: approveInvokeSchema, rejectInvokeSchema, submitRejectionSchema, taskModuleFetchSchema"

requirements-completed: [TEAM-01, TEAM-03, TEAM-04, TEAM-05, TEAM-06]

duration: 13min
completed: 2026-04-04
---

# Phase 32 Plan 03: Teams Bot Handler & Backend Summary

**TeamsBotHandler with Zod-validated card actions, TeamsMessagingProvider for proactive messaging, Bot Framework endpoint, tRPC channel router, and Azure Bot Service setup guide**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-04T08:48:46Z
- **Completed:** 2026-04-04T09:01:46Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- TeamsBotHandler processes approve/reject card actions with full Zod validation on all invoke payloads
- TeamsMessagingProvider plugged into MessagingProvider dispatch system from Plan 01
- Bot Framework endpoint at /api/teams/messages with req/res shim for Next.js compatibility
- tRPC teams router with getTeams, getChannels, channelMapping CRUD, and connectionStatus
- 25 tests passing across bot handler, conversation reference storage, and router
- Azure Bot Service setup guide with troubleshooting section per D-11

## Task Commits

Each task was committed atomically:

1. **Task 1: TeamsBotHandler, TeamsMessagingProvider, Bot Framework endpoint, tRPC router, and tests** - `634fe31` (feat)
2. **Task 2: Create USER-SETUP.md for Azure Bot Service registration per D-11** - `3210d72` (docs)

## Files Created/Modified
- `packages/api/src/services/teams/teams-bot-handler.ts` - TeamsActivityHandler subclass with card action handlers and ConversationReference storage
- `packages/api/src/services/messaging/teams-messaging-provider.ts` - MessagingProvider implementation using CloudAdapter continueConversation
- `packages/api/src/routers/teams.ts` - tRPC router for Teams channel discovery and mapping
- `apps/web/src/app/api/teams/messages/route.ts` - Bot Framework messaging endpoint with req/res shim
- `packages/api/src/services/messaging/index.ts` - Added TeamsMessagingProvider to factory
- `packages/api/src/root.ts` - Wired teamsRouter into appRouter
- `packages/api/src/services/teams/cards/*.ts` - Stub card builders for Plan 02 merge compatibility
- `packages/api/src/services/teams/teams-graph-client.ts` - Stub Graph API client for Plan 02 merge
- `packages/api/src/services/teams/__tests__/teams-bot-handler.test.ts` - 10 tests for card action handlers
- `packages/api/src/services/teams/__tests__/conversation-ref.test.ts` - 10 tests for TEAM-06 ConversationReference storage
- `packages/api/src/routers/__tests__/teams.test.ts` - 5 tests for tRPC router
- `docs/setup/teams-bot-setup.md` - Complete Azure Bot Service registration guide

## Decisions Made
- Used stub card builders and graph client to allow parallel execution with Plan 02 -- Plan 02 will replace these with real implementations on merge
- ConversationReference stored in IntegrationConnection.configJson keyed by AAD Object ID, team refs keyed by team ID
- CloudAdapter singleton shared between Bot Framework endpoint and TeamsMessagingProvider
- Bot approval flow processes directly through Prisma transactions matching existing approval router pattern (not through tRPC)
- Overrode onTeamsMembersAdded/onInstallationUpdateAdd instead of onConversationUpdateActivity to avoid TeamsActivityHandler internal channelData access that caused test failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created stub card builders and graph client for Plan 02 dependencies**
- **Found during:** Task 1 (Implementation)
- **Issue:** Plan 02 card builders and Graph API client don't exist yet (running in parallel)
- **Fix:** Created minimal stub files with correct export signatures that throw on invocation
- **Files modified:** packages/api/src/services/teams/cards/*.ts, packages/api/src/services/teams/teams-graph-client.ts
- **Verification:** All imports resolve, tests pass with mocks
- **Committed in:** 634fe31

**2. [Rule 1 - Bug] Fixed ConversationUpdate handler to use Teams-specific method overrides**
- **Found during:** Task 1 (Test verification)
- **Issue:** Using onConversationUpdateActivity in constructor caused TeamsActivityHandler to access context.activity.channelData.channel.id which was undefined in test contexts
- **Fix:** Replaced with overrides of onTeamsMembersAdded and onInstallationUpdateAdd
- **Verification:** 25 tests pass with no unhandled rejections

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for parallel execution compatibility and test correctness. No scope creep.

## Known Stubs

- `packages/api/src/services/teams/cards/approval-card.ts` - Stub, replaced by Plan 02
- `packages/api/src/services/teams/cards/approval-result-card.ts` - Stub, replaced by Plan 02
- `packages/api/src/services/teams/cards/reject-modal-card.ts` - Stub, replaced by Plan 02
- `packages/api/src/services/teams/cards/activity-alert-card.ts` - Stub, replaced by Plan 02
- `packages/api/src/services/teams/cards/approval-reminder-card.ts` - Stub, replaced by Plan 02
- `packages/api/src/services/teams/teams-graph-client.ts` - Stub, replaced by Plan 02

All stubs are intentional for parallel execution and will be replaced when Plan 02 branch merges.

## User Setup Required

**External services require manual configuration.** See [docs/setup/teams-bot-setup.md](../../../../docs/setup/teams-bot-setup.md) for:
- Azure AD App Registration creation
- Azure Bot Service configuration
- Microsoft Teams channel enablement
- API permissions and admin consent
- Environment variables: `AZURE_BOT_APP_ID`, `AZURE_BOT_APP_SECRET`, `TEAMS_ENCRYPTION_KEY`

## Next Phase Readiness
- Bot handler and messaging provider ready for Plan 04 (Settings UI)
- tRPC router provides all endpoints needed for Teams settings panel
- Card stubs will be replaced when Plan 02 merges -- no additional work needed in Plan 03

---
*Phase: 32-teams-integration*
*Completed: 2026-04-04*
