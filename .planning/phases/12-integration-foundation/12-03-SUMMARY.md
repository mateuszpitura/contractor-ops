---
phase: 12-integration-foundation
plan: 03
subsystem: auth
tags: [oauth, csrf, hmac, token-refresh, cron, distributed-lock, aes-256-gcm]

# Dependency graph
requires:
  - phase: 12-integration-foundation (plan 01)
    provides: credential encryption service, IntegrationConnection schema with tokenExpiresAt/refreshLockedAt
provides:
  - Generic OAuth state generation with cross-provider CSRF protection
  - Generic OAuth callback route via adapter registry
  - Proactive token refresh cron with distributed locking
  - Lazy refresh fallback for missed cron cycles
  - Vercel Cron configuration for token refresh
affects: [12-04, 12-05, jira-integration, esign-integration, calendar-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [HMAC-SHA256 state signing with provider slug, optimistic distributed lock via DB field, proactive+lazy dual refresh strategy]

key-files:
  created:
    - packages/integrations/src/services/oauth-state.ts
    - packages/integrations/src/services/token-refresh.ts
    - packages/integrations/src/__tests__/oauth-state.test.ts
    - packages/integrations/src/__tests__/token-refresh.test.ts
    - apps/web/src/app/api/oauth/[provider]/callback/route.ts
    - apps/web/src/app/api/cron/token-refresh/route.ts
    - vercel.json
  modified:
    - packages/integrations/src/index.ts

key-decisions:
  - "Use adapter's clientSecretEnvVar for OAuth state signing (not a separate secret)"
  - "Skip registerAllAdapters call in routes since Plan 12-02 creates it (parallel execution)"
  - "Cast provider enum with 'as never' to handle runtime-determined provider values"

patterns-established:
  - "OAuth state format: base64url JSON with {provider, orgId, userId, timestamp, sig} — reuse for all OAuth providers"
  - "Token refresh pattern: proactive cron (30min lookahead, 15min interval) + lazy fallback before API calls"
  - "Distributed lock pattern: optimistic update via refreshLockedAt with 30s TTL, updateMany count check"

requirements-completed: [INTG-01]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 12 Plan 03: OAuth & Token Refresh Summary

**Generic OAuth callback with HMAC-signed cross-provider CSRF state, proactive token refresh cron with distributed lock, and lazy refresh fallback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T13:08:38Z
- **Completed:** 2026-03-23T13:13:04Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- HMAC-SHA256 signed OAuth state with provider slug prevents cross-provider CSRF attacks
- Generic `/api/oauth/[provider]/callback` route exchanges code via adapter, encrypts credentials, upserts IntegrationConnection
- Proactive cron refreshes tokens expiring within 30 minutes using distributed lock
- Lazy refresh fallback triggers when token is expired and cron missed it
- Failed refresh marks connection as REAUTH_REQUIRED for user re-authentication
- 17 new tests (8 OAuth state + 9 token refresh) all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: OAuth state service + generic OAuth callback route** - `34bef5a` (feat)
2. **Task 2: Token refresh service with distributed lock + cron endpoint** - `e6d55c9` (feat)

## Files Created/Modified
- `packages/integrations/src/services/oauth-state.ts` - HMAC-signed state generation and verification with provider slug
- `packages/integrations/src/services/token-refresh.ts` - Proactive and lazy refresh with distributed locking
- `packages/integrations/src/__tests__/oauth-state.test.ts` - 8 tests: valid, wrong provider, wrong secret, expired, tampered
- `packages/integrations/src/__tests__/token-refresh.test.ts` - 9 tests: refresh, lock skip, failure, lazy refresh, edge cases
- `apps/web/src/app/api/oauth/[provider]/callback/route.ts` - Generic OAuth callback using adapter registry
- `apps/web/src/app/api/cron/token-refresh/route.ts` - Vercel Cron endpoint with CRON_SECRET auth
- `vercel.json` - Cron schedule: every 15 minutes for token refresh
- `packages/integrations/src/index.ts` - Added exports for OAuth state and token refresh functions

## Decisions Made
- Used adapter's `clientSecretEnvVar` for OAuth state signing rather than introducing a separate signing secret — keeps env var count minimal and ties state security to the provider's own credentials
- Skipped `registerAllAdapters()` call in routes since Plan 12-02 creates it in parallel — routes use `getAdapter()` directly, Plan 12-04 will wire up the registration
- Used `as never` type assertion for runtime-determined provider enum values in Prisma queries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed vi.mock path for credential-service in token-refresh tests**
- **Found during:** Task 2 (token refresh tests)
- **Issue:** Mock path `./credential-service.js` was relative to test file, not matching the import path in token-refresh.ts
- **Fix:** Changed mock path to `../services/credential-service.js` to match the module resolution
- **Files modified:** `packages/integrations/src/__tests__/token-refresh.test.ts`
- **Verification:** All 9 tests pass
- **Committed in:** `e6d55c9` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test mock path fix was necessary for tests to function. No scope creep.

## Issues Encountered
None beyond the mock path fix documented above.

## User Setup Required
None - CRON_SECRET was already in `.env.example` from v1.0.

## Next Phase Readiness
- OAuth callback and token refresh infrastructure ready for all providers
- Plan 12-04 will create provider-specific adapters that use `exchangeCodeForTokens` and `refreshToken`
- Plan 12-05 will wire up the tRPC router to use the generic OAuth flow
- `registerAllAdapters` from Plan 12-02 needs to be called in routes when available

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (34bef5a, e6d55c9) verified in git log.

---
*Phase: 12-integration-foundation*
*Completed: 2026-03-23*
