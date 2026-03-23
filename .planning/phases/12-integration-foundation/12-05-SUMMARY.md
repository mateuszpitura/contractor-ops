---
phase: 12-integration-foundation
plan: 05
subsystem: ui, integrations, config
tags: [settings-page, env-vars, deprecation, backward-compat, integrations-tab]

# Dependency graph
requires:
  - phase: 12-04
    provides: "IntegrationsTab component, provider cards, detail sheet, health monitoring"
  - phase: 12-01
    provides: "Integration types, credential service, registry"
  - phase: 12-02
    provides: "Webhook pipeline with Slack + Resend adapters"
  - phase: 12-03
    provides: "OAuth callback routes, token refresh cron"
provides:
  - "Fully wired integration settings page with generic IntegrationsTab"
  - "Documented environment variables for integration framework"
  - "Deprecated old Slack/Resend routes with migration comments"
  - "Workspace dependency links for @contractor-ops/integrations"
affects: [13, 14, 15, 16, 17, 19, 20]

# Tech tracking
tech-stack:
  added: []
  patterns: [deprecation-with-migration-comments, per-provider-env-key-pattern]

key-files:
  created: []
  modified:
    - .env.example
    - apps/web/package.json
    - apps/web/src/app/api/slack/oauth/route.ts
    - apps/web/src/app/api/slack/interactivity/route.ts
    - apps/web/src/app/api/webhooks/resend-inbound/route.ts
    - pnpm-lock.yaml

key-decisions:
  - "Old Slack/Resend routes kept functional with @deprecated JSDoc — removed after Slack app URL migration"
  - "Per-provider encryption key pattern: ${SLUG_UPPER}_ENCRYPTION_KEY with commented-out placeholders for future providers"

patterns-established:
  - "Deprecation comment pattern: @deprecated with migration target route and removal condition"
  - "Env var documentation: grouped by feature phase with generation instructions"

requirements-completed: [INTG-01, INTG-02, INTG-03]

# Metrics
duration: 8min
completed: 2026-03-23
---

# Phase 12 Plan 05: Settings Page Wiring Summary

**Wired IntegrationsTab into settings, documented all env vars, and marked legacy Slack/Resend routes deprecated with backward-compat migration path**

## Performance

- **Duration:** 8 min (across two agent sessions with human verification checkpoint)
- **Started:** 2026-03-23T13:30:00Z
- **Completed:** 2026-03-23T13:45:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Settings page integrations tab now renders the generic IntegrationsTab component (replacing inline SlackConnectionCard)
- All new environment variables documented in .env.example under "Integration Framework (Phase 12)" section
- Old Slack OAuth, Slack interactivity, and Resend inbound routes marked @deprecated with clear migration targets
- Workspace dependency @contractor-ops/integrations linked in apps/web
- Human-verified end-to-end: provider cards render, detail sheet opens, tests pass, TypeScript compiles

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire IntegrationsTab into settings page + env vars + deprecation markers** - `bad5f60` (feat)
2. **Task 2: End-to-end integration foundation verification** - human-verify checkpoint (approved, no code commit)

## Files Created/Modified
- `.env.example` - Added Integration Framework env vars (encryption keys, QStash, CRON_SECRET)
- `apps/web/package.json` - Added @contractor-ops/integrations workspace dependency
- `apps/web/src/app/api/slack/oauth/route.ts` - @deprecated JSDoc pointing to /api/oauth/[provider]/callback
- `apps/web/src/app/api/slack/interactivity/route.ts` - @deprecated JSDoc pointing to /api/webhooks/slack
- `apps/web/src/app/api/webhooks/resend-inbound/route.ts` - @deprecated JSDoc pointing to /api/webhooks/resend
- `pnpm-lock.yaml` - Updated workspace dependency links

## Decisions Made
- Old routes remain functional during transition (backward compat) with @deprecated markers and removal conditions documented in JSDoc
- Per-provider encryption keys use commented-out placeholders in .env.example for future providers (Jira, DocuSign, Autenti, KSeF)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Environment variables added to `.env.example` must be set for production:
- `SLACK_ENCRYPTION_KEY` - 32-byte hex key for Slack credential encryption
- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` - Upstash QStash webhook processing
- `CRON_SECRET` - Vercel Cron endpoint protection

## Next Phase Readiness
- Phase 12 (Integration Foundation) is fully complete
- All 5 plans delivered: package scaffolding, webhook pipeline, OAuth + token refresh, health monitoring + UI, and settings wiring
- Future integration phases (13-20) can now use the shared credential store, webhook ingestion, health monitoring, and generic provider UI
- Old Slack routes remain functional until Slack app URL configuration is updated

## Self-Check: PASSED

- SUMMARY.md: FOUND
- Commit bad5f60: FOUND

---
*Phase: 12-integration-foundation*
*Completed: 2026-03-23*
