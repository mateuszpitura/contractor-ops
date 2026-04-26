---
phase: 12-integration-foundation
plan: 04
subsystem: ui, api, integrations
tags: [tanstack-query, trpc, shadcn, health-monitoring, provider-cards, sheet, date-fns]

# Dependency graph
requires:
  - phase: 12-01
    provides: "Integration types (ProviderHealthStatus), credential service, registry"
  - phase: 12-02
    provides: "Webhook pipeline (adapters, dispatcher, QStash)"
  - phase: 12-03
    provides: "OAuth state service, token refresh service"
provides:
  - "Health monitoring service (getProviderHealth, getAllProviderHealth)"
  - "Generic tRPC procedures for all providers (getAllHealth, getHealth, getOAuthUrlGeneric, disconnectGeneric, getSyncLog, getWebhookLog)"
  - "Provider connection card UI component (ProviderConnectionCard)"
  - "Provider detail sheet with sync log and webhook deliveries (ProviderDetailSheet)"
  - "Integrations tab with responsive provider grid (IntegrationsTab)"
  - "Generic provider validator schemas"
affects: [12-05, 13, 14, 15]

# Tech tracking
tech-stack:
  added: [date-fns (formatDistanceToNow, isBefore, addHours)]
  patterns: [generic-provider-card, health-polling-30s, cursor-pagination-trpc, provider-detail-sheet]

key-files:
  created:
    - packages/integrations/src/services/health-service.ts
    - packages/integrations/src/__tests__/health-service.test.ts
    - apps/web/src/components/settings/provider-connection-card.tsx
    - apps/web/src/components/settings/provider-detail-sheet.tsx
    - apps/web/src/components/settings/integrations-tab.tsx
  modified:
    - packages/api/src/routers/integration.ts
    - packages/validators/src/integration.ts
    - packages/validators/src/index.ts
    - packages/api/package.json
    - packages/integrations/src/index.ts
    - packages/integrations/package.json
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json
    - packages/integrations/src/services/webhook-dispatcher.ts

key-decisions:
  - "Generic provider card replaces inline SlackConnectionCard in settings page"
  - "Static provider config array in IntegrationsTab (will be dynamic in future phases)"
  - "30-second polling via TanStack Query refetchInterval (no WebSocket)"

patterns-established:
  - "Provider card pattern: ProviderConnectionCard with provider slug, icon, description props"
  - "Detail sheet pattern: cursor-based pagination for sync/webhook logs"
  - "Token expiry color coding: green >1h, amber <1h, red expired"
  - "Generic tRPC procedures alongside Slack-specific for backward compatibility"

requirements-completed: [INTG-03]

# Metrics
duration: 11min
completed: 2026-03-23
---

# Phase 12 Plan 04: Health Monitoring + Provider UI Summary

**Health monitoring service with provider card grid, detail sheet (sync log + webhook deliveries), and 30-second polling via TanStack Query**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-23T13:17:57Z
- **Completed:** 2026-03-23T13:29:32Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Health service aggregates connection state, sync logs, webhooks, and 24h error counts per provider
- Generic tRPC procedures support any registered provider (not just Slack) while preserving backward compatibility
- Provider cards display in responsive grid (1/2/3 cols) with semantic status badges, OAuth connect/disconnect, and token expiry countdown
- Detail sheet shows connection metadata, sync log table, and webhook delivery table with cursor-based "Load more" pagination
- Full i18n for all new UI copy (English + Polish)

## Task Commits

Each task was committed atomically:

1. **Task 1: Health service + generic tRPC integration procedures** - `d1b2594` (feat)
2. **Task 2: Provider connection card + detail sheet UI components** - `30c4f84` (feat)

## Files Created/Modified
- `packages/integrations/src/services/health-service.ts` - Health status aggregation from connection + sync logs + webhooks
- `packages/integrations/src/__tests__/health-service.test.ts` - Tests for health service (4 tests)
- `packages/api/src/routers/integration.ts` - Added 6 generic tRPC procedures alongside existing Slack-specific ones
- `packages/validators/src/integration.ts` - Generic provider schemas (providerSlug, getSyncLog, getWebhookLog, etc.)
- `apps/web/src/components/settings/provider-connection-card.tsx` - Generic provider card with status badges, OAuth, disconnect, 30s polling
- `apps/web/src/components/settings/provider-detail-sheet.tsx` - Detail sheet with connection info, sync log, webhook deliveries
- `apps/web/src/components/settings/integrations-tab.tsx` - Responsive provider grid with empty state
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` - Replaced SlackConnectionCard with IntegrationsTab
- `apps/web/messages/en.json` - Generic provider i18n keys
- `apps/web/messages/pl.json` - Polish translations for provider UI

## Decisions Made
- Used static provider config array in IntegrationsTab rather than dynamic registry API -- simpler for now, one Slack provider. Future phases will add more providers to the array.
- Preserved all existing Slack-specific tRPC procedures (getSlackStatus, getOAuthUrl, disconnect) for backward compatibility. New generic procedures added alongside.
- Used date-fns for token expiry formatting (already in web app dependencies).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @contractor-ops/integrations dependency to API package**
- **Found during:** Task 1
- **Issue:** API package had no dependency on integrations package, TypeScript couldn't resolve imports
- **Fix:** Added workspace dependency in package.json
- **Files modified:** packages/api/package.json
- **Verification:** TypeScript compiles without integration-related errors

**2. [Rule 3 - Blocking] Fixed IntegrationProvider import in webhook-dispatcher**
- **Found during:** Task 2 (pre-existing issue blocking integrations build)
- **Issue:** `IntegrationProvider` type not exported from `@contractor-ops/db`, preventing package build
- **Fix:** Replaced with inline type assertion `as "SLACK"`
- **Files modified:** packages/integrations/src/services/webhook-dispatcher.ts
- **Verification:** Package builds successfully

**3. [Rule 3 - Blocking] Fixed integrations package.json main export**
- **Found during:** Task 2
- **Issue:** Main export pointed to dist/ but package couldn't build due to pre-existing issue. Other sub-path exports already used src.
- **Fix:** Changed main export to point to src/index.ts instead of dist/index.js
- **Files modified:** packages/integrations/package.json
- **Verification:** API package and web app can resolve integrations imports

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes were necessary to unblock compilation. No scope creep.

## Issues Encountered
- Pre-existing type errors in web app (import-wizard-dialog, onboarding-checklist, command-palette) unrelated to this plan's changes.
- Pre-existing missing integrations dependency in web app for API routes created by Plans 02/03 (token-refresh, oauth callback, webhook routes). Not in scope for this plan.

## Known Stubs
None - all data flows are wired to real tRPC procedures.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Health monitoring and provider UI complete, ready for Plan 05 (Slack migration)
- Generic provider card pattern established for future integrations (Jira, DocuSign, etc.)
- Settings page integrations tab now renders multi-provider grid

---
*Phase: 12-integration-foundation*
*Completed: 2026-03-23*

## Self-Check: PASSED
