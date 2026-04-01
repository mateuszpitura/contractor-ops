# Project Research Summary

**Project:** Contractor Ops v3.0 — Enterprise & Monetization
**Domain:** B2B contractor operations platform — integration expansion, equipment tracking, billing infrastructure
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

v3.0 adds five substantial capability areas to an already working platform: Linear bidirectional sync, Microsoft Teams approval flows, Google Workspace directory import, equipment/shipment tracking, and a Stripe subscription paywall with AI credit metering. The existing integration framework (BaseAdapter, OAuth credential store, webhook pipeline, QStash async processing) carries most of the load. Three features — Linear, Teams, and Google Workspace — extend that framework directly. Two features — equipment tracking and Stripe billing — are new bounded contexts with their own schema files, service layers, and dedicated webhook routes that deliberately bypass the integration adapter pipeline.

The recommended approach is to build in three phases of phases: (1) foundation — Stripe subscription infrastructure and the Linear integration, both well-understood patterns or direct clones of existing code; (2) the harder integrations — Teams bot with Adaptive Cards and Google Workspace directory import, which carry real infrastructure complexity; and (3) cross-cutting connection — the intelligent onboarding wizard, additional courier carriers, and full billing enforcement. Equipment tracking runs independently of other v3.0 features and can be parallelized with any phase.

The dominant risks are all known and preventable. Teams requires Azure Bot Service registration before a single line of adapter code is written; skipping this causes the entire integration to fail silently. Stripe webhooks must be processed with database-level idempotency or billing race conditions become silent revenue bugs. Linear's fast webhook delivery requires per-mutation correlation IDs rather than the 30-second window used by Jira. The Google Workspace directory import must use QStash pagination chaining or it will time out for any organization above roughly 200 users. All four of these risks have explicit prevention strategies documented in PITFALLS.md.

## Key Findings

### Recommended Stack

The existing stack is unchanged. v3.0 adds seven packages: `@linear/sdk` (official GraphQL client for Linear), `botbuilder` + `adaptivecards` + `adaptivecards-templating` (Microsoft Bot Framework and card rendering for Teams), `googleapis` (Google Admin SDK, extending existing Google OAuth), `stripe` (server-side billing and webhook handling), and `@stripe/stripe-js` / `@stripe/react-stripe-js` (client-side Checkout Sessions). Courier tracking for InPost, DPD, and UPS uses direct `fetch()` calls with Zod validation — no SDK, because all available npm packages for these carriers are unmaintained (last updated 2019–2022).

**Core technology additions:**
- `@linear/sdk ^80.1.0`: Official TypeScript GraphQL client — auto-generated from Linear schema, typed mutations, handles pagination and OAuth refresh
- `botbuilder ^4.23.3`: Microsoft Bot Framework v4 — mandatory for Teams Adaptive Card `Action.Execute` buttons and proactive messaging; `botbuilder-teams` is deprecated since v4.6
- `adaptivecards ^3.0.5` + `adaptivecards-templating ^2.3.1`: Teams approval card rendering with data binding
- `googleapis ^171.4.0`: Official Google API client for Admin SDK Directory API — reuses existing Google OAuth credentials with added directory scopes
- `stripe ^21.0.1`: Stripe Node.js SDK for subscriptions, Billing Meters API, webhook signature verification; API version 2026-03-25.dahlia
- `@stripe/stripe-js ^9.0.1` + `@stripe/react-stripe-js ^6.1.0`: Client-side Checkout Session redirects and billing portal
- Native `fetch()` for InPost ShipX, DPD, and UPS REST APIs

### Expected Features

**Must have (table stakes) — v3.0 P1:**
- Stripe subscription tiers (flat + per-seat) with webhook-driven lifecycle sync
- AI/OCR credit metering via Stripe Billing Meters API
- Feature gating middleware that checks subscription tier on every protected tRPC route
- Linear OAuth connect, issue creation from workflows, bidirectional status sync, status mapping config
- Teams bot registration, approval/rejection via Adaptive Cards with `Action.Execute`, proactive DM reminders
- Equipment registry (CRUD, assignment, status lifecycle) with manual shipment tracking
- Free trial period with 7/3/1-day warning notifications

**Should have (differentiators) — v3.0 P2:**
- Google Workspace directory import with group-to-role mapping and paginated QStash-orchestrated fetch
- InPost ShipX API integration with Parcel Locker selection (major differentiator for Polish market)
- Intelligent onboarding wizard pulling from multiple connected tools with preview and dedup
- Teams activity alert cards (invoice received, contract expiring, payment completed)
- Billing portal (Stripe Customer Portal redirect) and usage dashboard

**Defer (v4+):**
- SCIM provisioning from Google Workspace
- Multi-carrier rate comparison
- Stripe Connect for contractor payments (Polish B2B uses bank transfers, not Stripe payouts)
- Teams as full messaging relay
- Periodic automated Google Workspace directory sync (one-time import covers initial need)

### Architecture Approach

v3.0 spans three architectural patterns: adapter extension (Linear, Teams, Google Workspace extend `BaseAdapter` and register in `register-all.ts`), new bounded contexts (equipment tracking with its own Prisma schema file and `CourierClient` interface; Stripe billing with its own middleware, schema, and dedicated webhook route), and a cross-cutting orchestrator (intelligent onboarding consumes data from all connected integrations via an `ImportOrchestrator` service). The most significant structural change is refactoring `notification-service.ts` to dispatch through a new `MessagingProvider` interface rather than calling Slack functions directly — this unblocks Teams approval delivery without a proliferation of `if/else` branches.

**Major components:**
1. `LinearAdapter` (extends `BaseAdapter`) — OAuth 2.0, HMAC-SHA256 webhooks, GraphQL via `@linear/sdk`; mirrored from `JiraAdapter`
2. `TeamsAdapter` + `MessagingProvider` abstraction — Azure Bot Service, Bot Framework JWT validation, Adaptive Cards with `Action.Execute`, `ConversationReference` storage in DB for proactive messaging; `notification-service.ts` refactored to dispatch through the abstraction
3. `GoogleWorkspaceAdapter` + `google-directory-sync.ts` — Admin SDK directory scopes on existing Google OAuth, QStash-chained paginated import, `ImportSession` model for progress tracking
4. `ImportOrchestrator` + per-provider mappers — reads from connected integrations, normalizes to internal schema, deduplicates by email, shows preview before batch create
5. `CourierClient` interface + `InPostClient`, `DpdClient`, `UpsClient` — lightweight direct REST clients, NOT adapters; unified `ShipmentStatus` base enum with `providerDetails` JSON for carrier-specific data
6. Billing service layer (`subscription-service.ts`, `usage-metering.ts`, `feature-gates.ts`, `webhook-handler.ts`) — platform-level infrastructure, dedicated webhook route, tRPC billing middleware in the auth chain

**Schema additions:** `equipment.prisma` (Equipment, Shipment, ShipmentStatusUpdate), `billing.prisma` (Subscription, UsageRecord, BillingEvent), modifications to `organization.prisma`, `integration.prisma`, `notification.prisma`, and `contract.prisma`.

### Critical Pitfalls

1. **Linear sync loop with Jira timing constants** — Do not copy `LOOP_PREVENTION_WINDOW_MS` (30s) from the Jira handler; Linear webhooks fire sub-second. Use per-mutation Redis correlation IDs with 10-second TTL. Add `correlationId` column to `IntegrationSyncLog`.

2. **Teams requires Azure Bot Service before coding** — Unlike Slack (simple OAuth + webhooks), Teams requires an Azure AD app registration and Azure Bot resource. JWT token validation on the `/api/messages/teams` endpoint must be in place before the bot can receive any message. Skipping this means all button presses return "Something went wrong." Use separate Azure Bot registrations per environment.

3. **Stripe webhook race conditions on serverless** — Stripe sends 3–5 events per subscription lifecycle change within milliseconds. Create a `StripeEventLog` table with a unique constraint on `eventId`. Process billing-critical events synchronously within Stripe's 20-second timeout; do NOT route them through QStash.

4. **Google Workspace import timeout** — Paginated imports (up to 500 users/page) must use QStash chain-of-calls pattern, not a single serverless function. Store `nextPageToken` in an `ImportJob` record and show progress in the UI.

5. **Stripe metered billing usage loss** — Record usage intent in `AiUsageLog` before calling Claude Vision API; report to Stripe via retryable QStash job after. Always use `action: 'increment'`, never `action: 'set'`. Daily reconciliation cron comparing internal counts to Stripe usage summaries is a launch requirement.

6. **Equipment tracking disconnected from offboarding** — Equipment module and contractor lifecycle must be integrated from the start. Add an "Equipment Check" blocking step to the offboarding workflow template. Equipment assigned to a contractor should auto-trigger a return request on offboarding.

7. **Onboarding import vs sync scope creep** — Be explicit in the UI that the import wizard is a one-time snapshot. Do not build continuous sync in v3.0. Offer a "Re-import with diff preview" instead. Store `importSource`, `externalId`, `importedAt` on every imported record.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Stripe Billing Foundation

**Rationale:** Stripe billing gates all other v3.0 features via plan tiers. Build the subscription infrastructure early so the paywall can be activated when v3.0 ships, without a separate deployment. It is fully independent — no dependency on any other v3.0 feature. The critical pitfalls (webhook idempotency, metered billing usage loss) are well-documented and must be solved before adding feature gating.

**Delivers:** Subscription lifecycle (create, update, cancel, trial), AI credit metering infrastructure, Stripe Customer Portal redirect, webhook idempotency layer, billing middleware stub in tRPC chain (permissive until feature gating is activated).

**Features addressed:** Subscription tiers, free trial period, AI/OCR credit metering, billing portal, webhook-driven billing sync.

**Avoids:** Stripe webhook race conditions (Pitfall 3), AI credit metered billing usage loss (Pitfall 7). Use Test Clocks to verify full subscription lifecycle before moving on.

**Research flag:** Standard patterns — Stripe subscriptions and Billing Meters are well-documented. Skip `research-phase`. Verify Stripe Meters API is on API version 2025-03-31.basil or later.

---

### Phase 2: Linear Integration

**Rationale:** Linear is a direct clone of the existing Jira adapter. It is the lowest-risk integration in v3.0 and validates that the adapter framework extension works before tackling the harder Teams integration. It delivers immediate value to dev-heavy organizations using Linear instead of Jira.

**Delivers:** `LinearAdapter`, bidirectional issue sync, Linear webhook handler with Redis correlation IDs, status mapping config UI, linked issue display on workflow task views.

**Features addressed:** Linear OAuth connect, issue creation from workflows, bidirectional status sync, status mapping, linked issue display.

**Avoids:** Linear sync loop with Jira timing constants (Pitfall 1). Per-mutation Redis correlation IDs must be built in from the start, not retrofitted.

**Research flag:** Standard patterns — mirrors Jira adapter exactly. Skip `research-phase`. Pin `@linear/sdk` to `^80` as it follows Linear's API version changes.

---

### Phase 3: Equipment Tracking (Foundation + Manual)

**Rationale:** Equipment tracking is entirely independent of other v3.0 features. Building the data model and CRUD layer now (with manual shipment tracking number entry) delivers useful functionality without courier API complexity. It also establishes the offboarding integration hook — critical to avoid Pitfall 6 — before the workflow engine is taken for granted.

**Delivers:** Equipment domain schema (Equipment, Shipment, ShipmentStatusUpdate), CRUD routers, contractor profile equipment tab, manual shipment entry, equipment-aware offboarding workflow step.

**Features addressed:** Equipment registry, assign equipment to contractor, manual shipment tracking, equipment display on contractor profile.

**Avoids:** Equipment tracking disconnected from offboarding (Pitfall 6). The blocking "Equipment Check" offboarding step must be added in this phase, not deferred to after courier APIs are integrated.

**Research flag:** Standard patterns — CRUD domain model, no external APIs. Skip `research-phase`.

---

### Phase 4: Google Workspace Directory Import

**Rationale:** Google Workspace import extends existing Google OAuth infrastructure (minimal adapter work) and delivers a high-value onboarding capability. It also establishes the `ImportJob` / `ImportSession` pattern and QStash pagination chaining that the intelligent onboarding wizard will reuse.

**Delivers:** `GoogleWorkspaceAdapter`, `google-directory-sync.ts`, Admin SDK paginated import with QStash chaining, import progress UI, group-to-role mapping, `ImportSession` model.

**Features addressed:** Google Workspace OAuth connect, user list/preview, selective import as org members, group-based role mapping.

**Avoids:** Import timeout for large directories (Pitfall 4). Must be tested with mocked 500+ user paginated responses before shipping. Use `readonly` scopes only.

**Research flag:** Needs `research-phase` — QStash pagination chaining pattern for multi-step imports should be validated against the existing QStash version in the project before planning detailed tasks.

---

### Phase 5: Teams Integration

**Rationale:** Teams is the most complex integration in v3.0 (estimated 3–4 weeks, HIGH risk). Azure Bot Service registration must happen before any code is written. It requires a new messaging abstraction layer that also refactors existing Slack notification delivery. Doing this after Linear (proven adapter pattern) and Google Workspace (proven QStash patterns) reduces overall risk.

**Delivers:** Azure Bot Service registration, `TeamsAdapter`, `MessagingProvider` interface, `slack-provider.ts` wrapper, `teams-provider.ts` with Adaptive Cards, refactored `notification-service.ts`, `ConversationReference` storage, approve/reject via Teams, Teams activity alerts.

**Features addressed:** Teams bot connect, approve/reject from Teams, approval reminders, activity alerts, Teams channel configuration.

**Avoids:** Azure Bot Service not replicating Slack webhook pattern (Pitfall 2). Separate Azure registrations per environment. `Action.Execute` (not `Action.Submit`) for Universal Actions. 5-second response timeout with async QStash processing.

**Research flag:** Needs `research-phase` — Azure Bot Service setup, Bot Framework JWT validation on Vercel, and Adaptive Card Universal Actions are sufficiently non-standard to warrant explicit step-by-step planning before coding.

---

### Phase 6: InPost Courier Integration

**Rationale:** InPost is the primary shipping method for Polish B2B companies and a key differentiator. The `CourierClient` interface was established in Phase 3; Phase 6 implements the first real carrier. InPost has a sandbox environment and reasonable documentation, making it lower risk than DPD.

**Delivers:** `InPostClient`, InPost ShipX OAuth 2.0, shipment creation, Parcel Locker selection UI (InPost Geowidget), automatic status tracking via webhooks and polling, QStash polling cron filtered to active shipments only.

**Features addressed:** InPost ShipX API integration, Parcel Locker selection, tracking status display, workflow integration for equipment shipment.

**Avoids:** Courier abstraction losing InPost-specific data (Pitfall 5). Pickup codes and locker locations must be preserved in `providerDetails` JSON. Sandbox vs production URL misconfiguration must be caught by environment variables, not hardcoded strings.

**Research flag:** Needs `research-phase` — InPost ShipX OAuth 2.0 flow and parcel locker API details need explicit mapping before implementation. Polish-language documentation is the primary source.

---

### Phase 7: Intelligent Onboarding Wizard

**Rationale:** The onboarding wizard is a cross-cutting orchestrator that depends on Linear (Phase 2), Google Workspace (Phase 4), and Teams (Phase 5) all existing. Building it last in the feature set lets it genuinely pull from all connected tools. The `ImportOrchestrator` and dedup logic built here is the most complex UI flow in v3.0.

**Delivers:** `ImportOrchestrator`, per-provider data mappers (Linear, Jira, Google Workspace, Slack, Teams), multi-source dedup by email, import preview UI with diff indicators, batch confirm/skip/edit, `ImportMapping` model.

**Features addressed:** Import wizard with source selection, import team members from connected tools, import projects/statuses from PM tools, data preview and conflict resolution, progress tracking with partial retry.

**Avoids:** Import vs sync scope creep (Pitfall 6 variant). UI copy must use "import" not "sync". No continuous sync webhooks. Re-import shows diff preview only.

**Research flag:** Standard patterns — all source integrations exist by this phase. Skip `research-phase`. The orchestrator logic (dedup, preview, batch create) is application code.

---

### Phase 8: Feature Gating + DPD/UPS Couriers + Billing Polish

**Rationale:** Final activation of the paywall, additional courier carriers, and billing UX polish. Feature gating middleware was stubbed in Phase 1 (permissive); this phase enforces plan tiers. DPD and UPS follow the `CourierClient` interface established in Phase 3 and proven in Phase 6.

**Delivers:** Active feature gating per subscription tier, upgrade prompts with specific plan information, `DpdClient`, `UpsClient`, equipment return flow via contractor portal, usage dashboard with per-feature breakdown, free trial expiry warnings (7/3/1 days), Stripe Customer Portal activation.

**Features addressed:** Feature gating by plan, upgrade/downgrade flow, DPD integration, UPS integration, equipment return tracking, free trial flow, billing portal and usage dashboard.

**Avoids:** Generic "Upgrade required" messages (show specific feature name and which plan unlocks it). Free trial ending with no warning. Equipment return disconnected from contractor portal.

**Research flag:** Standard patterns for DPD/UPS — follow `CourierClient` interface from Phase 3. Feature gating is config-driven middleware. Skip `research-phase`.

---

### Phase Ordering Rationale

- Stripe is built first because it gates everything and has the most catastrophic failure mode (revenue bugs). Building it early, with enforcement deferred, means it is tested before it matters financially.
- Linear is second because it is the fastest win (clone of Jira) and proves the adapter extension pattern before Teams complexity.
- Equipment is third because it is fully independent and establishing the offboarding integration hook early prevents it being forgotten after courier APIs are added.
- Google Workspace is fourth because it establishes the QStash pagination pattern that the onboarding wizard depends on.
- Teams is fifth because it is the highest complexity and requires all prerequisite patterns (messaging abstraction, QStash chaining) to be proven first.
- InPost is sixth because courier clients are independent domain services; InPost is the Polish-market priority.
- The onboarding wizard is seventh because it requires all source integrations to exist before it can pull from them meaningfully.
- Feature gating and remaining couriers are last because activating the paywall is the final step before v3.0 launch.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Google Workspace):** QStash pagination chaining pattern for multi-step imports — verify against current QStash version in the project
- **Phase 5 (Teams):** Azure Bot Service setup, Bot Framework JWT validation on Vercel, Adaptive Card Universal Actions pattern — non-standard enough to warrant explicit step-by-step planning before coding
- **Phase 6 (InPost):** InPost ShipX OAuth 2.0 flow, Parcel Locker selection API, webhook vs polling strategy — Polish-language docs are the primary source

Phases with standard patterns (skip `research-phase`):
- **Phase 1 (Stripe):** Well-documented; Stripe's own AI startup billing guide covers the exact use case
- **Phase 2 (Linear):** Direct clone of Jira adapter; Linear SDK and webhook docs are comprehensive
- **Phase 3 (Equipment):** Standard CRUD domain model; no external API dependency in foundation phase
- **Phase 7 (Onboarding wizard):** All source integrations exist by this phase; orchestrator is application code
- **Phase 8 (Feature gating + DPD/UPS):** Follows established `CourierClient` interface; feature gating is config-driven middleware

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified via `npm view`. Official SDKs with no viable community alternatives. Courier REST API approach validated against npm ecosystem state (all available courier SDKs are unmaintained). |
| Features | MEDIUM-HIGH | Verified against official APIs and Stripe docs. Linear refresh token mandate (April 2026) confirmed in Linear changelog. Teams complexity estimate based on Microsoft samples, not first-hand implementation experience. |
| Architecture | HIGH | Built on deep knowledge of existing codebase. New component boundaries follow established patterns (12 existing adapters). Teams messaging abstraction is the one design decision with moderate uncertainty — the MessagingProvider interface is sound but refactoring `notification-service.ts` may surface hidden coupling. |
| Pitfalls | HIGH | Directly grounded in existing codebase patterns (`LOOP_PREVENTION_WINDOW_MS`, `jira-webhook-handler.ts`). Stripe and Teams pitfalls sourced from official docs and verified community experience. |

**Overall confidence:** HIGH

### Gaps to Address

- **Teams ConversationReference storage format:** The `ExternalLink.metadataJson` approach is proposed but not verified against the Bot Framework SDK's exact reference shape. Validate the storage schema during Phase 5 planning.
- **DPD webhook reliability:** DPD's webhook support is documented as "limited and inconsistent." Polling is the fallback, but the exact DPD webhook contract needs hands-on verification. Flag for Phase 8 planning.
- **UPS developer account approval time:** UPS requires developer account approval before API access. This may add calendar time to Phase 8. Start the UPS developer account registration during Phase 6 (InPost) so approval arrives before Phase 8 begins.
- **Azure Bot Service free tier limits:** The F0 (free) tier covers standard Teams channels, but message-per-second limits for proactive messaging (approval reminders) should be validated against expected volume during Phase 5 planning.
- **Stripe Billing Meters API stability:** The Meters API replaced legacy `usage_records` in the 2025-03-31.basil API version. Validate that `stripe.billing.meterEvents.create()` behaves as documented with Stripe Test Clocks before integrating with the OCR pipeline.

## Sources

### Primary (HIGH confidence)
- [Linear SDK npm](https://www.npmjs.com/package/@linear/sdk) — version 80.1.0 verified
- [Linear Developers — Webhooks](https://linear.app/developers/webhooks) — HMAC-SHA256 verification, payload structure, timestamp replay protection
- [Linear API Rate Limits](https://linear.app/docs/api-and-webhooks) — 500 req/hr per OAuth app user
- [Linear Changelog](https://linear.app/changelog/page/2) — refresh token mandate April 2026
- [Microsoft Teams — Universal Actions for Adaptive Cards](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/universal-actions-for-adaptive-cards/overview) — Action.Execute pattern
- [Microsoft Teams — Bot Request Approval Sample](https://learn.microsoft.com/en-us/samples/officedev/microsoft-teams-samples/officedev-microsoft-teams-samples-bot-request-approval-nodejs/) — Node.js reference implementation
- [Microsoft Teams — Proactive Messages](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages) — ConversationReference pattern
- [Google Admin SDK Directory API](https://developers.google.com/workspace/admin/directory/v1/guides) — user/group management, rate limits, pagination
- [stripe npm](https://www.npmjs.com/package/stripe) — version 21.0.1 verified
- [Stripe Usage-Based Billing](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api) — Meters API
- [Stripe Billing Credits](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits) — credit grants for plan allowances
- [Stripe Build Usage-Based Billing for AI](https://docs.stripe.com/get-started/use-cases/usage-based-billing) — AI startup reference architecture
- [InPost ShipX API Documentation](https://dokumentacja-inpost.atlassian.net/wiki/spaces/PL/pages/622754/API+ShipX) — REST API with OAuth 2.0, sandbox/production URLs
- Existing codebase: `packages/integrations/src/adapters/base-adapter.ts`, `jira-webhook-handler.ts`, `jira-issue-sync.ts`

### Secondary (MEDIUM confidence)
- [Stripe Webhook Best Practices (Stigg)](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) — idempotency, event ordering, 20-second timeout
- [Stripe Metered Billing Guide 2026 (buildmvpfast)](https://www.buildmvpfast.com/blog/stripe-metered-billing-implementation-guide-saas-2026) — implementation patterns for Meter API
- [Microsoft Teams Bot Framework](https://learn.microsoft.com/en-us/azure/bot-service/channel-connect-teams?view=azure-bot-service-4.0) — Azure Bot registration, messaging endpoint
- [DPD API Documentation v1.2.1](https://www.dpd.com/wp-content/uploads/sites/235/2023/04/DPD-API-documentation-v1-2-1.pdf) — REST API specification
- [UPS Developer Portal](https://developer.ups.com) — OAuth 2.0 migration confirmed
- [Vercel Function Limits](https://vercel.com/docs/functions/limitations) — timeout constraints

### Tertiary (LOW confidence — validate during implementation)
- DPD webhook support reliability — documented as limited; verify before committing to webhook-first strategy
- Azure Bot Service F0 tier proactive messaging rate limits — confirm against expected approval volume

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
