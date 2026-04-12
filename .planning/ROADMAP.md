# Roadmap: Contractor Ops

## Milestones

- ✅ **v1.0 MVP** — Phases 1-11 (shipped 2026-03-23)
- ✅ **v2.0 Platform Expansion** — Phases 12-27 (shipped 2026-04-01)
- ✅ **v3.0 Enterprise & Monetization** — Phases 28-44 (shipped 2026-04-11)
- 🚧 **v4.0 International Foundation & Gulf Expansion** — Phases 45-52 (in progress)

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

<details>
<summary>✅ v3.0 Enterprise & Monetization (Phases 28-44) — SHIPPED 2026-04-11</summary>

- [x] Phase 28: Stripe Billing Foundation (4/4 plans) — completed 2026-04-01
- [x] Phase 29: Linear Integration (3/3 plans) — completed 2026-04-01
- [x] Phase 30: Equipment Tracking Foundation (3/3 plans) — completed 2026-04-02
- [x] Phase 31: Google Workspace Directory Import (5/5 plans) — completed 2026-04-02
- [x] Phase 32: Teams Integration (4/4 plans) — completed 2026-04-04
- [x] Phase 33: InPost Courier Integration (3/3 plans) — completed 2026-04-04
- [x] Phase 34: Intelligent Onboarding Wizard (2/2 plans) — completed 2026-04-04
- [x] Phase 35: Feature Gating + DPD/UPS + Billing Polish (6/6 plans) — completed 2026-04-05
- [x] Phase 36: Wiring Fixes — Webhook Dispatch + UI Mounting + Feature Gate (3/3 plans) — completed 2026-04-05
- [x] Phase 37: Shipment Task Auto-Completion Wiring (1/1 plan) — completed 2026-04-05
- [x] Phase 38: Tier Gate Expansion + CourierClient Type Fix (3/3 plans) — completed 2026-04-05
- [x] Phase 39: Final Wiring — Channel Alerts + Credit Exhaustion UI + OAuth FeatureGate (3/3 plans) — completed 2026-04-05
- [x] Phase 40: Integration Cleanup — FeatureGate + Type Safety (2/2 plans) — completed 2026-04-06
- [x] Phase 41: Wiring Fixes — Teams Channel Ref + Onboarding OAuth (2/2 plans) — completed 2026-04-06
- [x] Phase 42: Tech Debt Cleanup (2/2 plans) — completed 2026-04-10
- [x] Phase 43: DPD/UPS Notification Dispatch Wiring (1/1 plan) — completed 2026-04-11
- [x] Phase 44: Test Stub Completion (0/0 plans — pre-satisfied) — completed 2026-04-11

Full details: `.planning/milestones/v3.0-ROADMAP.md`

</details>

### 🚧 v4.0 International Foundation & Gulf Expansion (In Progress)

**Milestone Goal:** Build pluggable multi-market infrastructure (e-invoicing engine, multi-currency, i18n framework, multi-region) and launch UAE + Saudi Arabia as first international markets.

- [x] **Phase 45: Pluggable E-Invoicing Engine Core** - Abstract UBL 2.1 engine with KSeF refactored as first country profile (completed 2026-04-11)
- [x] **Phase 46: Multi-Currency Foundation & SWIFT Payment Export** - AED/SAR/GBP currencies with Money utility, exchange rates, and ISO 20022 SWIFT export (completed 2026-04-11)
- [x] **Phase 47: VAT Engine, WHT Calculator & Country Fields** - Configuration-driven multi-tier VAT, Saudi WHT with certificate generation, and country-specific contractor profiles (7 plans, gap closure in progress) (completed 2026-04-11)
- [x] **Phase 48: ZATCA Fatoorah Integration** - Saudi e-invoicing with XML DSig, hash chain, QR codes, and Fatoora Portal API clearance (8 plans, gap closure in progress) (completed 2026-04-12)
- [x] **Phase 49: Peppol PINT-AE Integration** - UAE e-invoicing via certified ASP with inbound invoice parsing (5 plans, gap closure) (completed 2026-04-12)
- [x] **Phase 50: Arabic Localization & RTL Layout** - Full Arabic translation with codebase-wide RTL migration to CSS logical properties (completed 2026-04-11)
- [x] **Phase 51: PDPL Compliance** - UAE and Saudi privacy law compliance with consent management and cross-border transfer safeguards (completed 2026-04-11)
- [x] **Phase 52: Multi-Region Infrastructure** - Regional database routing, file storage residency, and government API framework (completed 2026-04-11)

## Phase Details

### Phase 45: Pluggable E-Invoicing Engine Core
**Goal**: Organizations using KSeF continue working without regression while the platform gains a pluggable e-invoicing architecture that any country profile can extend
**Depends on**: Nothing (first phase of v4.0)
**Requirements**: EINV-01, EINV-02, EINV-03, EINV-04, EINV-05, EINV-06
**Success Criteria** (what must be TRUE):
  1. A new country profile can be added by implementing the EInvoiceProfile interface without modifying the engine core
  2. All existing KSeF integration tests pass green after refactoring KSeF into the first country profile (zero regression)
  3. The engine can generate, validate, and parse UBL 2.1 XML documents through the country profile abstraction
  4. Each organization can see its e-invoicing compliance status per connected country profile
  5. Digital signature and QR code generation are abstracted as profile-level capabilities (not hardcoded to any country)
**Plans**: TBD

### Phase 46: Multi-Currency Foundation & SWIFT Payment Export
**Goal**: Organizations can operate in AED, SAR, or GBP alongside existing PLN/EUR with correct minor-unit precision across invoices, contracts, payments, and reports
**Depends on**: Phase 45
**Requirements**: CURR-01, CURR-02, CURR-03, CURR-04, CURR-05, PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):
  1. An organization can set its home currency and all new invoices, contracts, and payment runs default to that currency
  2. Financial reports display amounts converted to the organization's home currency using daily ECB exchange rates
  3. Payment runs group invoices by currency and generate separate SWIFT pain.001 XML files per currency batch
  4. Each SWIFT payment file includes automatically assigned purpose codes based on service category, with manual override available
  5. All monetary calculations use the Money utility with ISO 4217 minor-unit lookup (no hardcoded * 100)
**Plans**: TBD
**UI hint**: yes

### Phase 47: VAT Engine, WHT Calculator & Country Fields
**Goal**: Organizations see correct VAT applied per country rules, Saudi WHT is calculated and certified for cross-border payments, and contractor profiles capture country-specific compliance fields
**Depends on**: Phase 46
**Requirements**: TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, PROF-01, PROF-02, PROF-03, PROF-04
**Success Criteria** (what must be TRUE):
  1. Invoices for UAE organizations apply 5% VAT and invoices for Saudi organizations apply 15% VAT, with rates driven by database configuration (not code branches)
  2. Cross-border B2B invoices are automatically flagged with reverse charge per the applicable country rules
  3. Saudi organizations see WHT deduction calculated on cross-border contractor payments based on residency, service type, and treaty rates
  4. A downloadable WHT certificate PDF is generated for each Saudi cross-border payment with correct withholding details
  5. UAE contractor profiles show freelance permit and trade license fields; Saudi profiles show Freelance.sa license and commercial registration fields, activated by the organization's country setting
**Plans**: 7 plans
Plans:
- [x] 47-01-PLAN.md — TaxRate & WithholdingTaxRate Models, Seed Data, and VAT Rate Service
- [x] 47-02-PLAN.md — Reverse Charge Detection Service and Invoice Integration
- [x] 47-03-PLAN.md — WHT Certificate PDF Generation and Payment Run Integration
- [x] 47-04-PLAN.md — Country-Specific Contractor Profile Fields and TIN Validation
- [x] 47-05-PLAN.md — VAT Rate Selector UI, Reverse Charge Banner, WHT Payment View, and Compliance Dashboard Tax Widget
- [x] 47-06-PLAN.md — [GAP] Wire reverse charge auto-detection into matching flow, remove duplicate files
- [x] 47-07-PLAN.md — [GAP] Fix component imports and wire UI components into pages
**UI hint**: yes

### Phase 48: ZATCA Fatoorah Integration
**Goal**: Saudi organizations can submit e-invoices to ZATCA for clearance (B2B) and reporting (B2C) with full cryptographic compliance
**Depends on**: Phase 47
**Requirements**: ZATCA-01, ZATCA-02, ZATCA-03, ZATCA-04, ZATCA-05, ZATCA-06, ZATCA-07
**Success Criteria** (what must be TRUE):
  1. An organization can complete ZATCA device onboarding (CSR generation, compliance CSID, production certificate exchange) through a guided wizard
  2. Generated invoices include valid XAdES enveloped XML digital signatures using the organization's X.509 certificate
  3. Each invoice contains a TLV-encoded QR code with seller name, VAT number, timestamp, total, and VAT amount
  4. The invoice hash chain is maintained -- each new invoice references the hash of the previous invoice for that organization, with sequential processing enforced
  5. B2B tax invoices are submitted to ZATCA Fatoora Portal for clearance, and simplified B2C invoices are submitted for reporting, with status tracked per invoice
**Plans**: 8 plans
Plans:
- [x] 48-01-PLAN.md — ZATCA profile, UBL 2.1 XML generator, Prisma schema, Zod validators
- [x] 48-02-PLAN.md — XAdES-BES enveloped digital signatures with xml-crypto
- [x] 48-03-PLAN.md — TLV-encoded QR code generation
- [x] 48-04-PLAN.md — Hash chain, Infisical secret store, submission pipeline, tRPC router
- [x] 48-05-PLAN.md — Device onboarding: CSR generation, compliance checks, certificate exchange
- [x] 48-06-PLAN.md — Onboarding wizard UI, status badges, compliance widget, schema push
- [x] 48-07-PLAN.md — [GAP] Wire submission pipeline to real ZATCA XML generation, signing, and QR
- [x] 48-08-PLAN.md — [GAP] Wire orphaned ZATCA UI components into invoice detail page
**UI hint**: yes

### Phase 49: Peppol PINT-AE Integration
**Goal**: UAE organizations can send and receive e-invoices through the Peppol network via a certified ASP
**Depends on**: Phase 45
**Requirements**: PEPPOL-01, PEPPOL-02, PEPPOL-03, PEPPOL-04
**Success Criteria** (what must be TRUE):
  1. An organization can register its Peppol Participant ID and connect to the certified ASP
  2. Outbound invoices are generated as PINT-AE compliant UBL 2.1 XML and transmitted via the ASP, with delivery confirmation tracked
  3. Inbound Peppol invoices received from the ASP are parsed and appear in the invoice intake queue
  4. Generated invoices include QR codes per UAE e-invoicing requirements
**Plans**: 5 plans
Plans:
- [x] 49-01-PLAN.md — Peppol-AE Profile & ASP Adapter Interface
- [x] 49-02-PLAN.md — Prisma Models, Enum Extensions & tRPC Router
- [x] 49-03-PLAN.md — Storecove ASP Adapter, Outbound Orchestrator & Inbound Processing
- [x] 49-04-PLAN.md — Peppol UI — Connection Wizard, Status Views & Compliance Widget
- [x] 49-05-PLAN.md — [GAP] Wire orphaned Peppol UI components into invoice detail and dashboard
**UI hint**: yes

### Phase 50: Arabic Localization & RTL Layout
**Goal**: Arabic-speaking users can use the entire platform in Arabic with correct right-to-left layout, bidirectional text, and locale-appropriate formatting
**Depends on**: Phase 48, Phase 49
**Requirements**: L10N-01, L10N-02, L10N-03, L10N-04, L10N-05
**Success Criteria** (what must be TRUE):
  1. Users can select Arabic as their locale and all UI strings display in Arabic (3rd locale alongside Polish and English)
  2. The entire application renders in RTL mode when Arabic is selected -- all spacing, alignment, and directional elements use CSS logical properties
  3. Mixed Arabic/English content (e.g., contractor names, invoice numbers) renders correctly with proper bidi isolation
  4. Charts, tables, and data visualizations render with mirrored axes and correct reading direction in RTL mode
  5. Dates, numbers, and currency amounts follow Arabic locale conventions (Western/Latin numerals for financial data)
**Plans**: TBD
**UI hint**: yes

### Phase 51: PDPL Compliance
**Goal**: Organizations onboarding in UAE or Saudi Arabia see jurisdiction-appropriate privacy controls that satisfy PDPL requirements
**Depends on**: Phase 47
**Requirements**: PDPL-01, PDPL-02, PDPL-03, PDPL-04
**Success Criteria** (what must be TRUE):
  1. UAE and Saudi organizations see jurisdiction-specific privacy notices during onboarding and in settings
  2. Users can view and manage their consent per data processing purpose, with consent records tracked and auditable
  3. Data processing agreements are available for download per organization
  4. Cross-border data transfer documentation (standard contractual clauses) is generated for organizations whose data is hosted outside their jurisdiction
**Plans**: TBD
**UI hint**: yes

### Phase 52: Multi-Region Infrastructure
**Goal**: The platform can route organization data to the correct regional deployment and provide reusable patterns for government API integrations
**Depends on**: Phase 51
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Database deployment supports EU and a closest-available Middle East region (Frankfurt fallback), with per-organization region assignment
  2. tRPC middleware routes requests to the correct regional Prisma client based on organization region
  3. File uploads are stored in regional R2 buckets matching the organization's data residency configuration
  4. Government API integrations (ZATCA, Peppol, future markets) use a shared framework with certificate auth, retry logic, rate limiting, sandbox/production modes, and audit logging
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 45 -> 46 -> 47 -> 48 -> 49 -> 50 -> 51 -> 52
(Phase 49 depends on Phase 45 only, not 48 -- can potentially parallel with 46-48 if capacity allows)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 45. Pluggable E-Invoicing Engine Core | v4.0 | 5/5 | Complete    | 2026-04-11 |
| 46. Multi-Currency & SWIFT Payments | v4.0 | 5/5 | Complete    | 2026-04-11 |
| 47. VAT Engine, WHT & Country Fields | v4.0 | 7/7 | Complete    | 2026-04-11 |
| 48. ZATCA Fatoorah Integration | v4.0 | 8/8 | Complete    | 2026-04-12 |
| 49. Peppol PINT-AE Integration | v4.0 | 5/5 | Complete    | 2026-04-12 |
| 50. Arabic Localization & RTL Layout | v4.0 | 7/7 | Complete    | 2026-04-12 |
| 51. PDPL Compliance | v4.0 | 4/4 | Complete    | 2026-04-11 |
| 52. Multi-Region Infrastructure | v4.0 | 4/4 | Complete    | 2026-04-12 |
