# Requirements: Contractor Ops

**Defined:** 2026-03-18
**Core Value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Organization & Access

- [x] **ORG-01**: User can create a new organization with name, country, default currency, and timezone
- [ ] **ORG-02**: Admin can configure organization settings (branding, fiscal year, notification defaults)
- [x] **ORG-03**: Admin can invite users by email with a specific role assignment
- [x] **ORG-04**: Invited user can accept invitation and create their account
- [x] **ORG-05**: Admin can deactivate a user, immediately revoking their access
- [x] **ORG-06**: System enforces RBAC with 8 roles: admin, finance admin, ops manager, team manager, legal/compliance viewer, IT admin, external accountant, readonly
- [x] **ORG-07**: All data access is scoped to the user's organization with no cross-tenant leakage
- [ ] **ORG-08**: Admin can configure approval chain templates (default chains, amount thresholds)
- [ ] **ORG-09**: Admin can manage workflow templates (create, edit, activate/deactivate)
- [ ] **ORG-10**: Admin can view searchable, filterable, exportable audit log of all critical actions

### Contractors

- [ ] **CONT-01**: User can add a contractor with company details (legal name, NIP, VAT-EU, address, type)
- [ ] **CONT-02**: User can set contractor billing details (bank account, currency, billing model, default rate)
- [ ] **CONT-03**: User can assign a contractor to an internal owner, team, project, and cost center
- [ ] **CONT-04**: User can search contractors with full-text search across name, company, NIP, email
- [ ] **CONT-05**: User can filter contractors by status, owner, team, billing model, contract end date, compliance health
- [ ] **CONT-06**: User can perform bulk actions on contractors (assign owner, export, archive, launch workflow)
- [ ] **CONT-07**: User can view contractor profile with tabs: overview, contracts, documents, workflows, invoices, payments, activity, compliance
- [ ] **CONT-08**: System calculates and displays compliance health score (green/yellow/red) based on required documents, contract status, and overdue tasks
- [ ] **CONT-09**: Contractor status follows lifecycle: draft → onboarding → active → offboarding → inactive → archived

### Contracts & Documents

- [ ] **CNTR-01**: User can create a contract with metadata (type, dates, notice period, rate, currency, billing cycle, payment terms)
- [ ] **CNTR-02**: User can upload contract documents (PDF, DOCX) with versioning
- [ ] **CNTR-03**: System tracks contract statuses: draft → active → expiring → expired → terminated → superseded
- [ ] **CNTR-04**: System sends configurable reminders before contract expiration (30/60/90 days)
- [ ] **CNTR-05**: User can add amendments to existing contracts
- [ ] **DOCS-01**: User can upload documents and link them to contractors and/or contracts
- [ ] **DOCS-02**: User can download documents via short-lived signed URLs
- [ ] **DOCS-03**: System validates file type (MIME content) and scans uploads for malware
- [ ] **DOCS-04**: System tracks document versions and maintains upload history

### Workflow Engine

- [ ] **WKFL-01**: Admin can create workflow templates (onboarding, offboarding, document collection, custom)
- [ ] **WKFL-02**: Admin can define tasks within templates with: title, type, description, due date offset, assignee role, required flag
- [ ] **WKFL-03**: Admin can define task dependencies (task B blocked until task A completes)
- [ ] **WKFL-04**: Admin can add conditional logic (e.g., include task only if contractor type = JDG)
- [ ] **WKFL-05**: User can start a workflow run from a template for a specific contractor
- [ ] **WKFL-06**: System resolves role-based task assignments to specific users at runtime
- [ ] **WKFL-07**: Assigned user can complete, skip, or reassign tasks
- [ ] **WKFL-08**: User can add comments and attachments to workflow tasks
- [ ] **WKFL-09**: System detects and flags overdue tasks with notifications
- [ ] **WKFL-10**: User can view workflow progress (X/Y tasks complete, timeline)

### Invoice Pipeline

- [ ] **INV-01**: User can upload invoices via drag & drop (single or multi-file)
- [ ] **INV-02**: System receives invoices via dedicated email inbox per organization
- [ ] **INV-03**: User can enter/edit invoice metadata (number, dates, amounts, NIP, bank account, billing period)
- [ ] **INV-04**: System auto-matches invoices to contractors by NIP
- [ ] **INV-05**: System auto-matches invoices to active contracts and calculates expected vs actual amount
- [ ] **INV-06**: System flags deviations above configurable threshold (amount, missing contract, expired contract)
- [ ] **INV-07**: System detects duplicate invoices by invoice number + contractor + amount
- [ ] **INV-08**: Invoice follows status flow: received → matched/unmatched/discrepancy → pending approval → approved/rejected → ready for payment → paid
- [ ] **INV-09**: User can manually match unmatched invoices to a contractor and contract
- [ ] **INV-10**: User can view invoice detail with linked contractor, contract, approval chain, comments, and embedded PDF viewer

### Approvals

- [ ] **APPR-01**: System routes invoices through configurable approval chains (1-3 levels)
- [ ] **APPR-02**: Approver can approve, reject (with mandatory comment), request clarification, or delegate
- [ ] **APPR-03**: User can view their personal approval queue sorted by priority (overdue first, then by due date)
- [ ] **APPR-04**: User can bulk approve/reject selected items from the queue
- [ ] **APPR-05**: System tracks SLA timers per approval level with visual indicators (green/yellow/red)
- [ ] **APPR-06**: System sends escalation notifications when SLA is breached
- [ ] **APPR-07**: Approver can delegate to another user when absent
- [ ] **APPR-08**: System snapshots the approval chain at submission time (chain changes don't affect in-flight approvals)
- [ ] **APPR-09**: Full audit trail for every approval decision with actor, timestamp, and comment

### Payments

- [ ] **PAY-01**: Finance user can view all approved invoices ready for payment
- [ ] **PAY-02**: Finance user can select invoices for a payment run (all, by currency, by due date, manual pick)
- [ ] **PAY-03**: Finance user can export payment run as CSV or bank file format
- [ ] **PAY-04**: Finance user can mark individual items or entire run as paid/failed
- [ ] **PAY-05**: System tracks payment reference IDs and prevents duplicate payment runs (idempotency)
- [ ] **PAY-06**: User can view payment run history with summary (total, count, by currency)

### Notifications & Integrations

- [ ] **NOTF-01**: System sends in-app notifications for: approval requests, approval decisions, task assignments, task overdue, contract expiring, invoice received
- [ ] **NOTF-02**: System sends email notifications for the same events (configurable per user)
- [ ] **NOTF-03**: User can view and manage their notifications (mark read, mark all read)
- [ ] **SLCK-01**: System sends Slack DMs to approvers with approve/reject action buttons
- [ ] **SLCK-02**: Approver can approve/reject invoices directly from Slack
- [ ] **SLCK-03**: System sends Slack reminders for overdue approvals and expiring contracts

### Dashboard & Reports

- [ ] **DASH-01**: User sees KPI cards: active contractors, invoices awaiting approval, ready-to-pay total, contracts expiring in 30 days, open tasks
- [ ] **DASH-02**: User sees month-over-month spend chart
- [ ] **DASH-03**: User sees upcoming deadlines (contract expirations, overdue tasks, due invoices)
- [ ] **DASH-04**: User sees approval queue widget (top pending approvals)
- [ ] **DASH-05**: User sees recent activity feed
- [ ] **RPT-01**: User can view spend report by contractor (trend + totals)
- [ ] **RPT-02**: User can view spend report by team/project/cost center
- [ ] **RPT-03**: User can view contracts expiring in 30/60/90 days
- [ ] **RPT-04**: User can view overdue invoices report
- [ ] **RPT-05**: User can view compliance gaps report (missing documents)
- [ ] **RPT-06**: User can filter reports by date range and export to CSV

### Onboarding & Polish

- [ ] **IMP-01**: User can import contractors from CSV/XLSX with column mapping wizard
- [ ] **IMP-02**: System validates imported data and shows preview before committing
- [ ] **IMP-03**: User can import contracts from CSV/XLSX with basic metadata
- [ ] **I18N-01**: All UI strings are externalized and available in Polish and English
- [ ] **I18N-02**: Dates, numbers, and currency are formatted according to user locale
- [ ] **ONBD-01**: New org sees guided setup wizard (org details → invite team → add/import contractor → configure approvals → connect Slack)
- [ ] **ONBD-02**: Empty states show contextual call-to-action on every view
- [ ] **SRCH-01**: User can search across contractors, contracts, invoices from global search bar
- [ ] **SRCH-02**: User can use command palette (Cmd+K) for search + quick actions + navigation

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Contractor Portal

- **PORTAL-01**: Contractor can view their own profile, contracts, and documents
- **PORTAL-02**: Contractor can submit invoices through self-service portal
- **PORTAL-03**: Contractor can view payment status for their invoices

### Advanced Integrations

- **KSEF-01**: System pulls invoices from KSeF API by NIP
- **KSEF-02**: System extracts structured data from KSeF XML
- **ESIGN-01**: User can send contracts for e-signature (Autenti/DocuSign)
- **ESIGN-02**: Signed documents auto-attach to contractor record

### Advanced Features

- **ADV-01**: OCR/AI metadata extraction from uploaded invoice PDFs
- **ADV-02**: Multi-currency support (EUR, USD) with exchange rate awareness
- **ADV-03**: Custom fields per contractor, contract, and invoice
- **ADV-04**: Advanced reporting with drill-down and PDF export

## Out of Scope

| Feature | Reason |
|---------|--------|
| Payroll for employees | Not an HR tool — contractor ops only |
| EOR/AOR | Local contractors only, not employer of record |
| Performance reviews / recruiting | Not HR scope |
| Contractor marketplace / directory | Completely different product, dilutes focus |
| Full accounting suite | Coordination layer, not accounting replacement |
| Notion/Jira replacement | Execution layer, not knowledge base or project management |
| Mobile native app | Desktop-first, responsive web for approval on mobile |
| Real-time WebSockets | Polling with TanStack Query sufficient for 5-50 contractor orgs |
| SSO/SCIM | v3 — target market rarely requires it |
| Open banking / payment initiation | v2+ — bank file export sufficient for v1 |
| Public API + webhooks | v2 — no external integration demand at launch |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORG-01 | Phase 1 | Complete |
| ORG-02 | Phase 1 | Pending |
| ORG-03 | Phase 1 | Complete |
| ORG-04 | Phase 1 | Complete |
| ORG-05 | Phase 1 | Complete |
| ORG-06 | Phase 1 | Complete |
| ORG-07 | Phase 1 | Complete |
| ORG-08 | Phase 6 | Pending |
| ORG-09 | Phase 4 | Pending |
| ORG-10 | Phase 9 | Pending |
| CONT-01 | Phase 2 | Pending |
| CONT-02 | Phase 2 | Pending |
| CONT-03 | Phase 2 | Pending |
| CONT-04 | Phase 2 | Pending |
| CONT-05 | Phase 2 | Pending |
| CONT-06 | Phase 2 | Pending |
| CONT-07 | Phase 2 | Pending |
| CONT-08 | Phase 2 | Pending |
| CONT-09 | Phase 2 | Pending |
| CNTR-01 | Phase 3 | Pending |
| CNTR-02 | Phase 3 | Pending |
| CNTR-03 | Phase 3 | Pending |
| CNTR-04 | Phase 3 | Pending |
| CNTR-05 | Phase 3 | Pending |
| DOCS-01 | Phase 3 | Pending |
| DOCS-02 | Phase 3 | Pending |
| DOCS-03 | Phase 3 | Pending |
| DOCS-04 | Phase 3 | Pending |
| WKFL-01 | Phase 4 | Pending |
| WKFL-02 | Phase 4 | Pending |
| WKFL-03 | Phase 4 | Pending |
| WKFL-04 | Phase 4 | Pending |
| WKFL-05 | Phase 4 | Pending |
| WKFL-06 | Phase 4 | Pending |
| WKFL-07 | Phase 4 | Pending |
| WKFL-08 | Phase 4 | Pending |
| WKFL-09 | Phase 4 | Pending |
| WKFL-10 | Phase 4 | Pending |
| INV-01 | Phase 5 | Pending |
| INV-02 | Phase 5 | Pending |
| INV-03 | Phase 5 | Pending |
| INV-04 | Phase 5 | Pending |
| INV-05 | Phase 5 | Pending |
| INV-06 | Phase 5 | Pending |
| INV-07 | Phase 5 | Pending |
| INV-08 | Phase 5 | Pending |
| INV-09 | Phase 5 | Pending |
| INV-10 | Phase 5 | Pending |
| APPR-01 | Phase 6 | Pending |
| APPR-02 | Phase 6 | Pending |
| APPR-03 | Phase 6 | Pending |
| APPR-04 | Phase 6 | Pending |
| APPR-05 | Phase 6 | Pending |
| APPR-06 | Phase 6 | Pending |
| APPR-07 | Phase 6 | Pending |
| APPR-08 | Phase 6 | Pending |
| APPR-09 | Phase 6 | Pending |
| PAY-01 | Phase 8 | Pending |
| PAY-02 | Phase 8 | Pending |
| PAY-03 | Phase 8 | Pending |
| PAY-04 | Phase 8 | Pending |
| PAY-05 | Phase 8 | Pending |
| PAY-06 | Phase 8 | Pending |
| NOTF-01 | Phase 7 | Pending |
| NOTF-02 | Phase 7 | Pending |
| NOTF-03 | Phase 7 | Pending |
| SLCK-01 | Phase 7 | Pending |
| SLCK-02 | Phase 7 | Pending |
| SLCK-03 | Phase 7 | Pending |
| DASH-01 | Phase 9 | Pending |
| DASH-02 | Phase 9 | Pending |
| DASH-03 | Phase 9 | Pending |
| DASH-04 | Phase 9 | Pending |
| DASH-05 | Phase 9 | Pending |
| RPT-01 | Phase 9 | Pending |
| RPT-02 | Phase 9 | Pending |
| RPT-03 | Phase 9 | Pending |
| RPT-04 | Phase 9 | Pending |
| RPT-05 | Phase 9 | Pending |
| RPT-06 | Phase 9 | Pending |
| IMP-01 | Phase 10 | Pending |
| IMP-02 | Phase 10 | Pending |
| IMP-03 | Phase 10 | Pending |
| I18N-01 | Phase 1 | Pending |
| I18N-02 | Phase 1 | Pending |
| ONBD-01 | Phase 10 | Pending |
| ONBD-02 | Phase 10 | Pending |
| SRCH-01 | Phase 10 | Pending |
| SRCH-02 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 89 total
- Mapped to phases: 89
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation*
