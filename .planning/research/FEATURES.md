# Feature Research

**Domain:** B2B Contractor Operations Platform (EU/Poland-first)
**Researched:** 2026-03-18
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete. These are derived from what Deel, Remote, Rippling, SaldeoSMART, and Faktura.pl all offer as baseline, plus what Polish ops/finance teams currently do in spreadsheets.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Contractor registry with CRUD** | Every competitor has a contractor database. Without it, there's nothing to manage. | LOW | Search, filter, bulk actions. NIP-based lookup against GUS/REGON is table stakes in Poland. |
| **Contractor profiles with activity history** | Users need a single place to see everything about a contractor: contracts, invoices, payments, documents. Deel/Remote both have this. | MEDIUM | Tabbed view: overview, contracts, documents, invoices, payments, activity log. |
| **Contract repository with status tracking** | Contracts are the legal backbone. Deel auto-generates them; at minimum you must store, version, and track expiry. | MEDIUM | Upload, metadata, statuses (draft/active/expiring/expired/terminated), expiry reminders, amendment tracking. |
| **Document upload and management** | Every platform stores documents (contracts, NDAs, tax forms). Users expect drag-and-drop upload linked to contractor/contract. | MEDIUM | Signed URL downloads, virus scanning, file type validation. Link documents to contractors and contracts. |
| **Invoice intake (manual upload + email)** | This is the core flow. SaldeoSMART does email intake + OCR. Even Excel workflows have a "send invoice to this email" step. | MEDIUM | Drag-and-drop upload, dedicated email inbox per org, attachment parsing, sender matching, dedup. |
| **Invoice-to-contractor matching** | Without matching, invoices are just files. Every invoice tool matches to vendor/contractor. SaldeoSMART does this via NIP + OCR. | MEDIUM | Auto-match by NIP to contractor, then to active contract. Flag expected vs actual amount deviations. |
| **Duplicate invoice detection** | Standard AP feature. Every invoice approval tool (ApprovalMax, Rillion, Tipalti) has this. | LOW | Match on invoice number + contractor + amount + date range. |
| **Approval workflow (configurable)** | Multi-level approval is table stakes for any invoice/AP tool. ApprovalMax, Rillion, and even SaldeoSMART have this. | HIGH | 1-3 level chains, role-based routing, approve/reject/request-clarification, mandatory reject comments, delegation for absent approvers. |
| **Payment batch export** | Companies pay invoices in batches via bank transfer. Export to CSV/bank file format is the minimum. Every Polish finance team expects this. | MEDIUM | Select approved invoices, generate bank-compatible CSV/MT940, mark as paid/failed, idempotency. |
| **Dashboard with KPIs** | Every B2B SaaS has a dashboard. Users expect at-a-glance: pending approvals, upcoming deadlines, spend overview. | MEDIUM | KPI cards, spend chart, approval queue widget, upcoming contract expirations, overdue invoices. |
| **Multi-tenant org setup** | Standard for B2B SaaS. Each customer is an isolated tenant with their own data, settings, branding. | MEDIUM | Org profile, timezone, currency, branding. All queries scoped by organization_id. |
| **RBAC (role-based access control)** | Every B2B SaaS competitor has roles. Finance sees invoices, managers approve, admins configure. Non-negotiable. | MEDIUM | Tenant-scoped roles: admin, finance, ops, manager, readonly. Permissions enforced at API level, not just UI. |
| **User invite flow** | Teams need to add colleagues. Email invite with role assignment is the standard pattern. | LOW | Invite by email, assign role, accept flow, manage active users. |
| **Notifications (in-app + email)** | Users expect to be notified about approvals needed, tasks due, contract expiry. Every workflow tool has this. | MEDIUM | Configurable per event type. In-app bell + email digest. |
| **Audit log** | Compliance requirement for any financial tool. Every action on invoices, approvals, payments must be traceable. | MEDIUM | Immutable log of all critical actions with actor, timestamp, before/after state. Filterable and exportable. |
| **Basic reporting** | Finance teams need spend reports. Even Excel workflows produce these. | MEDIUM | Spend by contractor, spend by period, expiring contracts, overdue invoices, compliance gaps. |
| **Data import (CSV/XLSX)** | Migration from spreadsheets is the primary onboarding path. Without import, adoption friction is too high. | MEDIUM | Wizard with validation, preview, error handling for contractors and contracts. |
| **i18n (Polish + English)** | Polish-first product targeting Polish companies. English needed for international contractors. Non-negotiable. | LOW | Framework from day 1. All UI strings externalized. Date/number formatting locale-aware. |

### Differentiators (Competitive Advantage)

Features that set the product apart from Deel (cross-border focus), SaldeoSMART (accounting-first), Faktura.pl (invoice-only), and Excel/Notion chaos.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Workflow/checklist engine (onboarding + offboarding)** | No competitor in the Polish market has configurable onboarding/offboarding workflows for contractors. Deel has rigid templates. This is where "ops platform" beats "invoice tool." | HIGH | Template builder with task dependencies, role-based assignment, conditional logic. Execute workflows with progress tracking, overdue detection, comments, attachments. Reusable templates. |
| **End-to-end contractor lifecycle in one system** | Deel is cross-border EOR ($29-49/contractor). SaldeoSMART is accounting. Faktura.pl is invoicing. Nobody owns the full local B2B contractor lifecycle: onboard -> contract -> invoice -> approve -> pay -> offboard. | HIGH | The integration of all modules into a single coherent flow is the differentiator, not any single module. |
| **Invoice-contract matching with deviation detection** | SaldeoSMART matches invoices to accounting entries. Contractor Ops matches invoices to *contracts* with expected amounts, flagging deviations before approval. This catches billing errors early. | MEDIUM | Auto-match invoice to contract, compare expected vs actual amount, flag deviations with configurable thresholds, surface in approval UI. |
| **Slack integration with inline approval** | Polish tech companies live in Slack. Approve/reject invoices without opening the app. Deel has Slack notifications but no inline actions. | MEDIUM | Approval notifications with approve/reject buttons directly in Slack. Task reminders. Activity alerts. |
| **SLA timers on approvals** | Most tools track approval status but not *speed*. SLA timers surface bottlenecks: "This invoice has been pending 5 days, SLA is 3 days." | LOW | Configurable SLA per approval level. Visual indicators (green/yellow/red). Escalation notifications. |
| **Compliance health scoring** | No competitor shows an at-a-glance "compliance health" for each contractor (valid contract? Required docs uploaded? NIP verified?). | MEDIUM | Per-contractor compliance checklist. Auto-calculated health score. Dashboard widget showing gaps across all contractors. |
| **Global search + command palette (Cmd+K)** | Power-user feature. Most Polish B2B tools have basic search. A command palette (Linear/Notion style) makes navigation instant. | MEDIUM | Search across contractors, contracts, invoices. Quick actions: create invoice, start onboarding, navigate to contractor. |
| **Product onboarding wizard** | SaldeoSMART and Faktura.pl have minimal onboarding. A guided setup wizard (import data, configure approvals, invite team) reduces time-to-value dramatically. | MEDIUM | Step-by-step wizard: org setup, import contractors, configure approval chain, invite team. Empty states with CTAs. In-app checklist. |
| **Approval delegation and backup approvers** | Best practice from AP tools (Rillion, ApprovalMax): when an approver is absent, invoices should not get stuck. Auto-delegate or assign backup. | LOW | Per-approver backup configuration. Manual delegation. Auto-escalation after SLA breach. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a v1 product targeting 5-50 contractor companies.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **OCR / AI invoice parsing** | "SaldeoSMART has OCR!" Seems like magic -- upload PDF, auto-extract all fields. | OCR accuracy for Polish invoices varies wildly (60-95%). Requires training data, error correction UI, and ongoing maintenance. Massive scope creep for v1. KSeF structured XML will make OCR largely unnecessary. | Manual upload with structured form entry in v1. KSeF XML intake in v1.5 gives 100% accurate structured data for free. |
| **KSeF native integration** | Mandatory from April 2026. Seems urgent. | KSeF FA(3) schema has 300+ fields. Integration requires XML generation/parsing, authentication (qualified seal or token), middleware layer. Grace period until Dec 2026 means no penalties. | Email/upload intake in v1 with manual validation. KSeF integration in v1.5 when the API stabilizes and grace period provides runway. |
| **Contractor self-service portal** | Contractors want to submit invoices, view payment status, update their info. | Doubles the surface area: separate auth, separate UI, separate permissions model. Support burden. Security implications of external access. | Internal-only in v1. Contractor portal in v1.5 once the internal flow is validated. |
| **E-sign integration (DocuSign/Autenti)** | "We want contractors to sign contracts in the app!" | Integration complexity, cost per signature, vendor dependency. Most Polish B2B contracts are signed via email exchange or wet signature anyway. | Store signed contracts as uploaded documents in v1. E-sign in v1.5. |
| **Full payroll / employee management** | "Can you also handle our employees?" | Completely different domain: tax calculations, social security, employment law, benefits. Would turn the product into an HR system. | Explicitly out of scope. Contractor ops only. Integrate with HR/payroll systems via API in v2+. |
| **Open banking / payment initiation** | "Can you pay directly from the app?" | Bank API integration is complex (PSD2 compliance, bank-specific APIs, security). Liability for payment errors. Regulatory requirements. | Bank file export (CSV/MT940) in v1. User initiates payment in their bank. Open banking in v2+. |
| **Real-time everything (WebSockets)** | "I want to see updates instantly!" | WebSocket infrastructure adds complexity (connection management, reconnection, state sync). For 5-50 contractor orgs, polling every 30 seconds is indistinguishable from real-time. | Polling with TanStack Query's refetch intervals. Push notifications for critical events (approval needed). WebSockets only if proven necessary. |
| **Custom fields on everything** | "Every company is different, let us add custom fields!" | Custom fields are a product complexity black hole: schema flexibility, search/filter/report on custom data, migration headaches, UI complexity. | Ship with well-researched fixed schemas that cover 90% of cases. Custom fields in v2 if validated by customer demand. |
| **Contractor marketplace / directory** | "Help us find new contractors!" | Completely different product (marketplace dynamics, contractor profiles, matching algorithms). Dilutes focus. | Never build this. Out of scope permanently. |
| **SSO/SCIM** | Enterprise customers want it. | Complex integration (SAML/OIDC providers, SCIM provisioning). Target market (10-200 people) rarely requires it. | v3 feature. Email/password + invite flow covers target market. |
| **Mobile native app** | "I need to approve on my phone!" | Two codebases (or RN complexity), app store overhead, maintenance burden. | Responsive web that works on mobile browser for approval flow. Desktop-first for everything else. |
| **Multi-currency support** | "We pay contractors in EUR and USD!" | Exchange rate management, multi-currency accounting, complexity in reporting. Target market is Polish companies paying in PLN. | PLN-only in v1. Multi-currency in v1.5 if validated. Most Polish B2B contracts are PLN-denominated. |

## Feature Dependencies

```
[Multi-tenant Org Setup]
    |
    +--requires--> [RBAC + User Management]
    |                  |
    |                  +--requires--> [User Invite Flow]
    |
    +--requires--> [Contractor Registry]
    |                  |
    |                  +--enables--> [Contractor Profiles]
    |                  |                 |
    |                  |                 +--enhanced-by--> [Compliance Health Scoring]
    |                  |
    |                  +--enables--> [Contract Repository]
    |                  |                 |
    |                  |                 +--enables--> [Document Management]
    |                  |
    |                  +--enables--> [Invoice Intake]
    |                                    |
    |                                    +--requires--> [Invoice-Contractor Matching]
    |                                    |                  |
    |                                    |                  +--enhanced-by--> [Duplicate Detection]
    |                                    |                  |
    |                                    |                  +--enhanced-by--> [Invoice-Contract Matching + Deviation]
    |                                    |
    |                                    +--enables--> [Approval Workflow]
    |                                                      |
    |                                                      +--enhanced-by--> [SLA Timers]
    |                                                      |
    |                                                      +--enhanced-by--> [Slack Integration]
    |                                                      |
    |                                                      +--enhanced-by--> [Approval Delegation]
    |                                                      |
    |                                                      +--enables--> [Payment Batch Export]
    |
    +--parallel--> [Workflow Engine (Templates)]
    |                  |
    |                  +--enables--> [Workflow Execution (Onboarding/Offboarding)]
    |
    +--parallel--> [Notifications]
    |
    +--parallel--> [Audit Log]
    |
    +--enables--> [Dashboard + Reports]
    |
    +--enables--> [Global Search + Cmd+K]

[Data Import] --standalone, needed early for onboarding--
[Product Onboarding Wizard] --standalone, wraps setup flow--
[i18n] --cross-cutting, needed from day 1--
```

### Dependency Notes

- **Multi-tenant Org Setup is foundational:** Everything scopes to organization_id. Must be first.
- **RBAC required before any data access:** Permission checks gate every feature. Build alongside org setup.
- **Contractor Registry before Contracts/Invoices:** Invoices and contracts reference contractors. Registry must exist first.
- **Invoice Intake before Approval:** You cannot approve what you have not ingested. Invoice flow is sequential.
- **Approval before Payment:** Only approved invoices enter payment runs. Strict dependency.
- **Workflow Engine is parallel to Invoice Flow:** Onboarding/offboarding workflows operate independently from the invoice-to-payment pipeline. Can be built in parallel.
- **Dashboard/Reports depend on data existing:** Build after core data flows (contractors, invoices, payments) are functional.
- **Notifications are cross-cutting:** Needed across multiple features but can start simple and expand.
- **Data Import is standalone but early:** Users need to migrate from Excel on day 1. Should be available at launch.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to replace the Excel + email + Slack workflow.

- [ ] **Multi-tenant org setup** -- foundation for everything
- [ ] **RBAC + user management + invite flow** -- team access is non-negotiable
- [ ] **Contractor registry + profiles** -- the core entity
- [ ] **Contract repository + document management** -- legal backbone
- [ ] **Invoice intake (upload + email)** -- core value proposition starts here
- [ ] **Invoice-contractor-contract matching** -- automates the manual matching step
- [ ] **Duplicate invoice detection** -- prevents double payments
- [ ] **Configurable approval workflow (1-3 levels)** -- the approval bottleneck is the #1 pain point
- [ ] **Payment batch export (CSV/bank file)** -- completes the flow
- [ ] **Workflow engine + onboarding/offboarding templates** -- key differentiator, ship at launch
- [ ] **Dashboard with KPIs** -- users need a home screen
- [ ] **Basic reports** -- finance teams need spend visibility
- [ ] **Notifications (in-app + email)** -- approvals without notifications are useless
- [ ] **Audit log** -- compliance requirement for financial operations
- [ ] **Data import (CSV/XLSX)** -- migration from Excel is the onboarding path
- [ ] **Product onboarding wizard** -- reduces time-to-value
- [ ] **Global search + Cmd+K** -- power-user navigation
- [ ] **i18n (PL + EN)** -- non-negotiable for Polish market
- [ ] **Slack integration (notifications + inline approval)** -- differentiator, target market lives in Slack

### Add After Validation (v1.x)

Features to add once core is working and first customers are using it.

- [ ] **Contractor self-service portal** -- when contractors ask "where do I submit my invoice?"
- [ ] **KSeF native integration** -- when grace period ends (Dec 2026) or customers demand structured XML
- [ ] **E-sign integration (Autenti/DocuSign)** -- when contract volume justifies the integration cost
- [ ] **OCR invoice parsing** -- only if email/upload intake proves too manual (KSeF may eliminate need)
- [ ] **Multi-currency (EUR/USD)** -- when customers with international contractors appear
- [ ] **Advanced reporting + export** -- when basic reports prove insufficient

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Open banking / payment initiation** -- when bank file export is validated as friction point
- [ ] **Public API + webhooks** -- when integration requests come from customers
- [ ] **SSO/SCIM** -- when enterprise customers appear (50+ contractors)
- [ ] **Custom fields** -- when fixed schemas prove insufficient for diverse customers
- [ ] **Deep integrations (Jira, Google, Microsoft)** -- when project-level tracking is requested

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Multi-tenant org + RBAC + users | HIGH | MEDIUM | P1 |
| Contractor registry + profiles | HIGH | MEDIUM | P1 |
| Contract repository + docs | HIGH | MEDIUM | P1 |
| Invoice intake (upload + email) | HIGH | MEDIUM | P1 |
| Invoice matching + dedup | HIGH | MEDIUM | P1 |
| Approval workflow (configurable) | HIGH | HIGH | P1 |
| Payment batch export | HIGH | MEDIUM | P1 |
| Workflow engine (onboard/offboard) | HIGH | HIGH | P1 |
| Dashboard + KPIs | MEDIUM | MEDIUM | P1 |
| Notifications (in-app + email) | HIGH | MEDIUM | P1 |
| Audit log | HIGH | MEDIUM | P1 |
| Basic reports | MEDIUM | MEDIUM | P1 |
| Data import (CSV) | HIGH | MEDIUM | P1 |
| i18n (PL + EN) | HIGH | LOW | P1 |
| Global search + Cmd+K | MEDIUM | MEDIUM | P1 |
| Product onboarding wizard | MEDIUM | MEDIUM | P1 |
| Slack integration | MEDIUM | MEDIUM | P1 |
| SLA timers on approvals | MEDIUM | LOW | P1 |
| Compliance health scoring | MEDIUM | LOW | P1 |
| Approval delegation | MEDIUM | LOW | P1 |
| Contractor portal | HIGH | HIGH | P2 |
| KSeF integration | HIGH | HIGH | P2 |
| E-sign integration | MEDIUM | MEDIUM | P2 |
| OCR parsing | MEDIUM | HIGH | P2 |
| Multi-currency | LOW | MEDIUM | P2 |
| Open banking | MEDIUM | HIGH | P3 |
| Public API + webhooks | MEDIUM | HIGH | P3 |
| SSO/SCIM | LOW | HIGH | P3 |
| Custom fields | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (v1)
- P2: Should have, add after validation (v1.x)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | Deel | Remote | SaldeoSMART | Faktura.pl | Excel/Notion | Our Approach |
|---------|------|--------|-------------|------------|--------------|--------------|
| Contractor registry | Yes (global, 150+ countries) | Yes (global) | No (accounting focus) | Basic (NIP lookup) | Manual spreadsheet | Yes, Poland-focused with NIP/GUS verification |
| Contract management | Auto-generated, localized | Auto-generated, compliant | No | No | File folders | Upload + metadata + versioning + expiry tracking |
| Onboarding workflow | Rigid templates | Self-serve, fast (50% faster) | No | No | Notion checklists | Configurable template builder with dependencies |
| Offboarding workflow | Basic | Automated (access removal) | No | No | Ad-hoc | Configurable templates mirroring onboarding |
| Invoice intake | In-platform | In-platform | Email + OCR | Manual creation | Email + manual | Upload + email inbox + auto-matching |
| Invoice matching | To contractor | To contractor | To accounting entries | No | Manual | To contractor AND contract with deviation detection |
| Approval workflow | Basic (single level) | Basic | Document approval | No | Slack messages | Configurable 1-3 levels with SLA timers |
| Payment | 8 withdrawal options | 180+ countries | Payment monitoring | No | Bank transfers | Bank file export (CSV/MT940) |
| KSeF integration | No (not Poland-focused) | No | Yes (native) | Partial | Manual | v1.5 (email/upload first) |
| Compliance tracking | Misclassification tools | KYC + misclassification | Tax compliance | VAT white list check | None | Health scoring per contractor |
| Audit log | Yes | Yes | Basic | No | None | Immutable, filterable, exportable |
| Slack integration | Notifications | No | No | No | Native (but no structure) | Notifications + inline approve/reject |
| Pricing | $29-49/contractor/mo | $29-99/contractor/mo | ~100-300 PLN/mo | Free-50 PLN/mo | Free | 350-650 PLN/mo platform fee |

**Key competitive insight:** Deel and Remote are priced per-contractor and optimized for cross-border. SaldeoSMART is accounting-first with no contractor lifecycle. Faktura.pl is invoice creation, not management. The gap is a **local B2B contractor ops platform** that owns the full lifecycle at a flat platform fee.

## Sources

- [Deel - Contractor Management](https://www.deel.com/) -- global contractor platform, $29-49/contractor/mo
- [Remote - Contractor Management Software](https://remote.com/global-hr/contractor-management) -- global contractor management, $29-99/contractor/mo
- [SaldeoSMART](https://www.supremis.pl/en/produkt/saldeosmart-en/) -- Polish invoice OCR and document flow, 170K companies
- [Faktura.pl](https://faktura.pl/funkcje/) -- Polish invoicing platform
- [Rippling - Contractor Onboarding](https://www.rippling.com/use-cases/automate-contractor-onboarding-with-rippling-it) -- 90-second contractor onboarding
- [ApprovalMax](https://approvalmax.com/) -- invoice approval workflow tool
- [Rillion - Invoice Approval Best Practices](https://www.rillion.com/blog/invoice-approval-workflow-best-practices/) -- AP workflow patterns
- [WorkOS - Multi-tenant RBAC Design](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas) -- RBAC patterns for B2B SaaS
- [KSeF Poland E-Invoicing](https://www.dudkowiak.com/tax-law-in-poland/e-invoicing-in-poland-ksef/) -- KSeF timeline and requirements
- [EDICOM - Poland B2B E-Invoicing](https://edicomgroup.com/blog/poland-will-make-b2b-electronic-invoicing-mandatory) -- KSeF implementation details
- [People Managing People - Contractor Management Software](https://peoplemanagingpeople.com/tools/best-contractor-management-software/) -- market overview

---
*Feature research for: B2B Contractor Operations Platform (EU/Poland-first)*
*Researched: 2026-03-18*
