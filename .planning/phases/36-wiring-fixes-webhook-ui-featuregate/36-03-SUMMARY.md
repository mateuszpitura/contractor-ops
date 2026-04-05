---
phase: 36-wiring-fixes-webhook-ui-featuregate
plan: 03
subsystem: api
tags: [trpc, middleware, feature-gate, subscription-tier, sonner, toast]

# Dependency graph
requires:
  - phase: 35
    provides: requireTier middleware in packages/api/src/middleware/tier.ts
provides:
  - requireTier("PRO") on all integration mutation procedures (Linear, Jira, Calendar)
  - requireTier("PRO") on OCR trigger/retrigger mutations
  - requireTier("ENTERPRISE") on audit log export
  - Global TIER_REQUIRED error handler in QueryClient with upgrade toast
affects: [billing, integrations, ocr, audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global mutation error handler pattern: handleTierError in QueryClient onError"
    - "requireTier chained after requirePermission on mutation procedures"

key-files:
  created: []
  modified:
    - packages/api/src/routers/linear.ts
    - packages/api/src/routers/jira.ts
    - packages/api/src/routers/calendar.ts
    - packages/api/src/routers/ocr.ts
    - packages/api/src/routers/audit.ts
    - apps/web/src/trpc/query-client.ts
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Gate mutations only -- read queries remain ungated so STARTER users can browse integration status for upgrade prompts"
  - "QueryClient handleTierError uses hardcoded English strings because initialization is outside next-intl provider; i18n keys added for future component-context use"

patterns-established:
  - "requireTier chain order: tenantProcedure.use(requirePermission).use(requireTier).input()"
  - "Global mutation onError for structured tRPC error interception with toast"

requirements-completed: [BILL-09]

# Metrics
duration: 3min
completed: 2026-04-05
---

# Phase 36 Plan 03: Feature Gating Summary

**requireTier middleware applied to 10 integration/OCR/audit mutations with global TIER_REQUIRED upgrade toast in QueryClient**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T13:11:30Z
- **Completed:** 2026-04-05T13:14:09Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- All integration mutation procedures (Linear, Jira, Calendar) gated with requireTier("PRO")
- OCR trigger/retrigger gated with requireTier("PRO"), audit export with requireTier("ENTERPRISE")
- Global TIER_REQUIRED error handler in QueryClient shows upgrade toast via sonner with billing link
- Read-only queries remain ungated -- STARTER users can still browse integration status

## Task Commits

Each task was committed atomically:

1. **Task 1: Add requireTier middleware to integration, OCR, and audit routers** - `4675c23` (feat)
2. **Task 2: Add global TIER_REQUIRED error handler in QueryClient** - `0a6f831` (feat)

## Files Created/Modified
- `packages/api/src/routers/linear.ts` - Added requireTier("PRO") on saveStatusMapping, saveTaskConfig
- `packages/api/src/routers/jira.ts` - Added requireTier("PRO") on saveStatusMapping, saveTaskConfig, disconnect
- `packages/api/src/routers/calendar.ts` - Added requireTier("PRO") on disconnect, saveTaskConfig
- `packages/api/src/routers/ocr.ts` - Added requireTier("PRO") on trigger, retrigger
- `packages/api/src/routers/audit.ts` - Added requireTier("ENTERPRISE") on export
- `apps/web/src/trpc/query-client.ts` - handleTierError function + onError in mutations defaultOptions
- `apps/web/messages/en.json` - tierErrorToast and upgradeAction i18n keys
- `apps/web/messages/pl.json` - tierErrorToast and upgradeAction i18n keys

## Decisions Made
- Gate mutations only -- read queries remain ungated so STARTER users can browse integration status for upgrade prompts
- QueryClient handleTierError uses hardcoded English strings because initialization is outside next-intl provider; i18n keys added for future component-context use

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript compilation shows pre-existing errors in unrelated files (time-entry.ts, email templates, missing module declarations) -- not caused by this plan's changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Feature gating complete for all tier-restricted procedures
- TIER_REQUIRED errors now intercepted globally with upgrade prompts
- BILL-09 requirement fulfilled

---
*Phase: 36-wiring-fixes-webhook-ui-featuregate*
*Completed: 2026-04-05*
