---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Enterprise & Monetization
status: verifying
stopped_at: Completed all phase 36 plans
last_updated: "2026-04-05T14:41:58.174Z"
last_activity: 2026-04-05
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 33
  completed_plans: 33
  percent: 91
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail.
**Current focus:** Phase 36 — wiring-fixes-webhook-ui-featuregate

## Current Position

Phase: 36
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-04-05

Progress: [█████████░] 91%

## Performance Metrics

**Velocity:**

- Total plans completed: 51 (v1.0) + 52 (v2.0) = 103
- v1.0: 51 plans across 11 phases in 6 days
- v2.0: 52 plans across 16 phases in 9 days
- v3.0: 19 estimated plans across 8 phases

**By Phase (v3.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 28 P01 | 13min | 2 tasks | 16 files |
| Phase 28 P02 | 3min | 2 tasks | 4 files |
| Phase 28 P03 | 6min | 2 tasks | 16 files |
| Phase 28 P04 | 2min | 2 tasks | 2 files |
| Phase 29 P01 | 7min | 3 tasks | 13 files |
| Phase 29 P02 | 6min | 3 tasks | 7 files |
| Phase 29 P03 | 11min | 2 tasks | 14 files |
| Phase 30 P01 | 6min | 2 tasks | 10 files |
| Phase 30 P02 | 12min | 2 tasks | 24 files |
| Phase 30 P03 | 3min | 2 tasks | 3 files |
| Phase 31 P00 | 3min | 2 tasks | 6 files |
| Phase 31 P01 | 6min | 2 tasks | 10 files |
| Phase 31 P03 | 5min | 2 tasks | 3 files |
| Phase 31 P02 | 6min | 2 tasks | 12 files |
| Phase 32 P01 | 7min | 2 tasks | 9 files |
| Phase 32 P03 | 13min | 2 tasks | 16 files |
| Phase 32 P04 | 9min | 2 tasks | 7 files |
| Phase 33 P01 | 8min | 2 tasks | 14 files |
| Phase 33 P02 | 14min | 2 tasks | 10 files |
| Phase 33 P03 | 5min | 3 tasks | 14 files |
| Phase 34 P01 | 8min | 2 tasks | 6 files |
| Phase 34 P02 | 11min | 2 tasks | 14 files |
| Phase 35 P01 | 4min | 2 tasks | 4 files |
| Phase 35 P02 | 6min | 2 tasks | 14 files |
| Phase 35 P04 | 5min | 2 tasks | 10 files |
| Phase 35 P05 | 7min | 2 tasks | 8 files |
| Phase 36 P01 | 3min | 2 tasks | 2 files |
| Phase 36 P02 | 3min | 2 tasks | 6 files |
| Phase 36 P03 | 3min | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0]: Provider adapter pattern — every integration shares credential store, webhook pipeline, health monitoring
- [v2.0]: QStash for async processing — webhook processing, OCR, KSeF sync all fire-and-forget
- [v2.0]: AES-256-GCM per-provider encryption — each integration has its own key
- [v3.0]: Stripe billing is separate bounded context — dedicated webhook route, not through integration adapter pipeline
- [v3.0]: Equipment tracking is separate bounded context — CourierClient interface, not BaseAdapter
- [v3.0]: Teams requires MessagingProvider abstraction — refactor notification-service.ts away from direct Slack calls
- [Phase 28]: Stripe SDK v21 uses apiVersion 2026-03-25.dahlia; adapted type interfaces for removed period fields
- [Phase 28]: billing-constants.ts is single source of truth for all billing constants (TIER_CREDIT_ALLOWANCE, TRIAL_CREDIT_ALLOWANCE, PRICE_TO_TIER_MAP)
- [Phase 28]: Serializable isolation level for credit deduction prevents race conditions
- [Phase 28]: Meter event fires outside transaction (fire-and-forget) to avoid blocking on Stripe API latency
- [Phase 28]: BillingOverlay client wrapper pattern for server-component dashboard layout integration
- [Phase 28]: tenantProcedure for getCreditBalance -- any org member can view credit usage, consistent with other billing queries
- [Phase 29]: PENDING_MAPPING status enables D-03: Linear connections require status mapping before sync activates
- [Phase 29]: Linear OAuth uses URL-encoded token exchange (application/x-www-form-urlencoded) unlike Jira JSON
- [Phase 29]: linearGraphQL helper exported from linear-issue-sync.ts for reuse across services and tRPC router
- [Phase 29]: Webhook registration fires as fire-and-forget on first saveStatusMapping per team
- [Phase 29]: Used SiLinear from react-icons/si for brand icon, consistent with existing provider icon pattern
- [Phase 29]: Added connectionStatus and linkedIssues tRPC endpoints to Linear router for UI component queries
- [Phase 30]: Audit log entries created directly via prisma.auditLog.create in equipment router mutations
- [Phase 30]: Equipment status transition map as flat constant, validated before applying changes
- [Phase 30]: base-ui Select onValueChange receives nullable value -- guard with val && before setValue calls
- [Phase 30]: Equipment table uses local state for filters instead of nuqs URL state (simpler for first version)
- [Phase 30]: Equipment tasks with no assigned equipment auto-complete immediately (no-op optimization)
- [Phase 30]: equipmentEligibleTaskRunIds built inside transaction matching Jira/Linear/Calendar pattern
- [Phase 31]: Adapter slug uses underscore (google_workspace) so toUpperCase maps to GOOGLE_WORKSPACE Prisma enum
- [Phase 31]: Directory import role enum uses actual system roles not simplified admin/manager/viewer
- [Phase 31]: Added vitest.config.ts and test script to validators package to enable test execution
- [Phase 31]: Case-insensitive email comparison for directory diff (lowercase normalization)
- [Phase 31]: Zod safeParse for QStash callback body validation per CLAUDE.md (no unsafe casts)
- [Phase 31]: base-ui TooltipTrigger uses render prop pattern, Checkbox uses indeterminate prop
- [Phase 32]: MessagingProvider interface with 4 methods enables platform-agnostic dispatch
- [Phase 32]: channelTeams defaults to false (opt-in) unlike channelSlack which defaults to true
- [Phase 32]: Stub card builders for Plan 02 parallel execution compatibility
- [Phase 32]: ConversationReference stored in configJson keyed by aadObjectId; CloudAdapter singleton shared between endpoint and provider
- [Phase 32]: Override onTeamsMembersAdded/onInstallationUpdateAdd instead of onConversationUpdateActivity to avoid TeamsActivityHandler internal channelData access
- [Phase 32]: Used BsMicrosoftTeams from react-icons/bs (SiMicrosoftteams removed from Simple Icons in v5.6.0)
- [Phase 32]: tRPC proxy workaround for stale API dist types; teams router accessible via typed any cast
- [Phase 33]: CourierClient interface as separate bounded context with duplicated equipment status maps to avoid circular imports
- [Phase 33]: Webhook HMAC-SHA256 with graceful no-secret degradation; ReturnRequest with @unique shipmentId for 1:1 relation
- [Phase 33]: Webhook endpoint matches org by signature first, falls back to shipment externalId/trackingNumber lookup
- [Phase 33]: Offboarding auto-shipment uses system as createdByUserId; try/catch prevents API failures from blocking task start
- [Phase 33]: Geowidget iframe with postMessage origin validation for secure Paczkomat selection
- [Phase 34]: Used org settingsJson for import job progress persistence (no separate model)
- [Phase 34]: Synchronous import within mutation for MVP; QStash async upgradeable later
- [Phase 34]: Reused brand icons from integrations package for provider cards (consistent with codebase patterns)
- [Phase 34]: base-ui Select onValueChange typed as unknown -- cast to string for role handlers
- [Phase 35]: TIER_RANK Record<SubscriptionTier, number> for numeric tier comparison in requireTier middleware
- [Phase 35]: Structured JSON error message with type/requiredTier/currentTier for client-side upgrade prompts
- [Phase 35]: DPD uses SOAP-like REST with auth credentials in request body (not headers)
- [Phase 35]: UPS OAuth 2.0 token caching with 5-minute pre-expiry refresh buffer
- [Phase 35]: AddressShipmentParams base interface for address-based carriers (DPD, UPS) vs point-based (InPost)
- [Phase 35]: Carrier factory getCourierClient dispatches to correct client by case-insensitive carrier string
- [Phase 35]: FeatureGate renders children during loading to avoid flashing upgrade banner
- [Phase 35]: CreditProgressBar uses inline style override on base-ui ProgressIndicator for dynamic bar color
- [Phase 35]: base-ui Button uses render prop for Link composition (not asChild)
- [Phase 35]: CarrierShipmentForm uses tRPC proxy pattern for stale dist types, consistent with InPostShipmentForm
- [Phase 35]: UPS service code stored as string literal (11/65/07) matching actual UPS API codes for direct passthrough
- [Phase 36]: Fixed transitionJiraIssue call to use 5-arg signature with connection lookup in cancelRun (plan had incorrect 3-arg call)
- [Phase 36]: Used simple Card with Badge for DPD/UPS provider sections instead of ProviderConnectionCard (courier configs are not OAuth integrations)
- [Phase 36]: Gate mutations only -- read queries ungated for STARTER upgrade prompts

### Pending Todos

None yet.

### Blockers/Concerns

- Prisma 7 prisma.config.ts fails to parse on Node 24.11.0 — using --schema flag workaround
- Teams requires Azure Bot Service registration before any code can be written (Phase 32 blocker)
- UPS developer account approval may take calendar time — start registration during Phase 33

## Session Continuity

Last session: 2026-04-05T13:20:00.000Z
Stopped at: Completed all phase 36 plans
Resume file: None
