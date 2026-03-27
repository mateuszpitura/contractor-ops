---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Platform Expansion
status: Ready to plan
stopped_at: Phase 17 UI-SPEC approved
last_updated: "2026-03-27T16:45:48.604Z"
progress:
  total_phases: 9
  completed_phases: 5
  total_plans: 22
  completed_plans: 22
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail.
**Current focus:** Phase 16 — ocr-invoice-parsing

## Current Position

Phase: 17
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
| Phase 14 P01 | 4min | 2 tasks | 7 files |
| Phase 14 P02 | 5min | 2 tasks | 7 files |
| Phase 14 P03 | 6min | 2 tasks | 8 files |
| Phase 14 P05 | 2min | 2 tasks | 4 files |
| Phase 14 P04 | 4min | 2 tasks | 7 files |
| Phase 15 P02 | 5min | 2 tasks | 9 files |
| Phase 15 P01 | 4min | 2 tasks | 10 files |
| Phase 15 P03 | 7min | 2 tasks | 9 files |
| Phase 15 P04 | 10min | 2 tasks | 15 files |
| Phase 16 P02 | 3min | 2 tasks | 8 files |
| Phase 16 P01 | 19min | 2 tasks | 15 files |
| Phase 16 P03 | 15min | 3 tasks | 4 files |

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
- [Phase 14]: Followed existing bank account pattern (whitespace-stripped + masked) for change request fields
- [Phase 14]: NotificationPreferencesSection created in Task 1 due to import dependency from portal-settings-page.tsx
- [Phase 14]: Inject only --brand-accent CSS custom property (not --primary) to avoid global shadcn component override
- [Phase 14]: Used services/__tests__/ and routers/__tests__/ paths for test stubs matching existing codebase convention
- [Phase 14]: Session.organizationId remains authoritative for tenantStore scoping; subdomain is supplementary context metadata only
- [Phase 15]: Dynamic import for docusign-esign SDK (pure JS) with minimal .d.ts declarations
- [Phase 15]: ESignAdapter types file created by parallel agent; DRAFT->PENDING_SIGNATURE transition added per D-08; SIGNATURE_DECLINED/EXPIRED allow re-send
- [Phase 15]: Webhook completion signal via _lastWebhookResult on adapters; _process route checks flag and calls handleSigningCompletion
- [Phase 15]: CSP frame-src for DocuSign iframe via Next.js headers() config function
- [Phase 15]: Added listConnections query to esign router for provider picker UI
- [Phase 15]: Added docusign-esign.d.ts to API package for composite TypeScript builds
- [Phase 16]: Inlined NIP validation logic locally since Plan 01 types not yet available in parallel execution
- [Phase 16]: Claude native PDF document type with tool_use for structured OCR extraction (no image conversion)
- [Phase 16]: NIP modulo-11 checksum caps confidence to 40, amount cross-validation caps to 60
- [Phase 16]: OcrReviewPanel uses local useState (not react-hook-form) since parent form handles submission
- [Phase 16]: Portal form gets inline confidence badges without full split panel per UI-SPEC admin vs portal distinction

### Pending Todos

None yet.

### Blockers/Concerns

- Prisma 7 prisma.config.ts fails to parse on Node 24.11.0 — using --schema flag workaround
- KSeF April 1 2026 mandatory deadline — Phase 17 must not slip
- Autenti QES vs standard signature routing needs legal/business input before Phase 15
- KSeF @ksef/client single-maintainer risk — validate library health at Phase 17 planning

## Session Continuity

Last session: 2026-03-27T16:45:48.602Z
Stopped at: Phase 17 UI-SPEC approved
Resume file: .planning/phases/17-ksef-integration/17-UI-SPEC.md
