# Roadmap: Contractor Ops

## Milestones

- ✅ **v1.0 MVP** — Phases 1-11 (shipped 2026-03-23)
- 🚧 **v2.0 Platform Expansion** — Phases 12-20 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-11) — SHIPPED 2026-03-23</summary>

- [x] Phase 1: Foundation & Auth (4/4 plans)
- [x] Phase 2: Contractor Registry (3/3 plans)
- [x] Phase 3: Contracts & Documents (6/6 plans)
- [x] Phase 4: Workflow Engine (5/5 plans)
- [x] Phase 5: Invoice Intake & Matching (5/5 plans) — completed 2026-03-21
- [x] Phase 6: Approval Workflow (6/6 plans)
- [x] Phase 7: Notifications & Slack (5/5 plans) — completed 2026-03-22
- [x] Phase 8: Payments (4/4 plans)
- [x] Phase 9: Dashboard & Reports (6/6 plans)
- [x] Phase 10: Onboarding & Polish (5/5 plans) — completed 2026-03-23
- [x] Phase 11: Route Fixes & Tenant Isolation (2/2 plans) — completed 2026-03-23

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v2.0 Platform Expansion (In Progress)

**Milestone Goal:** Transform Contractor Ops from an internal-only tool into a full platform with contractor self-service, intelligent document processing, KSeF compliance, and deep third-party integrations.

- [x] **Phase 12: Integration Foundation** — Shared OAuth credential store, webhook ingestion layer, and health monitoring (completed 2026-03-23)
- [x] **Phase 13: Contractor Portal Auth & Core Views** — Magic-link auth, contract viewing, invoice submission, payment tracking, document access (completed 2026-03-23)
- [x] **Phase 14: Portal Self-Service & Branding** — Profile self-management with approval, notification preferences, org branding (gap closure in progress) (completed 2026-03-23)
- [x] **Phase 15: E-Sign Integration** — DocuSign + Autenti contract signing with multi-party support and auto-storage (completed 2026-03-23)
- [x] **Phase 16: OCR Invoice Parsing** — Auto-extract invoice fields from PDFs with confidence scores and human review (completed 2026-03-27)
- [x] **Phase 17: KSeF Integration** — Auto-fetch invoices from national e-invoicing system with XML parsing and duplicate detection (completed 2026-03-27)
- [x] **Phase 18: Time Tracking** — Manual hour logging, manager approval, Clockify/Jira import, invoice deviation flagging (completed 2026-03-27)
- [x] **Phase 19: Jira Integration** — OAuth connection, workflow-to-issue creation, bidirectional status sync, linked issue display (gap closure in progress)
- [ ] **Phase 20: Documentation & Calendar** — Notion/Confluence page linking and Google/Outlook calendar deadline sync

## Phase Details

### Phase 12: Integration Foundation
**Goal**: Every subsequent integration phase can store credentials, receive webhooks, and report health without building its own infrastructure
**Depends on**: Phase 11 (v1.0 complete)
**Requirements**: INTG-01, INTG-02, INTG-03
**Success Criteria** (what must be TRUE):
  1. Admin can connect a third-party service via OAuth 2.0 and see encrypted credentials stored with expiry tracking
  2. External webhook payloads are received, HMAC-verified, stored in a webhook event log, and processed asynchronously
  3. Admin can view a dashboard showing connection health status and last sync time for each connected provider
  4. Token refresh runs proactively before expiry without admin intervention
**Plans**: 6 plans

Plans:
- [x] 12-01-PLAN.md — Package scaffolding, type contracts, credential service, DB migration
- [x] 12-02-PLAN.md — Webhook ingestion pipeline with Slack + Resend adapters
- [x] 12-03-PLAN.md — Generic OAuth callback + token refresh cron with distributed lock
- [x] 12-04-PLAN.md — Health monitoring service, tRPC procedures, provider cards UI
- [x] 12-05-PLAN.md — Settings page wiring, env vars, deprecation markers, e2e verification

### Phase 13: Contractor Portal Auth & Core Views
**Goal**: Contractors can securely access their own data through a dedicated portal without touching internal admin surfaces
**Depends on**: Phase 12
**Requirements**: PORT-01, PORT-02, PORT-03, PORT-04, PORT-05
**Success Criteria** (what must be TRUE):
  1. Contractor receives a magic link by email, clicks it, and lands in an org-scoped portal session
  2. Contractor can view their active contracts and terms (read-only) within the portal
  3. Contractor can upload an invoice through the portal and it enters the org's existing intake and approval pipeline
  4. Contractor can see the current status of each invoice (submitted, in review, approved, paid) and payment dates
  5. Contractor can view and download their own documents (contracts, NDAs, tax forms) from the portal
**Plans**: 5 plans

Plans:
- [x] 13-01-PLAN.md — DB schema (PortalSession, PortalMagicToken, PORTAL enum) + session and magic link services
- [x] 13-02-PLAN.md — Portal tRPC middleware (portalProcedure) + complete portal router with all endpoints
- [x] 13-03-PLAN.md — Portal layout, top bar navigation, login page, magic link verification, org picker
- [x] 13-04-PLAN.md — Overview dashboard, contracts list/detail, documents list, payments list
- [x] 13-05-PLAN.md — Invoice list/detail with 3-layer status tracking, submission form with PDF upload, success page

### Phase 14: Portal Self-Service & Branding
**Goal**: Contractors can manage their own profile and preferences, and the portal reflects the hiring org's brand
**Depends on**: Phase 13
**Requirements**: PORT-06, PORT-07, PORT-08
**Success Criteria** (what must be TRUE):
  1. Contractor can edit their bank details, tax info, and contact information, with changes routed through org approval before taking effect
  2. Contractor can configure which email notifications they receive from the portal
  3. Portal displays the org's logo, brand colors, and custom subdomain or path so contractors see a white-labeled experience
**Plans**: 5 plans

Plans:
- [x] 14-01-PLAN.md — DB models (ContractorChangeRequest, ContractorNotificationPreference), change request service, portal + admin API endpoints
- [x] 14-02-PLAN.md — Portal settings page with profile sections (inline edit, approval flow), notification preference toggles
- [x] 14-03-PLAN.md — Portal layout brand color injection, admin branding section (color picker + logo), change request diff cards in approvals
- [x] 14-04-PLAN.md — Custom subdomain routing: Organization.portalSubdomain field, Next.js middleware, admin config UI (gap closure)
- [x] 14-05-PLAN.md — Test stubs for Phase 14 API: change requests, notification prefs, branding (gap closure)

### Phase 15: E-Sign Integration
**Goal**: Contracts and NDAs can be sent for signature and signed electronically without leaving the platform
**Depends on**: Phase 12
**Requirements**: SIGN-01, SIGN-02, SIGN-03, SIGN-04
**Success Criteria** (what must be TRUE):
  1. User can send a contract or NDA for signature via DocuSign or Autenti from the contract detail page
  2. Signer can sign the document through an embedded or redirect flow without leaving the Contractor Ops context
  3. Multi-party signing works in defined order (e.g., contractor signs first, then org representative countersigns)
  4. Signed PDF is automatically saved to document management with a complete signature audit trail
**Plans**: 4 plans

Plans:
- [x] 15-01-PLAN.md — DB schema (SigningEnvelope, SigningRecipient, SigningEvent), ESignAdapter interface, ContractStatus extensions, Wave 0 test stubs
- [x] 15-02-PLAN.md — DocuSign + Autenti adapter implementations, adapter registration, provider-agnostic e-sign service
- [x] 15-03-PLAN.md — tRPC e-sign router, business orchestrator, webhook handler, signed PDF storage, CSP config
- [x] 15-04-PLAN.md — Send for Signature UI (dialog, progress bar, embedded modal, audit trail), portal pending signatures

### Phase 16: OCR Invoice Parsing
**Goal**: Uploaded invoice PDFs are automatically parsed so users spend less time on manual data entry
**Depends on**: Phase 12
**Requirements**: OCR-01, OCR-02, OCR-03
**Success Criteria** (what must be TRUE):
  1. When a PDF invoice is uploaded, the system auto-extracts NIP, invoice number, date, amount, and line items without user intervention
  2. Each extracted field displays a confidence score so the user knows which fields may need correction
  3. User can review OCR results in a side-by-side view (original PDF on left, extracted fields with edit-in-place on right) before accepting
**Plans**: 3 plans

Plans:
- [x] 16-01-PLAN.md — OcrExtraction DB schema, OcrAdapter interface, Claude Vision adapter, OCR service, tRPC router, QStash callback
- [x] 16-02-PLAN.md — PDF viewer (react-pdf), confidence badges, field wrappers, NIP validation, status bar, processing overlay, line items table
- [x] 16-03-PLAN.md — OcrReviewPanel split container, admin upload OCR trigger, portal form OCR pre-fill, human verification

### Phase 17: KSeF Integration
**Goal**: Invoices issued to the org's NIP are automatically pulled from the national KSeF system and flow into the existing matching and approval pipeline
**Depends on**: Phase 16
**Requirements**: KSEF-01, KSEF-02, KSEF-03, KSEF-04
**Success Criteria** (what must be TRUE):
  1. System auto-fetches invoices from KSeF for the org's NIP on a recurring schedule without manual triggering
  2. KSeF FA(3) XML is parsed into the invoice data model with all standard fields populated
  3. Each KSeF-sourced invoice displays its KSeF reference number and UPO receipt confirmation
  4. System detects and flags duplicates when the same invoice exists both from KSeF pull and manual upload
**Plans**: 3 plans

Plans:
- [x] 17-01-PLAN.md — KSeF Zod validators, FA(3) XML parser, KSeF API client, adapter registration
- [x] 17-02-PLAN.md — KSeF sync orchestrator, tRPC router, QStash cron route, duplicate detection, notifications
- [x] 17-03-PLAN.md — KSeF setup dialog, provider card, sync history, invoice badges, metadata section, duplicate banner

### Phase 18: Time Tracking
**Goal**: Contractors can report hours and managers can verify that invoiced amounts align with approved time
**Depends on**: Phase 13
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-04, TIME-05
**Success Criteria** (what must be TRUE):
  1. Contractor can log hours manually in the portal with date, hours, project/task, and description
  2. Manager can review submitted time entries and approve or reject them
  3. System imports time entries from Clockify via API and displays them alongside manual entries
  4. System imports Jira worklogs for issues assigned to a contractor and displays them as time entries
  5. When a contractor submits an invoice, the system compares approved hours against the invoice amount and flags deviations
**Plans**: 5 plans

Plans:
- [x] 18-00-PLAN.md — Wave 0 test stubs for all time tracking requirements (Nyquist compliance)
- [x] 18-01-PLAN.md — DB schema (Timesheet, TimeEntry), validators, time entry service with status machine
- [x] 18-02-PLAN.md — Clockify + Jira integration adapters, sync services for external time import
- [x] 18-03-PLAN.md — Portal time tRPC router, portal time page, weekly timesheet grid, single entry form, sync buttons
- [x] 18-04-PLAN.md — Admin time tRPC router, approval queue table, contractor timesheet review, rejection dialog
- [x] 18-05-PLAN.md — Time reconciliation service, invoice deviation flagging, reconciliation card + table UI

### Phase 19: Jira Integration
**Goal**: Workflow tasks and Jira issues stay synchronized so teams do not maintain two systems manually
**Depends on**: Phase 12
**Requirements**: JIRA-01, JIRA-02, JIRA-03, JIRA-04
**Success Criteria** (what must be TRUE):
  1. Admin can connect a Jira Cloud workspace via OAuth 2.0 from integration settings
  2. Workflow steps can auto-create Jira issues with configurable project and issue type mapping
  3. When a linked Jira issue changes status, the corresponding workflow task updates automatically (and vice versa via configurable mapping)
  4. Linked Jira issues appear as clickable chips on contractor profile and workflow detail views
**Plans**: 6 plans

Plans:
- [x] 19-00-PLAN.md — Wave 0 test stubs for all Jira backend services (Nyquist compliance)
- [x] 19-01-PLAN.md — JiraAdapter scope expansion, Zod validators, issue sync service, webhook handler, status mapping service
- [x] 19-02-PLAN.md — Jira tRPC router (11 procedures), webhook endpoint for bidirectional sync
- [x] 19-03-PLAN.md — Jira provider section, status mapping dialog, project mapping dialog in settings UI
- [x] 19-04-PLAN.md — JiraIssueChip, JiraActivitySummary, JiraTaskConfig, workflow view integration
- [x] 19-05-PLAN.md — Mount orphaned JiraTaskConfig in task template editor, harden siteUrl derivation (gap closure)

### Phase 20: Documentation & Calendar
**Goal**: External documentation and calendar deadlines are accessible from within Contractor Ops without context-switching
**Depends on**: Phase 12
**Requirements**: DOCS-01, DOCS-02, CAL-01, CAL-02
**Success Criteria** (what must be TRUE):
  1. User can attach a Notion or Confluence page link to any workflow step
  2. User can search and select Notion or Confluence pages from within Cmd+K
  3. Contract expiry dates, approval SLA deadlines, and payment due dates push to the user's Google or Outlook calendar
  4. Workflow steps can create calendar events (e.g., onboarding kickoff meeting) on the connected calendar
**Plans**: 6 plans

Plans:
- [x] 20-00-PLAN.md — Wave 0 test stubs for all Phase 20 requirements (Nyquist compliance)
- [x] 20-01-PLAN.md — DB schema (4 providers, userId), Zod validators, Notion/Confluence/Google Calendar/Outlook adapters
- [x] 20-02-PLAN.md — Doc link service, doc search proxy, tRPC docs router
- [x] 20-03-PLAN.md — Calendar event service, deadline sync watchers, tRPC calendar router
- [x] 20-04-PLAN.md — DocLinkChip, AttachDocDialog, DocLinksSection, Cmd+K Docs group
- [ ] 20-05-PLAN.md — My Calendar page, CalendarTaskConfig, CalendarEventConfigDialog, integrations tab updates

## Progress

**Execution Order:**
Phases execute in numeric order: 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20

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
| 12. Integration Foundation | v2.0 | 5/5 | Complete    | 2026-03-23 |
| 13. Contractor Portal Auth & Core Views | v2.0 | 5/5 | Complete    | 2026-03-23 |
| 14. Portal Self-Service & Branding | v2.0 | 5/5 | Complete    | 2026-03-23 |
| 15. E-Sign Integration | v2.0 | 4/4 | Complete    | 2026-03-27 |
| 16. OCR Invoice Parsing | v2.0 | 3/3 | Complete    | 2026-03-27 |
| 17. KSeF Integration | v2.0 | 3/3 | Complete    | 2026-03-27 |
| 18. Time Tracking | v2.0 | 6/6 | Complete    | 2026-03-28 |
| 19. Jira Integration | v2.0 | 6/6 | Complete    | 2026-03-29 |
| 20. Documentation & Calendar | v2.0 | 5/6 | In Progress|  |
