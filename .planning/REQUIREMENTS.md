# Requirements: Contractor Ops

**Defined:** 2026-04-01
**Core Value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail.

## v3.0 Requirements

Requirements for v3.0 Enterprise & Monetization milestone. Each maps to roadmap phases.

### Linear Integration

- [x] **LIN-01**: User can connect Linear workspace via OAuth 2.0 with refresh token support
- [x] **LIN-02**: Admin can map Linear workflow states to internal task statuses per team
- [x] **LIN-03**: Workflow task with Linear enabled auto-creates Linear issue with team, title, description, and assignee
- [x] **LIN-04**: Status changes in Linear sync to linked workflow task via webhooks (with loop prevention)
- [x] **LIN-05**: Status changes on workflow task sync to Linear issue via GraphQL mutation
- [x] **LIN-06**: Linked Linear issue displays as clickable chip with status badge on workflow task view

### Teams Integration

- [ ] **TEAM-01**: Admin can connect Teams workspace via Azure AD OAuth with bot registration
- [ ] **TEAM-02**: Admin can configure which Teams channel receives which notification types
- [ ] **TEAM-03**: System sends activity alerts to configured Teams channels via Adaptive Cards
- [ ] **TEAM-04**: Manager can approve or reject invoices directly from Teams Adaptive Card actions
- [ ] **TEAM-05**: System sends approval reminder DMs to approvers with overdue items via proactive messaging
- [ ] **TEAM-06**: Teams bot stores ConversationReferences for proactive messaging per user

### Google Workspace

- [ ] **GOOG-01**: Admin can connect Google Workspace with Admin SDK Directory API scopes via OAuth
- [ ] **GOOG-02**: User can preview Google Workspace users with name, email, department, and org unit before importing
- [ ] **GOOG-03**: Admin can selectively import Google Workspace users as org members with role assignment
- [ ] **GOOG-04**: Admin can map Google Workspace groups to internal RBAC roles during import
- [ ] **GOOG-05**: System periodically syncs Google Workspace directory to detect new hires and flag departures (no auto-delete)

### Intelligent Onboarding

- [ ] **ONBD-01**: User sees "Where do you manage your team?" source selection during onboarding with connected tool options
- [ ] **ONBD-02**: System imports team members from connected tools (Jira, Linear, Google Workspace, Slack) with email-based dedup
- [ ] **ONBD-03**: System imports projects and statuses from PM tools (Jira, Linear) to pre-configure workflow templates
- [ ] **ONBD-04**: User can preview imported data with diff indicators (new/duplicate/conflict) and batch confirm, skip, or edit
- [ ] **ONBD-05**: Import runs async with progress tracking, and user can retry failed items without re-importing

### Equipment & Shipment Tracking

- [x] **EQUIP-01**: Admin can manage equipment registry (CRUD) with type, serial number, status, and assigned contractor
- [x] **EQUIP-02**: Admin can assign/unassign equipment to contractors with assignment history and audit trail
- [ ] **EQUIP-03**: Contractor profile shows Equipment tab with assigned items and shipment status
- [x] **EQUIP-04**: Admin can create shipment for equipment with carrier, tracking number, and expected delivery (manual entry)
- [ ] **EQUIP-05**: System integrates with InPost ShipX API for shipment creation, Parcel Locker selection, and auto-status tracking
- [ ] **EQUIP-06**: System integrates with DPD API for shipment creation, label generation, and status tracking
- [ ] **EQUIP-07**: System integrates with UPS API for shipment creation and status tracking
- [ ] **EQUIP-08**: Shipment status displays as timeline on equipment detail and contractor profile with unified status model
- [x] **EQUIP-09**: Onboarding workflow task "Ship equipment" auto-creates shipment, offboarding task "Return equipment" triggers return request
- [x] **EQUIP-10**: Workflow task auto-completes when shipment reaches target status (e.g., "delivered")
- [ ] **EQUIP-11**: Contractor can initiate equipment return via portal and receive shipping label

### Stripe Billing

- [x] **BILL-01**: System manages subscription tiers (Starter/Pro/Enterprise) with flat + per-seat pricing via Stripe
- [x] **BILL-02**: Admin can upgrade or downgrade plan with proration preview
- [x] **BILL-03**: New org starts with free trial (1 org / 2 users, limited features) with trial-ending notifications
- [x] **BILL-04**: System meters AI/OCR usage per org via Stripe Meters and reports events on each OCR call
- [x] **BILL-05**: Each plan tier includes N free OCR credits/month with configurable auto-renewal top-up bundles
- [x] **BILL-06**: System hard-blocks OCR when credits exhausted (with upgrade/top-up prompt)
- [x] **BILL-07**: Stripe webhook events drive internal subscription state with database-level idempotency
- [x] **BILL-08**: Admin can access Stripe-hosted billing portal for payment method, invoices, and cancellation
- [ ] **BILL-09**: Middleware gates features by org's active subscription tier with graceful upgrade prompts
- [ ] **BILL-10**: Admin sees usage dashboard with current plan, seat count, OCR credits used/remaining, and billing date

## Future Requirements

Deferred to v4+. Tracked but not in current roadmap.

### Identity & Provisioning

- **SCIM-01**: System supports SCIM provisioning from Google Workspace for automatic user lifecycle management

### Payments

- **PAY-01**: Contractor payments via Stripe Connect with KYC and per-transaction processing

### Shipping

- **SHIP-01**: Multi-carrier rate comparison with real-time pricing from InPost, DPD, and UPS

### Communication

- **COMM-01**: Full Teams messaging relay between contractors and managers

## Out of Scope

| Feature | Reason |
|---------|--------|
| SCIM provisioning | Full identity lifecycle protocol, overkill at 10-200 employee scale — directory import covers 95% |
| Stripe Connect for contractor payments | Polish B2B uses bank transfers; Stripe handles platform billing only |
| Multi-carrier rate comparison | Shipping platform territory (Shippo/EasyPost) — default to org's preferred carrier |
| Teams as full messaging layer | Notifications and approvals only — message relay is Teams' job |
| Full asset management system | Track contractor-assigned equipment only — Snipe-IT/AssetTiger for full inventory |
| Build own billing system | Stripe fee (2.9%) trivial at current scale — PCI-DSS compliance alone costs 6+ months |
| Linear/Jira merged time tracking | Linear has no native time tracking — import from Clockify which works with both |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LIN-01 | Phase 29 | Complete |
| LIN-02 | Phase 29 | Complete |
| LIN-03 | Phase 29 | Complete |
| LIN-04 | Phase 29 | Complete |
| LIN-05 | Phase 29 | Complete |
| LIN-06 | Phase 29 | Complete |
| TEAM-01 | Phase 32 | Pending |
| TEAM-02 | Phase 32 | Pending |
| TEAM-03 | Phase 32 | Pending |
| TEAM-04 | Phase 32 | Pending |
| TEAM-05 | Phase 32 | Pending |
| TEAM-06 | Phase 32 | Pending |
| GOOG-01 | Phase 31 | Pending |
| GOOG-02 | Phase 31 | Pending |
| GOOG-03 | Phase 31 | Pending |
| GOOG-04 | Phase 31 | Pending |
| GOOG-05 | Phase 31 | Pending |
| ONBD-01 | Phase 34 | Pending |
| ONBD-02 | Phase 34 | Pending |
| ONBD-03 | Phase 34 | Pending |
| ONBD-04 | Phase 34 | Pending |
| ONBD-05 | Phase 34 | Pending |
| EQUIP-01 | Phase 30 | Complete |
| EQUIP-02 | Phase 30 | Complete |
| EQUIP-03 | Phase 30 | Pending |
| EQUIP-04 | Phase 30 | Complete |
| EQUIP-05 | Phase 33 | Pending |
| EQUIP-06 | Phase 35 | Pending |
| EQUIP-07 | Phase 35 | Pending |
| EQUIP-08 | Phase 30 | Pending |
| EQUIP-09 | Phase 30 | Complete |
| EQUIP-10 | Phase 30 | Complete |
| EQUIP-11 | Phase 33 | Pending |
| BILL-01 | Phase 28 | Complete |
| BILL-02 | Phase 28 | Complete |
| BILL-03 | Phase 28 | Complete |
| BILL-04 | Phase 28 | Complete |
| BILL-05 | Phase 28 | Complete |
| BILL-06 | Phase 28 | Complete |
| BILL-07 | Phase 28 | Complete |
| BILL-08 | Phase 28 | Complete |
| BILL-09 | Phase 35 | Pending |
| BILL-10 | Phase 35 | Pending |

**Coverage:**
- v3.0 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after roadmap creation*
