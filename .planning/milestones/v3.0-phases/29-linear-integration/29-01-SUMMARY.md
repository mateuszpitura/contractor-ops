---
phase: 29-linear-integration
plan: 01
subsystem: api
tags: [linear, oauth, trpc, prisma, zod, webhooks, graphql, hmac-sha256]

requires:
  - phase: 12-integration-framework
    provides: BaseAdapter, provider registry, credential encryption, webhook pipeline
  - phase: 19-jira-integration
    provides: Jira adapter pattern, status mapping pattern, tRPC router structure
provides:
  - LINEAR enum value in IntegrationProvider
  - PENDING_MAPPING enum value in IntegrationStatus
  - LinearAdapter registered in provider registry with OAuth, refresh, webhook verification, workspace discovery
  - Zod schemas for Linear webhook payload, task config, status mapping, issue metadata
  - Linear tRPC router with teams, status mapping CRUD, task config, linked issue queries
  - OAuth callback sets PENDING_MAPPING for Linear provider (D-03)
affects: [29-02, 29-03, linear-sync, linear-ui]

tech-stack:
  added: []
  patterns:
    - "PENDING_MAPPING status for post-OAuth provider setup requiring configuration before CONNECTED"
    - "URL-encoded token exchange (vs JSON) for Linear OAuth"
    - "GraphQL workspace discovery for team and state enumeration"

key-files:
  created:
    - packages/integrations/src/adapters/linear-adapter.ts
    - packages/validators/src/linear.ts
    - packages/api/src/routers/linear.ts
    - packages/integrations/src/adapters/__tests__/linear-adapter.test.ts
    - packages/validators/src/__tests__/linear.test.ts
  modified:
    - packages/db/prisma/schema/integration.prisma
    - packages/integrations/src/adapters/register-all.ts
    - packages/validators/src/index.ts
    - packages/api/src/root.ts
    - apps/web/src/app/api/oauth/[provider]/callback/route.ts
    - .env.example

key-decisions:
  - "PENDING_MAPPING status enables D-03 requirement: Linear connections require status mapping before bidirectional sync activates"
  - "Linear OAuth uses URL-encoded token exchange (application/x-www-form-urlencoded) unlike Jira's JSON approach"
  - "Teams query accepts both PENDING_MAPPING and CONNECTED statuses so mapping dialog works immediately post-OAuth"

patterns-established:
  - "PENDING_MAPPING status pattern: providers requiring post-OAuth configuration use PENDING_MAPPING -> CONNECTED transition on first config save"

requirements-completed: [LIN-01]

duration: 7min
completed: 2026-04-02
---

# Phase 29 Plan 01: Linear Integration Foundation Summary

**LinearAdapter with OAuth + HMAC-SHA256 webhook verification, Zod validators, PENDING_MAPPING status flow, and 6-procedure tRPC router for Linear issue sync foundation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-01T23:12:41Z
- **Completed:** 2026-04-01T23:19:48Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- LinearAdapter registered in provider registry with OAuth (URL-encoded), token refresh, HMAC-SHA256 webhook verification, and GraphQL workspace discovery
- Prisma schema extended with LINEAR enum and PENDING_MAPPING status for post-OAuth configuration flow (D-03)
- Zod validators for all Linear data structures: webhook payload, task config, status mapping, issue metadata
- Linear tRPC router with teams, status mapping CRUD, task config save, and linked issue queries (single + batch)
- OAuth callback conditionally sets PENDING_MAPPING for Linear provider while preserving CONNECTED for all other providers
- Wave 0 test stubs created for adapter and validator packages

## Task Commits

Each task was committed atomically:

1. **Task 0: Create Wave 0 test stubs** - `5442e55` (test)
2. **Task 1: Prisma enums + LinearAdapter + validators + OAuth callback + env vars** - `298c093` (feat)
3. **Task 2: Linear tRPC router + appRouter registration** - `a4bab36` (feat)

## Files Created/Modified
- `packages/integrations/src/adapters/linear-adapter.ts` - LinearAdapter class with OAuth, refresh, webhook sig verification, workspace discovery
- `packages/validators/src/linear.ts` - Zod schemas for Linear webhook, task config, status mapping, issue metadata
- `packages/api/src/routers/linear.ts` - tRPC router with 6 procedures for Linear integration
- `packages/integrations/src/adapters/__tests__/linear-adapter.test.ts` - Test stubs for adapter
- `packages/validators/src/__tests__/linear.test.ts` - Test stubs for validators
- `packages/db/prisma/schema/integration.prisma` - LINEAR enum, PENDING_MAPPING status
- `packages/integrations/src/adapters/register-all.ts` - LinearAdapter registration
- `packages/validators/src/index.ts` - Linear validator re-exports
- `packages/api/src/root.ts` - linearRouter in appRouter
- `apps/web/src/app/api/oauth/[provider]/callback/route.ts` - PENDING_MAPPING for Linear
- `.env.example` - LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, LINEAR_ENCRYPTION_KEY, LINEAR_WEBHOOK_SECRET

## Decisions Made
- PENDING_MAPPING status enables D-03 requirement: Linear connections require status mapping configuration before bidirectional sync activates
- Linear OAuth uses application/x-www-form-urlencoded token exchange (different from Jira's JSON approach)
- Teams query accepts both PENDING_MAPPING and CONNECTED statuses so the mapping dialog works immediately post-OAuth
- saveStatusMapping transitions PENDING_MAPPING to CONNECTED on first save, enabling sync activation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded __tests__ from validators tsconfig**
- **Found during:** Task 1 (validators compilation)
- **Issue:** Validators package has no vitest dependency; test files with vitest imports caused tsc compilation errors
- **Fix:** Added `src/**/__tests__` to tsconfig.json exclude array (tests are compiled by vitest, not tsc)
- **Files modified:** packages/validators/tsconfig.json
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 298c093 (Task 1 commit)

**2. [Rule 3 - Blocking] Rebuilt validators dist for API package resolution**
- **Found during:** Task 2 (API compilation)
- **Issue:** API package uses dist exports from validators; new Linear exports not available until rebuild
- **Fix:** Ran `npx tsc` in validators package to rebuild dist, then ran `prisma generate` to pick up new enum values
- **Files modified:** packages/validators/dist/ (gitignored)
- **Verification:** `npx tsc --noEmit` in API package exits 0

**3. [Rule 1 - Bug] Added Prisma.InputJsonValue cast for configJson update**
- **Found during:** Task 2 (API compilation)
- **Issue:** TypeScript complained about Record<string, unknown[]> not assignable to Prisma JSON input type
- **Fix:** Added `as Prisma.InputJsonValue` cast and imported Prisma type from @contractor-ops/db
- **Files modified:** packages/api/src/routers/linear.ts
- **Verification:** tsc --noEmit passes cleanly

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required

External services require manual configuration. Environment variables to add:
- `LINEAR_CLIENT_ID` - from Linear Settings > API > OAuth Applications
- `LINEAR_CLIENT_SECRET` - from Linear Settings > API > OAuth Applications
- `LINEAR_ENCRYPTION_KEY` - generate with `openssl rand -hex 32`
- `LINEAR_WEBHOOK_SECRET` - generated during webhook registration via Linear API

## Next Phase Readiness
- LinearAdapter is registered and discoverable via `getAdapter('linear')`
- All Zod schemas are exported for downstream Plans 02 (sync service) and 03 (UI)
- tRPC router shell is wired with status mapping CRUD ready for Plan 02 sync service integration
- PENDING_MAPPING -> CONNECTED transition is wired in saveStatusMapping for D-03 flow

---
*Phase: 29-linear-integration*
*Completed: 2026-04-02*
