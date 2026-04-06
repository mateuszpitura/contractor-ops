# Roadmap: Contractor Ops

## Milestones

- ✅ **v1.0 MVP** — Phases 1-11 (shipped 2026-03-23)
- ✅ **v2.0 Platform Expansion** — Phases 12-27 (shipped 2026-04-01)
- 🚧 **v3.0 Enterprise & Monetization** — Phases 28-39 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-11) — SHIPPED 2026-03-23</summary>

- [x] Phase 1: Foundation & Auth (4/4 plans)
- [x] Phase 2: Contractor Registry (3/3 plans)
- [x] Phase 3: Contracts & Documents (6/6 plans)
- [x] Phase 4: Workflow Engine (5/5 plans)
- [x] Phase 5: Invoice Intake & Matching (5/5 plans)
- [x] Phase 6: Approval Workflow (6/6 plans)
- [x] Phase 7: Notifications & Slack (5/5 plans)
- [x] Phase 8: Payments (4/4 plans)
- [x] Phase 9: Dashboard & Reports (6/6 plans)
- [x] Phase 10: Onboarding & Polish (5/5 plans)
- [x] Phase 11: Route Fixes & Tenant Isolation (2/2 plans)

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Platform Expansion (Phases 12-27) — SHIPPED 2026-04-01</summary>

- [x] Phase 12: Integration Foundation (5/5 plans) — completed 2026-03-23
- [x] Phase 13: Contractor Portal Auth & Core Views (5/5 plans) — completed 2026-03-23
- [x] Phase 14: Portal Self-Service & Branding (5/5 plans) — completed 2026-03-23
- [x] Phase 15: E-Sign Integration (4/4 plans) — completed 2026-03-27
- [x] Phase 16: OCR Invoice Parsing (3/3 plans) — completed 2026-03-27
- [x] Phase 17: KSeF Integration (3/3 plans) — completed 2026-03-27
- [x] Phase 18: Time Tracking (6/6 plans) — completed 2026-03-28
- [x] Phase 19: Jira Integration (6/6 plans) — completed 2026-03-29
- [x] Phase 20: Documentation & Calendar (6/6 plans) — completed 2026-03-29
- [x] Phase 21: API Build Fixes & Permission Registration (2/2 plans) — completed 2026-03-30
- [x] Phase 22: Component Mounting & Lifecycle Wiring (2/2 plans) — completed 2026-03-30
- [x] Phase 23: OCR Adapter Registry Fix (1/1 plans) — completed 2026-03-30
- [x] Phase 24: Jira Auto-Issue Creation Wiring (1/1 plans) — completed 2026-03-30
- [x] Phase 25: Portal E-Sign Auth Fix (1/1 plans) — completed 2026-03-30
- [x] Phase 26: Calendar Wiring Fixes (1/1 plans) — completed 2026-03-30
- [x] Phase 27: OAuth Callback & OCR Build Fixes (1/1 plans) — completed 2026-04-01

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

### v3.0 Enterprise & Monetization (In Progress)

**Milestone Goal:** Deep integrations with major project/communication platforms, intelligent organization onboarding via connected tools, physical equipment/shipment tracking tied to contractor lifecycle, and Stripe-based monetization with subscription tiers + AI credit metering.

- [x] **Phase 28: Stripe Billing Foundation** - Subscription lifecycle, AI credit metering, and webhook-driven billing infrastructure (completed 2026-04-01)
- [x] **Phase 29: Linear Integration** - Bidirectional issue sync between workflow tasks and Linear (completed 2026-04-01)
- [x] **Phase 30: Equipment Tracking Foundation** - Equipment registry, contractor assignment, manual shipment tracking, and workflow integration (completed 2026-04-02)
- [x] **Phase 31: Google Workspace Directory Import** - Paginated directory import with group-to-role mapping (completed 2026-04-02)
- [x] **Phase 32: Teams Integration** - Approve/reject from Teams Adaptive Cards, reminders, and activity alerts (completed 2026-04-04)
- [x] **Phase 33: InPost Courier Integration** - First courier API with Parcel Locker selection and auto-status tracking (completed 2026-04-04)
- [x] **Phase 34: Intelligent Onboarding Wizard** - Cross-tool import orchestrator with preview, dedup, and batch confirm (completed 2026-04-04)
- [x] **Phase 35: Feature Gating + DPD/UPS + Billing Polish** - Paywall activation, remaining couriers, usage dashboard (completed 2026-04-05)
- [x] **Phase 36: Wiring Fixes — Webhook Dispatch + UI Mounting + Feature Gate** - Close audit gaps: Linear webhook dispatch, carrier UI mounting, feature gate wiring (completed 2026-04-05)
- [x] **Phase 37: Shipment Task Auto-Completion Wiring** - Webhook and polling paths trigger workflow task auto-completion (completed 2026-04-05)
- [x] **Phase 38: Tier Gate Expansion + CourierClient Type Fix** - All mutations enforce tier gating, CourierClient generic base type (completed 2026-04-05)
- [x] **Phase 39: Final Wiring — Channel Alerts + Credit Exhaustion UI + OAuth FeatureGate** - Wire sendChannelAlert dispatch, mount CreditExhaustedInline, wrap OAuth CTAs with FeatureGate (completed 2026-04-05)
- [x] **Phase 40: Integration Cleanup — FeatureGate + Type Safety** - Wrap Jira/Calendar provider sections with FeatureGate, rebuild API dist types, remove (trpc as any) proxies (completed 2026-04-06)
- [ ] **Phase 41: Wiring Fixes — Teams Channel Ref + Onboarding OAuth** - Fix ConversationReference key mismatch for Teams channel alerts, fix onboarding wizard OAuth connect URL (in progress)

## Phase Details

### Phase 28: Stripe Billing Foundation
**Goal**: Organizations have working subscription billing with AI credit metering before any other v3.0 feature ships
**Depends on**: Nothing (independent foundation)
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08
**Success Criteria** (what must be TRUE):
  1. Admin can subscribe org to a plan (Starter/Pro/Enterprise) and see the subscription reflected in the app immediately
  2. New org starts with a free trial that shows trial status and days remaining, with warning notifications at 7/3/1 days
  3. Each OCR call records usage against the org's AI credit allowance, and OCR is hard-blocked with an upgrade prompt when credits are exhausted
  4. Stripe webhook events (subscription changes, payment failures, trial endings) update internal state idempotently without race conditions
  5. Admin can access Stripe-hosted billing portal to manage payment methods, view invoices, and cancel subscription
**Plans**: 4 plans

Plans:
- [x] 28-01-PLAN.md — Billing schema, Stripe client, webhook route, tRPC router (BILL-01/02/03/07/08)
- [x] 28-02-PLAN.md — OCR credit service with atomic deduction and Stripe Meter reporting (BILL-04/05/06)
- [x] 28-03-PLAN.md — Billing UI: Settings tab, plan comparison, trial banner, soft-block modal (all BILL reqs)
- [x] 28-04-PLAN.md — Gap closure: wire getCreditBalance tRPC endpoint and fix credit usage display (BILL-05)

### Phase 29: Linear Integration
**Goal**: Teams using Linear get the same bidirectional workflow-to-issue sync that Jira users already have
**Depends on**: Nothing (uses existing adapter framework)
**Requirements**: LIN-01, LIN-02, LIN-03, LIN-04, LIN-05, LIN-06
**Success Criteria** (what must be TRUE):
  1. Admin can connect Linear workspace via OAuth and see connection status in integrations settings
  2. Admin can map Linear workflow states to internal task statuses per team
  3. Starting a workflow task with Linear enabled auto-creates a Linear issue with correct team, title, description, and assignee
  4. Status changes flow bidirectionally between Linear and workflow tasks without creating sync loops
  5. Linked Linear issues display as clickable chips with live status badges on workflow task views
**Plans**: 4 plans

Plans:
- [x] 29-01-PLAN.md — Prisma enum, LinearAdapter, Zod validators, tRPC router shell, env config (LIN-01)
- [x] 29-02-PLAN.md — Status mapping service, issue sync, webhook handler, workflow hooks (LIN-02/03/04/05)
- [x] 29-03-PLAN.md — Provider section UI, status mapping dialog, issue chip, i18n (LIN-02/06)

### Phase 30: Equipment Tracking Foundation
**Goal**: Organizations can track physical equipment assigned to contractors with manual shipment entry and lifecycle-aware workflow steps
**Depends on**: Nothing (independent domain)
**Requirements**: EQUIP-01, EQUIP-02, EQUIP-03, EQUIP-04, EQUIP-08, EQUIP-09, EQUIP-10
**Success Criteria** (what must be TRUE):
  1. Admin can create, edit, and manage equipment items with type, serial number, status, and assignment to contractors
  2. Admin can assign and unassign equipment to contractors with full assignment history visible in audit trail
  3. Contractor profile shows an Equipment tab with assigned items and their current shipment status
  4. Admin can create a shipment with carrier, tracking number, and expected delivery date, and shipment progress displays as a timeline
  5. Onboarding workflow auto-creates "ship equipment" shipment and offboarding triggers return request, with tasks auto-completing on target shipment status
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 30-01-PLAN.md — Prisma schema (4 models, 4 enums), Zod validators, RBAC permission, tRPC router (EQUIP-01/02/04)
- [x] 30-02-PLAN.md — Equipment UI: list page, detail page, forms, assignment dialog, shipment timeline, contractor tab, i18n (EQUIP-01/02/03/04/08)
- [x] 30-03-PLAN.md — Workflow integration: equipment task handler, shipment auto-completion service, router hooks (EQUIP-09/10)

### Phase 31: Google Workspace Directory Import
**Goal**: Organizations using Google Workspace can import their team directory into the platform with role mapping
**Depends on**: Nothing (extends existing Google OAuth)
**Requirements**: GOOG-01, GOOG-02, GOOG-03, GOOG-04, GOOG-05
**Success Criteria** (what must be TRUE):
  1. Admin can connect Google Workspace with Admin SDK Directory API scopes via OAuth
  2. Admin can preview Google Workspace users with name, email, department, and org unit before importing
  3. Admin can selectively import users as org members with role assignment, including mapping Google Workspace groups to internal RBAC roles
  4. System periodically syncs the directory to detect new hires and flag departures without auto-deleting anyone
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 31-00-PLAN.md — Wave 0 test stubs for all GOOG requirements (GOOG-01/02/03/04/05)
- [x] 31-01-PLAN.md — GoogleWorkspaceAdapter, Zod validators, tRPC router with directory listing, group resolution, bulk import (GOOG-01/02/03/04)
- [x] 31-02-PLAN.md — Provider section UI, multi-step import wizard, directory preview table, role mapping, i18n (GOOG-01/02/03/04)
- [x] 31-03-PLAN.md — Directory sync orchestrator, QStash cron endpoint, new hire/departure notifications (GOOG-05)

### Phase 32: Teams Integration
**Goal**: Organizations using Microsoft Teams can receive notifications and approve/reject invoices directly from Teams
**Depends on**: Nothing (uses existing adapter framework; messaging abstraction refactors Slack delivery)
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, TEAM-06
**Success Criteria** (what must be TRUE):
  1. Admin can connect Teams workspace via Azure AD OAuth with bot registration and configure which channels receive which notification types
  2. Activity alerts (invoice received, contract expiring, payment completed) appear in configured Teams channels as Adaptive Cards
  3. Manager can approve or reject invoices directly from a Teams Adaptive Card without opening the web app
  4. Approvers receive proactive DM reminders in Teams for overdue approval items
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 32-01-PLAN.md — MessagingProvider interface, SlackMessagingProvider, dispatch refactor, schema updates (TEAM-01/03/05)
- [x] 32-02-PLAN.md — TeamsAdapter, Adaptive Cards, Graph API client (TEAM-01/03)
- [x] 32-03-PLAN.md — TeamsBotHandler, TeamsMessagingProvider, endpoint, tRPC router, USER-SETUP.md (TEAM-01/03/04/05/06)
- [x] 32-04-PLAN.md — Teams UI: provider section, channel mapping, notification prefs Teams column, i18n (TEAM-02/06)

### Phase 33: InPost Courier Integration
**Goal**: Organizations can create InPost shipments with Parcel Locker selection and get automatic delivery status tracking
**Depends on**: Phase 30 (equipment tracking foundation and CourierClient interface)
**Requirements**: EQUIP-05, EQUIP-11
**Success Criteria** (what must be TRUE):
  1. Admin can create an InPost shipment with Parcel Locker selection via the InPost Geowidget and the shipment status updates automatically via ShipX API
  2. Contractor can initiate equipment return via the portal and receive a shipping label
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 33-01-PLAN.md — CourierClient interface, InPostClient, status mapper, webhook handler, polling service, schema extensions, validators, tests (EQUIP-05)
- [x] 33-02-PLAN.md — Equipment router InPost extensions, portal router equipment/return endpoints, webhook/cron routes (EQUIP-05/EQUIP-11)
- [x] 33-03-PLAN.md — Paczkomat picker, InPost shipment form, label view, return approval banner, portal equipment tab, return flow, i18n (EQUIP-05/EQUIP-11)

### Phase 34: Intelligent Onboarding Wizard
**Goal**: New organizations can bootstrap their account by importing team members, projects, and statuses from connected tools in one guided flow
**Depends on**: Phase 29 (Linear), Phase 31 (Google Workspace), Phase 32 (Teams) for source data availability
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05
**Success Criteria** (what must be TRUE):
  1. User sees source selection during onboarding offering connected tools (Jira, Linear, Google Workspace, Slack) as import sources
  2. System imports team members from selected tools with email-based deduplication across sources
  3. System imports projects and statuses from PM tools (Jira, Linear) to pre-configure workflow templates
  4. User can preview all imported data with diff indicators (new/duplicate/conflict) and batch confirm, skip, or edit before committing
  5. Import runs async with progress tracking, and user can retry individual failed items without re-importing everything
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 34-01-PLAN.md — Tests, Zod validators, tRPC router, cross-tool fetch/merge/dedup service, batch import, workflow template creation, async progress (ONBD-01/02/03/04/05)
- [x] 34-02-PLAN.md — Full-page 4-step wizard UI, onboarding checklist modification, i18n EN/PL (ONBD-01/02/03/04/05)

### Phase 35: Feature Gating + DPD/UPS + Billing Polish
**Goal**: Paywall is enforced per subscription tier, remaining courier integrations ship, and billing UX is polished for launch
**Depends on**: Phase 28 (billing foundation), Phase 30 (courier interface), Phase 33 (proven CourierClient pattern)
**Requirements**: BILL-09, BILL-10, EQUIP-06, EQUIP-07
**Success Criteria** (what must be TRUE):
  1. Middleware gates features by org's active subscription tier with graceful upgrade prompts that name the specific feature and required plan
  2. Admin sees a usage dashboard showing current plan, seat count, OCR credits used/remaining, and next billing date
  3. DPD and UPS shipments can be created and tracked through the same equipment shipment flow as InPost
**Plans**: 6 plans
**UI hint**: yes

Plans:
- [x] 35-01-PLAN.md — requireTier tRPC middleware + getUsageDashboard endpoint (BILL-09/BILL-10)
- [x] 35-02-PLAN.md — DPD + UPS courier clients, status mappers, polling, validators (EQUIP-06/EQUIP-07)
- [x] 35-03-PLAN.md — Equipment router DPD/UPS procedures + courier polling cron (EQUIP-06/EQUIP-07/BILL-09)
- [x] 35-04-PLAN.md — FeatureGate, UpgradeInlineBanner, UsageDashboard, KPI cards, i18n (BILL-09/BILL-10)
- [x] 35-05-PLAN.md — CarrierShipmentForm, DPD/UPS fieldsets, credential setup, default return carrier, i18n (EQUIP-06/EQUIP-07)
- [x] 35-06-PLAN.md — Gap closure: testCourierConnection tRPC procedure (EQUIP-06/EQUIP-07)

### Phase 36: Wiring Fixes — Webhook Dispatch + UI Mounting + Feature Gate
**Goal**: Close all audit gaps: wire Linear inbound webhook dispatch, mount carrier UI components, activate feature gating in UI
**Depends on**: Phase 29 (Linear), Phase 30 (equipment), Phase 35 (carrier forms, feature gate)
**Requirements**: LIN-04, LIN-05, EQUIP-06, EQUIP-07, BILL-09
**Gap Closure**: Closes all gaps from v3.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. Linear status changes sent via webhook are dispatched to processLinearWebhook and update linked workflow task status (bidirectional sync complete)
  2. Admin can reach CarrierShipmentForm from equipment detail page to create DPD/UPS shipments
  3. Admin can configure DPD/UPS API credentials via CarrierCredentialForm in Settings > Integrations
  4. STARTER-tier users see FeatureGate upgrade prompts instead of raw tRPC errors when accessing PRO features
**Plans**: 3 plans

Plans:
- [x] 36-01-PLAN.md — Linear webhook dispatch + outbound CANCELLED sync (LIN-04/LIN-05)
- [x] 36-02-PLAN.md — DPD/UPS provider sections + CarrierShipmentForm mounting (EQUIP-06/EQUIP-07)
- [x] 36-03-PLAN.md — requireTier middleware + global TIER_REQUIRED error handler (BILL-09)

### Phase 37: Shipment Task Auto-Completion Wiring
**Goal**: Webhook and polling paths trigger workflow task auto-completion when shipments reach target status
**Depends on**: Phase 30 (equipment workflow), Phase 33 (InPost), Phase 35 (DPD/UPS)
**Requirements**: EQUIP-09, EQUIP-10
**Gap Closure**: Closes MISSING-02 from v3.0 audit — webhook/polling paths skip checkShipmentTaskCompletion
**Success Criteria** (what must be TRUE):
  1. InPost webhook status update triggers checkShipmentTaskCompletion and auto-completes linked workflow task on target status
  2. InPost polling status update triggers checkShipmentTaskCompletion and auto-completes linked workflow task on target status
  3. DPD polling status update triggers checkShipmentTaskCompletion and auto-completes linked workflow task on target status
  4. UPS polling status update triggers checkShipmentTaskCompletion and auto-completes linked workflow task on target status
**Plans**: 1 plan

Plans:
- [x] 37-01-PLAN.md — Wire checkShipmentTaskCompletion into InPost webhook, InPost/DPD/UPS polling + tests (EQUIP-09/EQUIP-10)

### Phase 38: Tier Gate Expansion + CourierClient Type Fix
**Goal**: All mutation endpoints enforce subscription tier gating and CourierClient interface uses a generic base type
**Depends on**: Phase 36 (requireTier middleware), Phase 35 (CourierClient interface)
**Requirements**: BILL-09, EQUIP-05, EQUIP-06, EQUIP-07
**Gap Closure**: Closes MISSING-01 (tier gate gaps) and MISSING-03 (CourierClient type contract) from v3.0 audit
**Success Criteria** (what must be TRUE):
  1. Teams router mutation procedures (saveChannelMapping) are gated by requireTier("PRO")
  2. Google Workspace router mutation procedures (bulkImport, triggerSync, listUserGroups) are gated by requireTier("PRO")
  3. Onboarding import router procedures are gated by requireTier("PRO")
  4. CourierClient interface uses a generic base type for createShipment params instead of InPost-specific targetPoint
**Plans**: 3 plans

Plans:
- [x] 38-01-PLAN.md — Tier gate Teams, GWS, Onboarding Import routers with requireTier("PRO") + tests (BILL-09)
- [x] 38-02-PLAN.md — CourierClient BaseShipmentParams type hierarchy refactor + test updates (EQUIP-05/EQUIP-06/EQUIP-07)
- [x] 38-03-PLAN.md — FeatureGate wrappers on Teams, GWS, Onboarding Import UI components (BILL-09)

### Phase 39: Final Wiring — Channel Alerts + Credit Exhaustion UI + OAuth FeatureGate
**Goal**: Wire remaining notification dispatch, mount credit exhaustion UI, and gate OAuth connect buttons by tier
**Depends on**: Phase 32 (Teams), Phase 28 (billing), Phase 35 (FeatureGate), Phase 36 (notification dispatch)
**Requirements**: TEAM-02, TEAM-03, BILL-06, BILL-09
**Gap Closure**: Closes MISSING-04 (sendChannelAlert never called), MISSING-05 (CreditExhaustedInline never mounted), MISSING-06 (OAuth connect buttons missing FeatureGate) from v3.0 re-audit
**Success Criteria** (what must be TRUE):
  1. Notification dispatch routes activity alerts to configured Teams/Slack channels via sendChannelAlert based on channelMapping in configJson
  2. OCR-triggering UI shows CreditExhaustedInline with upgrade/top-up prompt when credits are exhausted instead of generic error
  3. STARTER-tier users see FeatureGate upgrade prompt on OAuth connect buttons for Linear, Google Workspace, and Teams
**Plans**: 3 plans

Plans:
- [x] 39-01-PLAN.md — Wire sendChannelAlert dispatch in notification-service.ts (TEAM-02/TEAM-03)
- [x] 39-02-PLAN.md — Mount CreditExhaustedInline in invoice upload areas (BILL-06)
- [x] 39-03-PLAN.md — Wrap Linear/GWS/Teams provider sections with FeatureGate (BILL-09)

### Phase 40: Integration Cleanup — FeatureGate + Type Safety
**Goal**: Close remaining integration findings: consistent FeatureGate wrappers on all OAuth provider sections, and restore full type safety by rebuilding API dist types
**Depends on**: Phase 35 (FeatureGate component), Phase 38 (tier gate middleware), Phase 39 (FeatureGate pattern)
**Requirements**: BILL-09, EQUIP-05, EQUIP-06, EQUIP-07, TEAM-02, BILL-10
**Gap Closure**: Closes FINDING-01 (Jira/Calendar FeatureGate UI gap) and FINDING-02 (stale API dist types) from v3.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. Jira and Calendar OAuth provider sections are wrapped with FeatureGate requiring PRO tier, consistent with Linear/GWS/Teams pattern
  2. API dist types are rebuilt and all 4 components (usage-dashboard, teams-channel-mapping-card, carrier-shipment-form, inpost-shipment-form) use proper typed tRPC calls without `as any` proxies
**Plans**: 2 plans

Plans:
- [x] 40-01-PLAN.md — FeatureGate wrappers on Jira/Calendar + rebuild API dist types (BILL-09)
- [x] 40-02-PLAN.md — Remove all (trpc as any) proxy workarounds across 13 files (EQUIP-05/EQUIP-06/EQUIP-07/TEAM-02/BILL-10)

### Phase 41: Wiring Fixes — Teams Channel Ref + Onboarding OAuth
**Goal**: Fix two cross-phase wiring bugs: Teams channel alert ConversationReference key mismatch and onboarding wizard OAuth connect URL
**Depends on**: Phase 32 (Teams), Phase 34 (Onboarding)
**Requirements**: TEAM-03, ONBD-01
**Gap Closure**: Closes TEAM-03 (ConversationReference key mismatch) and ONBD-01 (OAuth connect URL 404) from v3.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. Teams channel alerts deliver Adaptive Cards to configured channels when activity events fire (ConversationReference looked up by channel thread ID)
  2. Onboarding wizard "Connect" button for disconnected providers opens OAuth authorization via `trpc.integration.getOAuthUrlGeneric` instead of 404
**Plans**: 2 plans

Plans:
- [ ] 41-01-PLAN.md — Fix ConversationReference key mismatch for Teams channel alerts (TEAM-03)
- [x] 41-02-PLAN.md — Fix onboarding wizard OAuth connect URL to use tRPC (ONBD-01)

## Progress

**Execution Order:**
Phases execute in numeric order: 28 → 29 → 30 → 31 → 32 → 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40 → 41

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Auth | v1.0 | 4/4 | Complete | 2026-03-18 |
| 2. Contractor Registry | v1.0 | 3/3 | Complete | 2026-03-19 |
| 3. Contracts & Documents | v1.0 | 6/6 | Complete | 2026-03-19 |
| 4. Workflow Engine | v1.0 | 5/5 | Complete | 2026-03-20 |
| 5. Invoice Intake & Matching | v1.0 | 5/5 | Complete | 2026-03-21 |
| 6. Approval Workflow | v1.0 | 6/6 | Complete | 2026-03-21 |
| 7. Notifications & Slack | v1.0 | 5/5 | Complete | 2026-03-22 |
| 8. Payments | v1.0 | 4/4 | Complete | 2026-03-22 |
| 9. Dashboard & Reports | v1.0 | 6/6 | Complete | 2026-03-22 |
| 10. Onboarding & Polish | v1.0 | 5/5 | Complete | 2026-03-23 |
| 11. Route Fixes & Tenant Isolation | v1.0 | 2/2 | Complete | 2026-03-23 |
| 12. Integration Foundation | v2.0 | 5/5 | Complete | 2026-03-23 |
| 13. Contractor Portal Auth & Core Views | v2.0 | 5/5 | Complete | 2026-03-23 |
| 14. Portal Self-Service & Branding | v2.0 | 5/5 | Complete | 2026-03-23 |
| 15. E-Sign Integration | v2.0 | 4/4 | Complete | 2026-03-27 |
| 16. OCR Invoice Parsing | v2.0 | 3/3 | Complete | 2026-03-27 |
| 17. KSeF Integration | v2.0 | 3/3 | Complete | 2026-03-27 |
| 18. Time Tracking | v2.0 | 6/6 | Complete | 2026-03-28 |
| 19. Jira Integration | v2.0 | 6/6 | Complete | 2026-03-29 |
| 20. Documentation & Calendar | v2.0 | 6/6 | Complete | 2026-03-29 |
| 21. API Build Fixes & Permission Registration | v2.0 | 2/2 | Complete | 2026-03-30 |
| 22. Component Mounting & Lifecycle Wiring | v2.0 | 2/2 | Complete | 2026-03-30 |
| 23. OCR Adapter Registry Fix | v2.0 | 1/1 | Complete | 2026-03-30 |
| 24. Jira Auto-Issue Creation Wiring | v2.0 | 1/1 | Complete | 2026-03-30 |
| 25. Portal E-Sign Auth Fix | v2.0 | 1/1 | Complete | 2026-03-30 |
| 26. Calendar Wiring Fixes | v2.0 | 1/1 | Complete | 2026-03-30 |
| 27. OAuth Callback & OCR Build Fixes | v2.0 | 1/1 | Complete | 2026-04-01 |
| 28. Stripe Billing Foundation | v3.0 | 4/4 | Complete    | 2026-04-01 |
| 29. Linear Integration | v3.0 | 3/3 | Complete    | 2026-04-01 |
| 30. Equipment Tracking Foundation | v3.0 | 2/3 | Complete    | 2026-04-02 |
| 31. Google Workspace Directory Import | v3.0 | 5/5 | Complete    | 2026-04-02 |
| 32. Teams Integration | v3.0 | 4/4 | Complete    | 2026-04-04 |
| 33. InPost Courier Integration | v3.0 | 3/3 | Complete    | 2026-04-04 |
| 34. Intelligent Onboarding Wizard | v3.0 | 2/2 | Complete    | 2026-04-05 |
| 35. Feature Gating + DPD/UPS + Billing Polish | v3.0 | 6/6 | Complete    | 2026-04-05 |
| 36. Wiring Fixes — Webhook Dispatch + UI Mounting + Feature Gate | v3.0 | 3/3 | Complete    | 2026-04-05 |
| 37. Shipment Task Auto-Completion Wiring | v3.0 | 1/1 | Complete    | 2026-04-05 |
| 38. Tier Gate Expansion + CourierClient Type Fix | v3.0 | 3/3 | Complete    | 2026-04-05 |
| 39. Final Wiring — Channel Alerts + Credit Exhaustion UI + OAuth FeatureGate | v3.0 | 1/3 | Complete    | 2026-04-05 |
| 40. Integration Cleanup — FeatureGate + Type Safety | v3.0 | 2/2 | Complete    | 2026-04-06 |
| 41. Teams Channel Ref + Onboarding OAuth | v3.0 | 1/2 | In Progress|  |
