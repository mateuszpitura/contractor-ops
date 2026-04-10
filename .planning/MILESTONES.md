# Milestones

## v3.0 Enterprise & Monetization (Shipped: 2026-04-10)

**Phases completed:** 17 phases, 47 plans, 91 tasks

**Key accomplishments:**

- Stripe billing backend with subscription schema, idempotent webhook processing, trial credits, trial notification cron, and tRPC billing router
- Atomic OCR credit deduction with Serializable isolation, trial-aware allowances (5 credits per D-08), Stripe Meter reporting, and hard-block on credit exhaustion
- Complete billing UI with Settings tab, 3-tier plan comparison grid (199/449/849 PLN), trial banner, soft-block modal, credit usage with progress bar, and Stripe Checkout integration via tRPC
- Wire getCreditBalance through tRPC so CreditUsageCard displays real OCR credit consumption from the ledger
- LinearAdapter with OAuth + HMAC-SHA256 webhook verification, Zod validators, PENDING_MAPPING status flow, and 6-procedure tRPC router for Linear issue sync foundation
- Bidirectional Linear sync with status mapping (PENDING_MAPPING->CONNECTED D-03), GraphQL issue creation with email assignee lookup, inbound webhook processing, and workflow router integration for auto-issue creation and outbound status sync
- Linear provider section with post-OAuth mandatory mapping flow, status mapping dialog with smart defaults, workflow template team selector, issue chips on workflow task views, and full EN/PL i18n
- Prisma schema with 4 models and 4 enums, Zod validators, RBAC permissions, and 13-endpoint tRPC router for equipment tracking
- Equipment list/detail pages with TanStack Table, CRUD/assignment/shipment dialogs, shipment timeline, contractor profile Equipment tab, and full EN/PL i18n
- Equipment workflow service wiring EQUIPMENT tasks into onboarding/offboarding workflows with shipment-driven auto-completion and multi-shipment gate
- 49 vitest todo stubs across 4 test files covering all GOOG requirements (OAuth, Directory API, sync detection, bulk import, Zod validators)
- Google Workspace Admin SDK adapter with directory/group listing, tRPC router with 5 procedures including server-side RBAC group re-fetch, and QStash daily sync cron
- Complete Google Workspace directory import UI: 9 components with 3-step wizard, TanStack Table with selection/search/filter, role assignment with group mapping, and en/pl i18n
- Directory sync orchestrator with QStash endpoint that detects Google Workspace new hires and departures via email snapshot diffing, dispatching admin notifications without auto-modifying users
- Fixed 3 provider slug string literals from hyphen to underscore, unblocking OAuth connect, health check, disconnect, and post-OAuth wizard auto-open
- MessagingProvider abstraction over Slack with provider iteration in dispatch(), Prisma schema for MICROSOFT_TEAMS/TEAMS/channelTeams, and SlackMessagingProvider delegating to existing slack-client.ts
- TeamsAdapter with Azure AD OAuth, 5 Adaptive Card templates for approval workflow, and Graph API client for channel discovery
- TeamsBotHandler with Zod-validated card actions, TeamsMessagingProvider for proactive messaging, Bot Framework endpoint, tRPC channel router, and Azure Bot Service setup guide
- Teams provider section with channel mapping card, notification preferences Teams column, and full en/pl i18n
- CourierClient interface with InPostClient ShipX wrapper, webhook handler with event deduplication, polling fallback service, and 44 passing tests
- tRPC equipment/portal router extensions with InPost shipment creation, return approval workflow, webhook/cron endpoints, and offboarding auto-shipment
- Complete InPost courier UI: Paczkomat picker with Geowidget iframe, shipment creation form, label viewer with download/print, admin return approval banner, portal equipment tab, and contractor 3-step return flow with en/pl i18n
- Cross-tool onboarding import API with Jira/Linear/Google Workspace/Slack user fetch, email-based merge/dedup with conflict detection, project-to-workflow template conversion, and per-item retry
- 4-step full-page wizard with source selection, merged people review with conflict resolution, project import with editable steps, and async progress tracker with per-item retry
- requireTier tRPC middleware with TIER_RANK gating and getUsageDashboard endpoint aggregating subscription, credits, seats, and plan config
- DPD and UPS courier clients with OAuth token caching, status mappers, polling services, carrier factory, and Zod validators -- all following InPost's CourierClient pattern
- DPD and UPS shipment creation procedures with PRO tier gating, courier config CRUD, and multi-carrier polling cron
- FeatureGate wrapper with tier-based inline upgrade banners and 4-card usage dashboard (plan, seats, credits, billing date) with green/yellow/red credit progress bar
- Unified carrier shipment form with dynamic DPD/UPS/InPost fieldsets, credential setup cards with test/save, and default return carrier selector
- testCourierConnection tRPC procedure closing CarrierCredentialForm verification gap, with getStatus probe and structured success/failure response
- Bidirectional Linear sync wired via QStash webhook dispatch and outbound CANCELLED status sync in cancelRun for both Linear and Jira
- DPD and UPS integration cards mounted in Settings with credential dialogs, and CarrierShipmentForm wired to equipment detail page with carrier-configured visibility gate
- requireTier middleware applied to 10 integration/OCR/audit mutations with global TIER_REQUIRED upgrade toast in QueryClient
- Fire-and-forget checkShipmentTaskCompletion wired into all 4 courier status update paths (InPost webhook, InPost/DPD/UPS polling) with unit and integration tests
- requireTier("PRO") added to 10 ungated procedures across Teams, GWS, and Onboarding Import routers with STARTER-rejection tests
- Extracted generic BaseShipmentParams from InPost-specific CreateShipmentParams, making CourierClient interface carrier-agnostic
- FeatureGate wrapping on 3 PRO-only components (Teams mapping, GWS import, onboarding wizard) for defense-in-depth tier gating
- sendChannelAlert wired into notification-service dispatch loop for 9 activity notification types with channelMapping lookup from integrationConnection configJson
- CreditExhaustedInline mounted in OCR-triggering upload components with TRPCClientError PRECONDITION_FAILED detection and /settings?tab=billing navigation
- FeatureGate wrapping on Linear, Google Workspace, and Teams OAuth sections — STARTER users see upgrade prompt instead of connect buttons
- FeatureGate PRO-tier wrappers on Jira/Calendar sections + ShipmentParams union type fix enabling clean API dist build
- Removed all 13 (trpc as any) proxy workarounds, restoring full type safety across billing, teams, equipment, portal, and settings components
- Fixed ConversationReference key mismatch from tenantId to conversation.id so Teams channel alerts resolve stored refs correctly
- Replaced broken hardcoded /api/oauth URL in onboarding wizard with tRPC getOAuthUrlGeneric call for working OAuth connect flow
- Shared dispatchShipmentNotification helper wired into DPD, UPS, and InPost polling services for terminal status notifications

---

## v2.0 Platform Expansion (Shipped: 2026-04-01)

**Phases completed:** 16 phases, 52 plans, 103 tasks

**Key accomplishments:**

- AES-256-GCM credential encryption with per-provider keys, IntegrationProviderAdapter contract, provider registry, and Prisma schema extension for token expiry tracking
- Unified webhook ingestion pipeline with Slack HMAC-SHA256 and Resend Svix adapters, QStash async processing, and WebhookDelivery audit logging
- Generic OAuth callback with HMAC-signed cross-provider CSRF state, proactive token refresh cron with distributed lock, and lazy refresh fallback
- Health monitoring service with provider card grid, detail sheet (sync log + webhook deliveries), and 30-second polling via TanStack Query
- Wired IntegrationsTab into settings, documented all env vars, and marked legacy Slack/Resend routes deprecated with backward-compat migration path
- PortalSession and PortalMagicToken Prisma models with SHA-256 hashed session service (7-day expiry) and single-use magic link service (15-min expiry, Resend email)
- portalProcedure middleware with cookie auth + 15-endpoint portal tRPC router covering magic link auth, contracts, invoices, documents, payments, and invoice submission
- Portal layout with top bar navigation (5 links + org branding + profile dropdown), magic link login page, token verification with org picker for multi-org contractors, and httpOnly session cookie management via API routes
- Overview dashboard with 4 summary cards and activity log, contracts list/detail with document downloads, documents table, and payments table -- all consuming portal tRPC router with loading skeletons and empty states
- Invoice list with status badges, detail page with 3-layer status tracking (StatusTimeline + ActivityLog), submission form with contract picker and presigned PDF upload, and success confirmation page
- Two Prisma models (change request + notification prefs), change request service with transactional approval, 6 portal endpoints, and 3 admin endpoints for contractor self-service and org branding
- Portal settings page with collapsible profile sections (immediate contact edit + approval-flow financial edit), notification preference toggles with optimistic updates, and Settings nav link in portal navigation
- Portal CSS custom property brand injection, admin branding section with 8-swatch color picker + logo upload, and change request diff cards with approve/reject in approvals tab
- End-to-end portal subdomain routing via Next.js middleware with x-portal-org-subdomain header flow, admin subdomain config UI, and branded unauthenticated portal shell
- 21 it.todo() test stubs across 4 files covering all Phase 14 API behaviors: change request service CRUD, portal profile endpoints, notification preference defaults with SECURITY_ALERTS guard, and branding hex validation
- Prisma signing models (envelope/recipient/event), ESignAdapter interface with 7 operations, and 23 Wave 0 test stubs for DocuSign, Autenti, router, and webhook handler
- DocuSign and Autenti adapters implementing ESignAdapter interface with provider-agnostic orchestration service
- Complete server-side signing lifecycle: tRPC router with 7 procedures, orchestrator for envelope creation/void/completion with R2 PDF storage, and webhook handler with idempotency and contract status mapping
- Complete e-sign UI: SendForSignature dialog with dnd-kit signer reorder and provider picker, signing progress bar with per-signer step indicators, embedded signing modal with DocuSign iframe and Autenti redirect fallback, audit trail sheet, void dialog, and portal pending signatures section
- Claude Vision OCR pipeline with native PDF extraction, NIP checksum validation, confidence scoring, async QStash processing, and tRPC endpoints for admin and portal
- Seven composable OCR review components: react-pdf viewer with zoom/navigation, confidence badges with D-07 thresholds, NIP modulo-11 validation, extraction status bar, processing overlay, and editable line items table with grosze formatting
- OcrReviewPanel split view with PDF + pre-filled form, admin upload auto-trigger, and portal form OCR pre-fill with confidence indicators
- KSeF API client with RSA-OAEP auth, FA(3) XML parser with Zod-validated grosze conversion, and adapter registered in integration registry
- KSeF sync orchestrator with hourly QStash cron, cross-source duplicate detection by invoiceNumber+sellerTaxId, tRPC router with connect/disconnect/triggerSync, and KSEF_SYNC_COMPLETE notification
- 6 KSeF UI components: setup dialog with token/cert auth, provider card with sync controls, invoice table badge, detail metadata section with copyable fields, and cross-source duplicate banner
- 76 vitest it.todo stubs across 6 files covering time entry CRUD, timesheet lifecycle, approval flow, Clockify sync, Jira worklog import, and invoice reconciliation
- Timesheet/TimeEntry Prisma models with DRAFT->SUBMITTED->APPROVED/REJECTED status machine, 12 Zod validators, and core service layer using optimistic locking
- Clockify and Jira adapters with on-demand sync services for external time entry import via API key and OAuth 2.0 3LO
- Portal time tRPC router with 8 endpoints and full contractor UI: weekly timesheet grid with auto-save, single entry dialog, Clockify/Jira sync buttons, and week navigation
- Admin time tRPC router with 8 procedures, manager approval queue with batch operations, per-contractor timesheet review, and rejection dialog with 10-char minimum validation
- Time-vs-invoice reconciliation service with configurable deviation threshold, DeviationFlag badge, ReconciliationCard on invoice detail, and ReconciliationTable in admin time section
- 60 it.todo behavioral contract entries across 4 test stub files for Jira issue sync, webhook handling, status mapping, and adapter webhooks
- Extended JiraAdapter with write/webhook scopes, built issue sync with ADF descriptions, inbound webhook handler with loop prevention and deduplication, and per-project bidirectional status mapping
- Jira tRPC router with 11 procedures (connection status, project/issue type listing, status mapping CRUD, task config, linked issues, recent activity, disconnect), webhook dispatch in _process route, and outbound Jira transitions from workflow task completion
- Jira provider card with OAuth connect, scope expansion detection, status mapping dialog with per-project two-column table, and project/issue type mapping dialog for task templates
- JiraIssueChip, JiraActivitySummary, and JiraTaskConfig components wired into contractor Workflows tab and workflow side panel with status-colored chips and overflow handling
- Mounted orphaned JiraTaskConfig in task-card.tsx and hardened siteUrl derivation removing 'your-site' placeholder fallback
- 43 it.todo test stubs across 6 files covering Notion, Confluence, Google Calendar, Outlook Calendar adapters plus doc-link and calendar-sync services
- Four OAuth adapters (Notion, Confluence, Google Calendar, Outlook Calendar) with Prisma schema changes, Zod validators, and per-user connection support
- Doc link service and tRPC router for attaching/detaching Notion and Confluence pages to workflow steps, with multi-provider search proxy
- Calendar event lifecycle service with Google/Outlook dual-push, 3 deadline sync watchers, task event creation, and 7-procedure tRPC router
- Doc link chips, attach dialog with search, doc links section for workflow task cards, and Cmd+K Docs search group with provider icons
- My Calendar settings page with Google/Outlook provider cards, per-task calendar event config dialog, org calendar section, and Notion/Confluence cards in integrations tab
- Added 4 adapter subpath exports to integrations, registered time permission resource, and restored validators helpers for clean package compilation
- Fixed 4 API source files (calendar, docs, doc-link-service, time-entry) eliminating ~20 TypeScript errors from ctx.userId, ctx.prisma, CredentialBlob cast, and PrismaClient transaction type issues
- Mounted DocLinksSection in workflow run task card and CalendarTaskConfig in template builder task card with correct prop wiring and section ordering
- Fire-and-forget calendar sync hooks wired into 8 contract/approval/invoice lifecycle mutations using void + .catch() pattern
- Restored ClaudeOcrAdapter registry resolution by adding missing slug property and re-registering in registerAllAdapters()
- Wire createJiraIssue fire-and-forget into startRun so TODO tasks with jiraEnabled templates automatically create Jira issues
- Portal signing URL endpoint via portalProcedure with recipient verification and conditional auth switching in EmbeddedSigningModal
- Fixed OAuth URL construction (space scopes, response_type=code, extraAuthParams) and wired createTaskCalendarEvent fire-and-forget into startRun with calendarTaskCount response toast
- registerAllAdapters() added to OAuth callback route + react-pdf CSS converted to dynamic imports for Next.js build compatibility

---

## v1.0 MVP (Shipped: 2026-03-23)

**Phases completed:** 11 phases, 51 plans, 98 tasks

**Key accomplishments:**

- Turborepo monorepo with 6 packages, complete Prisma 7 schema (40+ models across 11 bounded contexts), Neon adapter, tenant isolation via AsyncLocalStorage Client Extension, and soft-delete Client Extension with integer grosze for all monetary fields
- Better Auth with 8-role RBAC organization plugin, tRPC v11 middleware chain (auth/tenant/RBAC/sensitive), and organization/user/settings routers with re-authentication guards on sensitive actions
- Auth screens (register/login/invite), collapsible sidebar with org switcher and RBAC-filtered nav, org settings form, user management table with invite/role-change/deactivate, dark mode, and Indigo theme
- next-intl with Polish/English localization across all Phase 1 UI -- 9 translation namespaces, locale routing, PLN currency/date formatters, and language switcher
- tRPC contractor router with 10 procedures (CRUD, paginated list with FTS, lifecycle state machine, compliance health scoring, GUS BIR1 autofill, bulk operations, CSV/XLSX export) plus Zod validators with NIP mod-11 and IBAN validation
- Contractor list page with TanStack Table (12 columns, server-side pagination/sorting/filtering, bulk actions, side panel), 3-step add wizard with GUS NIP autofill, full Polish/English i18n
- Contractor profile page with header/lifecycle actions, 8-tab navigation (overview + compliance fully implemented), compliance health card with per-factor scoring, and sticky right rail with activity timeline and quick notes
- Contract tRPC router with 10 CRUD/list/status/amendment procedures, Zod validators, FTS tsvector migration, and org-level expiry reminder defaults in settings router
- R2 presigned URL upload/download flow with MIME magic-byte validation, ClamAV virus scanning, document versioning, and entity linking via tRPC router
- Contract list page with TanStack Table (12 columns, FTS search, multi-facet filters, pagination, bulk actions) and slide-out side panel on row click
- 3-step contract wizard with contractor billing pre-fill, drag-and-drop document upload via presigned URLs, and top bar quick action entry point
- Contract detail page with 4-tab layout (Overview, Documents, Amendments, Activity) and 6 reusable document components with drag-and-drop upload, PDF preview, and version history
- Contractor profile tabs replaced with real data (Contracts mini table, Documents cards, Compliance upload), Settings expiry reminder defaults, and full Phase 3 EN/PL translations
- Complete workflow tRPC router with template CRUD, run lifecycle, task actions, condition evaluator, assignee resolver, and overdue detection
- Workflow template builder with dnd-kit sortable task list, collapsible task cards, AND/OR condition builder, and 245-key EN/PL i18n translations
- Main /workflows page with runs TanStack Table, My Tasks list, Templates management, side panel preview, and template picker dialog for starting workflows
- Workflow run detail page with progress bar, task checklist, inline Complete/Skip/Reassign actions, threaded comments, and file attachments using Phase 3 document components
- Workflow engine fully connected: contractor profile Workflows tab, header Start onboarding/offboarding buttons, bulk Launch workflow, sidebar overdue badge, and auto-seeded starter templates
- Invoice tRPC router with 11 procedures, Zod validators, and NIP-based auto-matching engine with score classification and duplicate detection
- Resend Inbound webhook handler that receives emails, verifies signatures, parses org slug from recipient, uploads PDF attachments to R2, and creates Invoice drafts with EMAIL_INTAKE source
- Invoice list page with TanStack Table (11 columns), status chip bar with live counts, slide-out side panel, and multi-file PDF upload area with per-file progress
- Invoice detail page with 60/40 PDF split layout, editable metadata form (14 fields with grosze currency conversion), match card with confidence indicator and manual matching, and duplicate warning banner
- Contractor invoices tab with pre-filtered table, settings invoice matching section with copyable email and deviation threshold, full EN+PL translations
- Approval engine with configurable chain routing, 4-action state machine (approve/reject/delegate/clarify), SLA computation, and 14-procedure tRPC router including bulk ops and audit trail
- Settings > Approvals tab with chain list cards, chain editor dialog (1-3 level cards with user/role approver picker, SLA, required toggle), and condition builder for routing rules
- Approvals page with TanStack Table queue, SLA countdown badges, inline approve/reject, bulk toolbar, and side panel with 4 approval actions (approve, reject, clarify, delegate)
- Horizontal chain tracker stepper with status-colored steps and SLA badges, vertical audit timeline with human/system event split, and submit-for-approval action on invoice detail page
- Complete EN + PL i18n for all approval workflow UI (queue, chain tracker, audit timeline, settings) with SLA breach events verified in audit trail API
- Fixed broken bulk approve/reject wiring by adding onSelectionChange callback from TanStack Table row selection to parent page selectedIds state
- Notification dispatch service with deduplication, preference defaulting, and three tRPC routers for notifications, reminders, and Slack integration
- Slack client with AES-256-GCM encrypted tokens, 6 React Email templates, OAuth/interactivity/cron API routes
- Bell icon popover with 30s unread count polling, scrollable notification list, and full /notifications page with type filters, unread toggle, and pagination
- Notification preference matrix with per-channel toggles, reminder rules CRUD dialog, Slack OAuth connection card, and user mapping table in Settings tabs
- Real notification dispatch wired into approval/workflow/invoice routers with Resend email delivery, Slack Block Kit DMs, and full EN+PL i18n for all Phase 7 surfaces
- Vitest configured in api package with 50 todo test stubs covering payment router procedures, export generators, and bank statement parser
- Payment tRPC router with 12 procedures, 3 export formats (CSV/Elixir/SEPA), bank statement parser with auto-matching, and approval-to-READY transition fix
- Full /payments page with run history table, 3-step new payment run dialog, side panel with status management and D-04 invoice removal, bank statement import, and navigation wiring
- Contractor profile Payments tab with mini TanStack Table, settings transfer title template editor with live preview, and 144-key EN/PL i18n namespace covering all payment UI surfaces
- 64 vitest .todo() stubs across 4 files defining behavior contracts for dashboard KPIs, 5 report types, audit log, and CSV export
- 3 tRPC routers (dashboard/report/audit) with 17 query + 6 mutation procedures, raw SQL spend aggregations, and CSV export service
- Full dashboard with 5 KPI cards (trend indicators + click navigation), Recharts spend area chart with 6m/12m/YTD toggle, deadlines/approval/activity widgets in responsive two-column layout
- Reports page with 5 report types (spend/contractor, spend/team, expiring contracts, overdue invoices, compliance gaps), Recharts charts with drill-down, TanStack tables with server-side pagination, and CSV export
- Audit log viewer in Settings tab with searchable TanStack Table, expandable before/after diff rows, structured filters via nuqs, and CSV export
- Complete EN/PL translations for Dashboard (KPI, spend, deadlines, approvals, activity), with all hardcoded strings externalized from Phase 9 components
- CSV/XLSX import processor with column auto-mapping, row validation, and duplicate detection; unified cross-entity tsvector search router
- Reusable EmptyState component with prerequisite-aware smart sequencing and 5-step onboarding checklist widget on dashboard
- 5-step CSV/XLSX import wizard with column auto-mapping, validation preview, duplicate resolution, and list page integration
- Cmd+K command palette with tRPC global search, recent/pinned items, quick actions, and contextual empty states with smart sequencing across all 7 major list views
- Full English + Polish i18n for all Phase 10 surfaces: import wizard, onboarding checklist, empty states, and command palette via 4 new translation namespaces
- Fixed sidebar navigation hrefs, onboarding CTA links, and wired Cmd+K quick actions to open dialogs via ?action= URL params on 4 list pages
- Confirmed tenantStore.run() already wired in tenant middleware -- ORG-07 audit finding was stale, no code changes needed

---
