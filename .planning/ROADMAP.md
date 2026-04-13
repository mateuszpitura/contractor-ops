# Roadmap: Contractor Ops

## Milestones

- v1.0 MVP - Phases 1-11 (shipped 2026-03-23)
- v2.0 Platform Expansion - Phases 12-27 (shipped 2026-04-01)
- v3.0 Enterprise & Monetization - Phases 28-44 (shipped 2026-04-10)
- v4.0 International Foundation & Gulf Expansion - Phases 45-55 (shipped 2026-04-12)
- v5.0 UK & Germany Expansion - Phases 56-63 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-11) - SHIPPED 2026-03-23</summary>
See .planning/milestones/v1.0/ for details.
</details>

<details>
<summary>v2.0 Platform Expansion (Phases 12-27) - SHIPPED 2026-04-01</summary>
See .planning/milestones/v2.0/ for details.
</details>

<details>
<summary>v3.0 Enterprise & Monetization (Phases 28-44) - SHIPPED 2026-04-10</summary>
See .planning/milestones/v3.0/ for details.
</details>

<details>
<summary>v4.0 International Foundation & Gulf Expansion (Phases 45-55) - SHIPPED 2026-04-12</summary>
See .planning/milestones/v4.0/ for details.
</details>

### v5.0 UK & Germany Expansion (In Progress)

**Milestone Goal:** Expand Contractor Ops to UK and German markets with contractor classification engines (IR35, Scheinselbstandigkeit), EN 16931 e-invoicing (XRechnung, ZUGFeRD), UK payment infrastructure (BACS), government API integrations (HMRC, VIES), and German localization.

- [x] **Phase 56: Country Foundations & German i18n** - UK/DE contractor fields, German locale, GDPR compliance notices (completed 2026-04-12)
- [ ] **Phase 57: Government API Clients** - HMRC VAT validation, VIES USt-IdNr validation, UK/DE VAT rates
- [ ] **Phase 58: Classification Engine & Rule Sets** - Generic classification engine with IR35 and Scheinselbstandigkeit rule sets
- [x] **Phase 59: Classification Documents & Chain Tracking** - SDS generation, IR35 chain participants, DRV audit defense documentation (completed 2026-04-13)
- [ ] **Phase 60: Classification Polish** - Economic dependency alerts, reassessment triggers, DRV tracking, compliance dashboard
- [ ] **Phase 61: XRechnung E-Invoicing** - XRechnung CII XML generation, KoSIT validation, Leitweg-ID, Peppol UK
- [ ] **Phase 62: ZUGFeRD E-Invoicing** - ZUGFeRD PDF/A-3 with embedded CII XML, inbound XRechnung/ZUGFeRD parsing
- [ ] **Phase 63: UK Payments & Financial Features** - BACS Standard 18 export, late payment interest, Skonto discounts

## Phase Details

### Phase 56: Country Foundations & German i18n
**Goal**: UK and German organizations can onboard contractors with country-specific profile fields, use the platform in German, and view jurisdiction-appropriate GDPR notices
**Depends on**: Nothing (first v5.0 phase; builds on v4.0 country fields pattern and i18n infrastructure)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06
**Success Criteria** (what must be TRUE):
  1. User in a UK organization can add a contractor with UTR, Companies House number, and VAT registration number fields that validate correctly
  2. User in a German organization can add a contractor with Steuernummer, Handelsregister number, USt-IdNr, and Sozialversicherungsnummer fields that validate correctly
  3. User can switch the platform to German and see all UI elements, navigation, and system messages in German with formal register (Sie)
  4. User sees legally correct German tax terminology (e.g., "Steuerschuldnerschaft des Leistungsempfangers") as locked constants that cannot be accidentally modified through translation
  5. User in a UK or German organization can view jurisdiction-appropriate GDPR privacy notices and data processing information
**Plans**: 8 plans
- [x] 56-01-PLAN.md — Wave 0 test scaffolds + MDX/React-PDF dep install
- [x] 56-02-PLAN.md — UK validators (UTR mod-11, GB VAT mod-97/9755 + GBGD/GBHA, Companies House)
- [x] 56-03-PLAN.md — DE validators (USt-IdNr ISO-7064, SV-Nummer, Steuernummer/Handelsregister dispatchers) + locked legal phrases module + CI guard
- [x] 56-04-PLAN.md — Steuernummer 16-Bundesland regex map + Handelsregister ~120-court list + UK/DE Zod discriminated-union schemas
- [x] 56-05-PLAN.md — DE locale in next-intl routing + localeSettings (Europe/Berlin, EUR) + messages/de.json (AI first-pass, Sie register)
- [x] 56-06-PLAN.md — UK/DE contractor profile field groups (7 components + CountryComplianceSection dispatch)
- [x] 56-07-PLAN.md — MDX privacy pages (GB/DE/EU) + React-PDF template + legal tRPC router (IDOR-safe) + app footer + user-menu drift fix
- [x] 56-08-PLAN.md — Onboarding consent extension + SV-Nummer PII mask + DE-default language + Steuerberater review gate + phase verification
**UI hint**: yes

### Phase 57: Government API Clients
**Goal**: Platform can validate UK and German tax identifiers against government systems and apply correct VAT rates for UK and German invoices
**Depends on**: Phase 56 (country fields and VAT rate seed data)
**Requirements**: PAY-02, PAY-03, PAY-04, PAY-05
**Success Criteria** (what must be TRUE):
  1. User can validate a UK VAT registration number via HMRC API and see the validation result on the contractor profile
  2. User can validate a German USt-IdNr via VIES API with qualified confirmation, with graceful degradation when VIES is unavailable
  3. User can apply correct UK VAT rates (20% standard, 5% reduced, 0% zero-rated) to invoices for UK organizations
  4. User can apply correct German VAT rates (19% standard, 7% reduced) with Kleinunternehmerregelung exemption flag and proper reverse charge labeling
**Plans**: 4 plans
- [x] 57-01-PLAN.md — Wave 0: schema (TaxIdValidation + fields) + GB/DE seed + locked phrases + MSW + Zod schemas + RED scaffolds + [BLOCKING] prisma db push
- [x] 57-02-PLAN.md — Wave 1: HmrcVatClient (OAuth 2.0 client-credentials, 401-refresh, fraud-prevention headers) + ViesClient (simple + qualified + userError soft-fail)
- [x] 57-03-PLAN.md — Wave 2: tax-id-validation orchestrator ( + 90-day freshness + soft-fail/stale) + reverse-charge rules (gb_eu_post_brexit_b2b + de_domestic_13b_ustg) + Kleinunternehmer service
- [ ] 57-04-PLAN.md — Wave 3: tRPC routers (validateVat/revalidateVat/setKleinunternehmer) + invoice pipeline (preselect+KU+RC+staleness) + UI (pill/button/toggles/footer notices) + human-verify checkpoint + VALIDATION.md sign-off

### Phase 58: Classification Engine & Rule Sets
**Goal**: Users can assess contractor classification risk using a generic engine with UK IR35 and German Scheinselbstandigkeit rule sets, stored per-engagement
**Depends on**: Phase 56 (country fields for contractor profiles)
**Requirements**: CLASS-01, CLASS-02, CLASS-05, CLASS-11
**Success Criteria** (what must be TRUE):
  1. User can start a classification assessment for a specific contractor engagement and select the appropriate country rule set (IR35 or Scheinselbstandigkeit)
  2. User can complete an IR35 assessment across 5 areas (substitution, control, financial risk, part-and-parcel, mutuality of obligation) and receive an inside/outside/undetermined outcome with mandatory disclaimer
  3. User can complete a Scheinselbstandigkeit risk assessment using DRV-aligned criteria across 4 categories with weighted risk scoring and traffic-light outcome
  4. A single contractor with multiple engagements has independent classification assessments per engagement, visible from the contractor profile
**Plans**: 5 plans
- [x] 58-01-PLAN.md — Wave 0: classification workspace scaffold + Prisma model + [BLOCKING] db push + locked phrases (CLASSIFICATION_SCHEIN_* + DISCLAIMER_*) + extended CI guard + 11 test files
- [x] 58-02-PLAN.md — Wave 1: IR35 rule set (25 questions, dispositive-first scoring per Atholl House + PGMOL) + DRV rule set (20 criteria, 30/30/25/15 weights, thresholds 29.9/30/60/60.1) + self-registering profile classes
- [x] 58-03-PLAN.md — Wave 2: classification tRPC router (createDraft, saveAnswer, submit, acknowledgeDisclaimer, getLatest, listByContractor, getDraft) + multi-tenant leak test + autosave rate-limit + rule-set drift detection
- [x] 58-04-PLAN.md — Wave 3: wizard entry page + multi-step shell + progress bar + step indicator + autosave indicator + 4 answer inputs (Yes/No, Likert, Score03, Rationale) + EconomicDependencyInput + legal-reference Collapsible + a11y
- [ ] 58-05-PLAN.md — Wave 3: SSR outcome pages (IR35 5-area + DRV traffic-light + category bars) + blocking disclaimer AlertDialog + tile on CountryComplianceSection + assessment list + print layout + Steuerberater + UK tax-adviser human-verify checkpoint
**UI hint**: yes

### Phase 59: Classification Documents & Chain Tracking
**Goal**: Users can generate legally required classification documents and track IR35 chain participants for compliance evidence
**Depends on**: Phase 58 (classification engine and assessment data)
**Requirements**: CLASS-03, CLASS-04, CLASS-06
**Success Criteria** (what must be TRUE):
  1. User can generate a Status Determination Statement (SDS) PDF containing the IR35 determination outcome, reasoning per assessment area, engagement details, and dispute process
  2. User can record and view IR35 chain participants (client, agency/intermediary, contractor PSC, worker) with SDS delivery timestamps per engagement
  3. User can generate a DRV audit defense documentation PDF bundle containing engagement structure summary, independence indicators, risk assessment history, and other-client attestation
**Plans**: TBD

### Phase 60: Classification Polish
**Goal**: Users receive proactive compliance alerts, can track German regulatory procedures, and have a single dashboard view of classification health across UK and German engagements
**Depends on**: Phase 58, Phase 59 (classification assessments and documents must exist to monitor and display)
**Requirements**: CLASS-07, CLASS-08, CLASS-09, CLASS-10
**Success Criteria** (what must be TRUE):
  1. User receives automated alerts when a German contractor's billing from a single client exceeds 70% (warning) or 83.33% (critical) economic dependency thresholds
  2. User receives automated reassessment triggers when a UK engagement materially changes (contract amendment, rate change, scope change, extension) with a link to the previous SDS for comparison
  3. User can track Statusfeststellungsverfahren (DRV clearance procedure) applications with filing date, DRV reference, outcome, validity period, and expiry reminders
  4. User can view a per-market compliance health dashboard showing IR35 assessment coverage, Scheinselbstandigkeit risk distribution, overdue reassessments, and economic dependency alerts
**Plans**: TBD
**UI hint**: yes

### Phase 61: XRechnung E-Invoicing
**Goal**: Users can generate XRechnung-compliant e-invoices with full EN 16931 validation, manage Leitweg-IDs for German B2G, and send invoices to UK public sector via Peppol
**Depends on**: Phase 57 (VAT rates and VAT number validation for invoice generation)
**Requirements**: EINV-01, EINV-04, EINV-05, EINV-06, EINV-07
**Success Criteria** (what must be TRUE):
  1. User can generate an XRechnung-compliant e-invoice in CII XML syntax that passes all three KoSIT validation layers (XSD schema, EN 16931 Schematron, XRechnung CIUS Schematron)
  2. User can store and manage Leitweg-IDs per contractor or per contract for German B2G invoicing
  3. User can send e-invoices to UK public sector recipients via Peppol BIS Billing 3.0 through the existing Storecove ASP integration
  4. User can view e-invoicing compliance status per organization showing which invoices are EN 16931 compliant and which need attention
**Plans**: TBD
**UI hint**: yes

### Phase 62: ZUGFeRD E-Invoicing
**Goal**: Users can generate ZUGFeRD PDF/A-3 invoices with embedded CII XML, and the platform can receive and parse incoming XRechnung and ZUGFeRD invoices
**Depends on**: Phase 61 (CII XML generation from XRechnung profile, EN 16931 validation infrastructure)
**Requirements**: EINV-02, EINV-03
**Success Criteria** (what must be TRUE):
  1. User can generate a ZUGFeRD e-invoice as a PDF/A-3 document with embedded CII XML at EN 16931 COMFORT profile level that passes veraPDF validation
  2. User can receive an incoming XRechnung or ZUGFeRD invoice and have its structured data automatically extracted into the invoice intake flow
**Plans**: TBD

### Phase 63: UK Payments & Financial Features
**Goal**: Users can export UK contractor payments via BACS, see statutory late payment interest on overdue UK invoices, and configure German early payment discounts
**Depends on**: Phase 56 (GBP currency, UK country fields), Phase 57 (UK VAT rates for invoice amounts)
**Requirements**: PAY-01, PAY-06, PAY-07
**Success Criteria** (what must be TRUE):
  1. User can export UK contractor payments as a BACS Standard 18 Direct Credit file with correct fixed-width formatting, sort code validation, and ASCII transliteration
  2. User sees automatically calculated late payment interest on overdue UK invoices per the Late Payment of Commercial Debts Act (BoE base rate + 8% plus fixed compensation tiers)
  3. User can configure Skonto early payment discount terms on German invoices with discount percentage, discount period, and automatic discounted amount calculation with eligibility tracking
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 56 -> 57 -> 58 -> 59 -> 60 -> 61 -> 62 -> 63

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 56. Country Foundations & German i18n | v5.0 | 8/8 | Complete   | 2026-04-12 |
| 57. Government API Clients | v5.0 | 3/4 | In Progress|  |
| 58. Classification Engine & Rule Sets | v5.0 | 4/5 | In Progress|  |
| 59. Classification Documents & Chain Tracking | v5.0 | 4/4 | Complete   | 2026-04-13 |
| 60. Classification Polish | v5.0 | 0/TBD | Not started | - |
| 61. XRechnung E-Invoicing | v5.0 | 0/TBD | Not started | - |
| 62. ZUGFeRD E-Invoicing | v5.0 | 0/TBD | Not started | - |
| 63. UK Payments & Financial Features | v5.0 | 0/TBD | Not started | - |
