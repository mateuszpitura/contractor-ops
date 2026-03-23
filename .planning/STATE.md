---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Platform Expansion
status: Ready to plan
stopped_at: Phase 14 UI-SPEC approved
last_updated: "2026-03-23T19:40:43.889Z"
progress:
  total_phases: 9
  completed_phases: 2
  total_plans: 10
  completed_plans: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail.
**Current focus:** Phase 13 — contractor-portal-auth-core-views

## Current Position

Phase: 14
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 51 (v1.0) | 0 (v2.0)
- v1.0 delivered 51 plans across 11 phases in 6 days

**By Phase (v2.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 12. Integration Foundation | TBD | - | - |

*Updated after each plan completion*
| Phase 12 P01 | 4min | 2 tasks | 14 files |
| Phase 12 P03 | 4min | 2 tasks | 8 files |
| Phase 12 P02 | 6min | 2 tasks | 12 files |
| Phase 12 P04 | 11min | 2 tasks | 17 files |
| Phase 12 P05 | 8min | 2 tasks | 6 files |
| Phase 13 P01 | 3min | 2 tasks | 7 files |
| Phase 13 P02 | 6min | 2 tasks | 3 files |
| Phase 13 P03 | 6min | 2 tasks | 9 files |
| Phase 13 P04 | 4min | 2 tasks | 7 files |
| Phase 13 P05 | 6min | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0]: All v2 development on dedicated `v2` git branch
- [v2.0]: Portal is route group in apps/web, not separate app — shares auth, DB, tRPC, UI
- [v2.0]: Contractors use PortalSession model, never added to internal user table
- [v2.0]: Shared credential store + webhook layer before any specific integration
- [v2.0]: OCR before KSeF to establish async invoice pipeline pattern
- [Phase 12]: Per-provider encryption keys via ${SLUG_UPPER}_ENCRYPTION_KEY env var pattern
- [Phase 12]: Use adapter clientSecretEnvVar for OAuth state signing (not separate secret)
- [Phase 12]: Proactive+lazy dual token refresh: 30min lookahead cron + lazy fallback before API calls
- [Phase 12]: Resend dependency ^6.9.4 (not ^4.8.0) for webhooks.verify API compatibility
- [Phase 12]: Generic provider card replaces inline SlackConnectionCard; static provider config; 30s polling via refetchInterval
- [Phase 12]: Old Slack/Resend routes kept functional with @deprecated JSDoc for backward compat during URL migration
- [Phase 13]: Raw prisma client for portal services — PortalSession/PortalMagicToken in globalModels, cross-org contractor lookup needs unscoped access
- [Phase 13]: Raw prisma client used in portal router with explicit organizationId in creates (matches existing router pattern)
- [Phase 13]: Organization fetched separately in getSession since validatePortalSession only includes contractor relation
- [Phase 13]: httpOnly cookie via API route for portal session (not client-side document.cookie)
- [Phase 13]: Portal layout validates session server-side and conditionally renders top bar vs login layout
- [Phase 13]: Built API package to regenerate portal router types for web app consumption
- [Phase 13]: Extended Badge component with info/warning/success semantic variants for portal status badges
- [Phase 13]: Custom portal PDF upload via portal.getUploadUrl (not reusing admin DropZone due to coupling)

### Pending Todos

None yet.

### Blockers/Concerns

- Prisma 7 prisma.config.ts fails to parse on Node 24.11.0 — using --schema flag workaround
- KSeF April 1 2026 mandatory deadline — Phase 17 must not slip
- Autenti QES vs standard signature routing needs legal/business input before Phase 15
- KSeF @ksef/client single-maintainer risk — validate library health at Phase 17 planning

## Session Continuity

Last session: 2026-03-23T19:40:43.886Z
Stopped at: Phase 14 UI-SPEC approved
Resume file: .planning/phases/14-portal-self-service-branding/14-UI-SPEC.md
