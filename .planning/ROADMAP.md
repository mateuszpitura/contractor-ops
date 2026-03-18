# Roadmap: Contractor Ops

## Overview

Contractor Ops delivers the full B2B contractor lifecycle as a multi-tenant SaaS: from organization setup and contractor onboarding, through contract management and workflow automation, to the core invoice-to-payment pipeline, and finally dashboard visibility and launch polish. The roadmap is structured in 10 phases that follow the natural dependency chain: foundation and auth first, then the entities everything references (contractors, contracts), then the workflow engine (primary differentiator), then the invoice pipeline and approval workflow (core value), then notifications, payments, reporting, and finally onboarding polish. Each phase delivers a coherent, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Auth** - Multi-tenant monorepo with auth, RBAC, tenant scoping, i18n framework, and app shell
- [ ] **Phase 2: Contractor Registry** - Full contractor CRUD with search, filters, bulk actions, profiles, and lifecycle management
- [ ] **Phase 3: Contracts & Documents** - Contract repository with versioning, expiry tracking, and secure document management
- [ ] **Phase 4: Workflow Engine** - Template builder with dependencies and conditional logic, execution engine with task management
- [ ] **Phase 5: Invoice Intake & Matching** - Invoice upload, email intake, auto-matching to contractors and contracts, duplicate detection
- [ ] **Phase 6: Approval Workflow** - Configurable approval chains with SLA timers, delegation, and full audit trail
- [ ] **Phase 7: Notifications & Slack** - In-app and email notifications for all critical events, Slack integration with inline actions
- [ ] **Phase 8: Payments** - Payment run creation, batch export, status tracking with idempotency controls
- [ ] **Phase 9: Dashboard & Reports** - KPI dashboard, spend and compliance reports, audit log viewer
- [ ] **Phase 10: Onboarding & Polish** - Data import wizard, product onboarding wizard, global search, and command palette

## Phase Details

### Phase 1: Foundation & Auth
**Goal**: Users can create organizations, invite team members with role-based access, and navigate a tenant-isolated app shell in Polish or English
**Depends on**: Nothing (first phase)
**Requirements**: ORG-01, ORG-02, ORG-03, ORG-04, ORG-05, ORG-06, ORG-07, I18N-01, I18N-02
**Success Criteria** (what must be TRUE):
  1. User can create a new organization and land on an authenticated dashboard shell
  2. Admin can invite users by email and invitees can accept and log in with their assigned role
  3. Admin can deactivate a user and that user is immediately locked out
  4. Each role sees only the navigation and actions permitted by their RBAC assignment
  5. All UI text, dates, numbers, and currency render correctly in both Polish and English
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Turborepo monorepo scaffold, complete Prisma 7 database schema, tenant isolation and soft-delete extensions
- [ ] 01-02-PLAN.md — Better Auth with organization plugin, 8-role RBAC, tRPC v11 with auth/tenant/RBAC middleware chain
- [ ] 01-03-PLAN.md — Auth screens, app shell with collapsible sidebar and top bar, org settings, user management UI
- [ ] 01-04-PLAN.md — next-intl i18n framework with Polish and English translations, locale-aware formatting

### Phase 2: Contractor Registry
**Goal**: Users can manage their full contractor roster with search, filtering, bulk operations, and detailed profiles showing lifecycle status and compliance health
**Depends on**: Phase 1
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CONT-07, CONT-08, CONT-09
**Success Criteria** (what must be TRUE):
  1. User can add a contractor with company details and billing information and see it in the registry
  2. User can search across contractor name, company, NIP, and email and get instant results
  3. User can filter contractors by status, owner, team, billing model, and compliance health
  4. User can perform bulk actions (assign owner, export, archive) on selected contractors
  5. User can view a contractor profile with tabs and see the compliance health score (green/yellow/red)
**Plans**: TBD

Plans:
- [ ] 02-01: Contractor CRUD and data model
- [ ] 02-02: Search, filters, and bulk actions
- [ ] 02-03: Contractor profiles and compliance health scoring

### Phase 3: Contracts & Documents
**Goal**: Users can manage contracts with full lifecycle tracking, version history, and expiry reminders, and securely upload and download documents linked to contractors and contracts
**Depends on**: Phase 2
**Requirements**: CNTR-01, CNTR-02, CNTR-03, CNTR-04, CNTR-05, DOCS-01, DOCS-02, DOCS-03, DOCS-04
**Success Criteria** (what must be TRUE):
  1. User can create a contract with metadata, upload documents, and see version history
  2. Contract status progresses through draft, active, expiring, expired, terminated, superseded
  3. System sends reminders at configurable intervals before contract expiration
  4. User can upload documents linked to contractors or contracts and download them via signed URLs
  5. System validates uploaded file types by content and scans for malware
**Plans**: TBD

Plans:
- [ ] 03-01: Contract CRUD, status tracking, and amendments
- [ ] 03-02: Document upload, storage (R2 presigned URLs), and security
- [ ] 03-03: Contract expiry reminders and document versioning

### Phase 4: Workflow Engine
**Goal**: Admins can build workflow templates with task dependencies and conditional logic, and users can run workflows that auto-assign tasks, track progress, and flag overdue items
**Depends on**: Phase 2
**Requirements**: WKFL-01, WKFL-02, WKFL-03, WKFL-04, WKFL-05, WKFL-06, WKFL-07, WKFL-08, WKFL-09, WKFL-10, ORG-09
**Success Criteria** (what must be TRUE):
  1. Admin can create a workflow template with ordered tasks, dependencies, conditional logic, and role-based assignment
  2. User can start a workflow for a contractor and see tasks auto-assigned to the correct people
  3. Assigned user can complete, skip, or reassign tasks and add comments and attachments
  4. System detects overdue tasks and sends notifications to assignees
  5. User can view workflow progress showing completed vs total tasks and timeline
**Plans**: TBD

Plans:
- [ ] 04-01: Workflow template builder (tasks, ordering, role assignment)
- [ ] 04-02: Task dependencies and conditional logic engine
- [ ] 04-03: Workflow execution engine and runtime task resolution
- [ ] 04-04: Task management UI (complete, skip, reassign, comment, attach)
- [ ] 04-05: Overdue detection and workflow progress tracking

### Phase 5: Invoice Intake & Matching
**Goal**: Invoices arrive via upload or email, get automatically matched to contractors and contracts, flagged for deviations and duplicates, and are ready for the approval pipeline
**Depends on**: Phase 3
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09, INV-10
**Success Criteria** (what must be TRUE):
  1. User can upload invoices via drag and drop and enter or edit invoice metadata
  2. System receives invoices via a dedicated per-org email inbox and processes attachments
  3. System auto-matches invoices to contractors by NIP and to active contracts with deviation detection
  4. System detects duplicate invoices by invoice number, contractor, and amount
  5. User can view invoice detail with linked contractor, contract, and embedded PDF viewer, and manually match unmatched invoices
**Plans**: TBD

Plans:
- [ ] 05-01: Invoice upload, metadata entry, and status flow
- [ ] 05-02: Email intake integration (Resend Inbound)
- [ ] 05-03: Auto-matching engine (NIP to contractor, contract matching, deviation flags)
- [ ] 05-04: Duplicate detection and manual matching UI
- [ ] 05-05: Invoice detail view with PDF viewer

### Phase 6: Approval Workflow
**Goal**: Invoices route through configurable multi-level approval chains with SLA enforcement, delegation, and a complete audit trail for every decision
**Depends on**: Phase 5
**Requirements**: APPR-01, APPR-02, APPR-03, APPR-04, APPR-05, APPR-06, APPR-07, APPR-08, APPR-09, ORG-08
**Success Criteria** (what must be TRUE):
  1. Admin can configure approval chain templates with 1-3 levels and amount thresholds
  2. Invoices route through the correct approval chain and approvers can approve, reject (with comment), request clarification, or delegate
  3. User can view their approval queue sorted by priority and bulk approve or reject items
  4. System tracks SLA timers per approval level with visual indicators and sends escalation notifications on breach
  5. Full audit trail records every approval decision with actor, timestamp, and comment
**Plans**: TBD

Plans:
- [ ] 06-01: Approval chain configuration and template management
- [ ] 06-02: Invoice routing and approval state machine (with chain snapshot)
- [ ] 06-03: Approver actions (approve, reject, clarify, delegate) and approval queue
- [ ] 06-04: SLA timers, escalation notifications, and bulk actions
- [ ] 06-05: Approval audit trail

### Phase 7: Notifications & Slack
**Goal**: Users receive timely in-app and email notifications for all critical events, and approvers can act on invoices directly from Slack
**Depends on**: Phase 6
**Requirements**: NOTF-01, NOTF-02, NOTF-03, SLCK-01, SLCK-02, SLCK-03
**Success Criteria** (what must be TRUE):
  1. User receives in-app notifications for approval requests, task assignments, overdue items, contract expiry, and invoice events
  2. User receives email notifications for the same events, configurable per user
  3. User can view, manage, and mark notifications as read
  4. Approver receives Slack DM with approve/reject action buttons and can act directly from Slack
  5. System sends Slack reminders for overdue approvals and expiring contracts
**Plans**: TBD

Plans:
- [ ] 07-01: Notification service and in-app notification center
- [ ] 07-02: Email notification delivery (Resend) with per-user preferences
- [ ] 07-03: Slack integration (DMs, interactive approve/reject, reminders)

### Phase 8: Payments
**Goal**: Finance users can batch approved invoices into payment runs, export bank-compatible files, and track payment status with idempotency safeguards
**Depends on**: Phase 6
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06
**Success Criteria** (what must be TRUE):
  1. Finance user can view all approved invoices ready for payment
  2. Finance user can select invoices for a payment run by currency, due date, or manual pick
  3. Finance user can export a payment run as CSV or bank file and mark items as paid or failed
  4. System prevents duplicate payment runs with idempotency controls and tracks payment reference IDs
  5. User can view payment run history with summary totals by currency
**Plans**: TBD

Plans:
- [ ] 08-01: Payment run creation and invoice selection
- [ ] 08-02: Bank file export (CSV/MT940) and payment status tracking
- [ ] 08-03: Idempotency controls and payment run history

### Phase 9: Dashboard & Reports
**Goal**: Users land on a dashboard with real-time KPIs, spend trends, and actionable widgets, and can generate filterable reports on spend, compliance, and contract status
**Depends on**: Phase 8
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, ORG-10
**Success Criteria** (what must be TRUE):
  1. User sees KPI cards for active contractors, pending approvals, ready-to-pay total, expiring contracts, and open tasks
  2. User sees a month-over-month spend chart and upcoming deadlines
  3. User can view spend reports by contractor, team, or project with date range filters and CSV export
  4. User can view reports for expiring contracts, overdue invoices, and compliance gaps
  5. Admin can view a searchable, filterable, exportable audit log of all critical actions
**Plans**: TBD

Plans:
- [ ] 09-01: Dashboard KPI cards and spend chart
- [ ] 09-02: Dashboard widgets (deadlines, approval queue, activity feed)
- [ ] 09-03: Spend reports (by contractor, team, project) with filters and export
- [ ] 09-04: Operational reports (expiring contracts, overdue invoices, compliance gaps)
- [ ] 09-05: Audit log viewer

### Phase 10: Onboarding & Polish
**Goal**: New organizations get a guided setup experience, existing spreadsheet users can import their data, and power users can navigate the entire app via search and command palette
**Depends on**: Phase 9
**Requirements**: IMP-01, IMP-02, IMP-03, ONBD-01, ONBD-02, SRCH-01, SRCH-02
**Success Criteria** (what must be TRUE):
  1. User can import contractors and contracts from CSV/XLSX with column mapping, validation, and preview
  2. New organization sees a guided setup wizard that walks through org details, team invites, contractor import, approval config, and Slack connection
  3. Every empty-state view shows a contextual call-to-action guiding the user to the next step
  4. User can search across contractors, contracts, and invoices from a global search bar
  5. User can open a command palette (Cmd+K) for search, quick actions, and navigation
**Plans**: TBD

Plans:
- [ ] 10-01: Data import wizard (CSV/XLSX) for contractors and contracts
- [ ] 10-02: Product onboarding wizard and empty states
- [ ] 10-03: Global search and command palette (Cmd+K)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 3/4 | In Progress|  |
| 2. Contractor Registry | 0/3 | Not started | - |
| 3. Contracts & Documents | 0/3 | Not started | - |
| 4. Workflow Engine | 0/5 | Not started | - |
| 5. Invoice Intake & Matching | 0/5 | Not started | - |
| 6. Approval Workflow | 0/5 | Not started | - |
| 7. Notifications & Slack | 0/3 | Not started | - |
| 8. Payments | 0/3 | Not started | - |
| 9. Dashboard & Reports | 0/5 | Not started | - |
| 10. Onboarding & Polish | 0/3 | Not started | - |
