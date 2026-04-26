# Roadmap: Contractor Ops

## Milestones

- v1.0 MVP - Phases 1-11 (shipped 2026-03-23)
- v2.0 Platform Expansion - Phases 12-27 (shipped 2026-04-01)
- v3.0 Enterprise & Monetization - Phases 28-44 (shipped 2026-04-10)
- v4.0 International Foundation & Gulf Expansion - Phases 45-55 (shipped 2026-04-12)
- v5.0 UK & Germany Expansion - Phases 56-69 (in progress)
- v6.0 Platform Maturity & Operational Hardening - Phases 70-73 (planned)

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
- [x] **Phase 58: Classification Engine & Rule Sets** - Generic classification engine with IR35 and Scheinselbstandigkeit rule sets (completed 2026-04-13)
- [x] **Phase 59: Classification Documents & Chain Tracking** - SDS generation, IR35 chain participants, DRV audit defense documentation (completed 2026-04-13)
- [x] **Phase 60: Classification Polish** - Economic dependency alerts, reassessment triggers, DRV tracking, compliance dashboard (completed 2026-04-14)
- [x] **Phase 61: XRechnung E-Invoicing** - XRechnung CII XML generation, KoSIT validation, Leitweg-ID, Peppol UK (completed 2026-04-14)
- [x] **Phase 62: ZUGFeRD E-Invoicing** - ZUGFeRD PDF/A-3 with embedded CII XML, inbound XRechnung/ZUGFeRD parsing (completed 2026-04-16)
- [x] **Phase 63: UK Payments & Financial Features** - BACS Standard 18 export, late payment interest, Skonto discounts (completed 2026-04-25)
- [x] **Phase 65: Phase 63 Critical Bug Fixes** - Fix late-payment-interest flag key (PAY-06), Skonto amountMinor field (PAY-07), admin-boe-rate permission (CR-03), daysOverdue calculation (WR-02) (completed 2026-04-26)
- [x] **Phase 66: Phase 57 Completion & Verification** - Execute 57-04 plan (VAT tRPC routers, invoice pipeline, UI), produce Phase 57 VERIFICATION.md (completed 2026-04-26)
- [x] **Phase 67: Phase 56 & 58 Verification** - Produce Phase 56 VERIFICATION.md (country foundations), produce Phase 58 VERIFICATION.md (classification engine) (completed 2026-04-26)
- [x] **Phase 68: Skonto BG-20 XRechnung Emission Fix** - Thread Skonto term from invoice finalize through XRechnung CII generator so BG-20 Payment Terms are emitted on DE invoices with configured Skonto (closes I-1, EINV-01/02/04 partial, PAY-04 partial, F-4 broken) (completed 2026-04-26)
- [x] **Phase 69: DE Message-Key Parity Fix** - Author 32 missing DE translations introduced by Phases 63+64 (25 Payments.lateInterest.* + 1 Payments.skonto.previewLineEn + 6 Admin.ClassificationEngineFlag.*) in formal-Sie register (closes FOUND-03) (completed 2026-04-26)

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
- [x] 58-05-PLAN.md — Wave 3: SSR outcome pages (IR35 5-area + DRV traffic-light + category bars) + blocking disclaimer AlertDialog + tile on CountryComplianceSection + assessment list + print layout + Steuerberater + UK tax-adviser human-verify checkpoint
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
**Plans**: 4 plans
- [x] 60-01-PLAN.md — Wave 1: Economic dependency alerts (CLASS-07) — EconomicDependencyAlertState model + prismaRaw cross-org client + rbac-recipients helper + billing-share scan service + band state machine + daily cron (`0 2 * * *` UTC) + tRPC read router + notification types + band-chip UI
- [x] 60-02-PLAN.md — Wave 1: Reassessment triggers (CLASS-08) — ReassessmentTrigger + CronScanState models + audit-writer wiring on ContractorAssignment/Contract mutations (resolves Open Question #1) + AuditLog scan service + daily cron (`0 3 * * *` UTC) + tRPC acknowledge/dismiss router + classification.submit auto-resolve + UI chip/CTA/dismiss-dialog
- [x] 60-03-PLAN.md — Wave 2: Statusfeststellungsverfahren tracking (CLASS-09) — Statusfeststellungsverfahren model + CRUD tRPC router + 90/30/7-day expiry helper piggybacked on existing /api/cron/reminders + engagement-page panel + optional DRV_CLEARANCE_* locked phrases
- [x] 60-04-PLAN.md — Wave 3: Compliance health dashboard (CLASS-10) — escapeCsvField formula-injection hardening + classificationDashboard tRPC router (8 procedures) + CSV export (signed R2 URL, 300s TTL) + /[locale]/(dashboard)/classification/page.tsx + 7 React components (native-flex stacked bar, no chart lib)
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
**Plans**: 8 plans
- [x] 61-01-PLAN.md — Wave 0: deps install (saxon-js, libxmljs2, xslt3) + all Prisma schemas (LeitwegId, EInvoiceLifecycle*, PeppolCapabilityCache) + PeppolParticipant extension (supportsXRechnungCii) + Contractor additions + [BLOCKING] prisma db push + Leitweg-ID Zod with KoSIT fixtures + Storecove sandbox document_type_id probe + 11 RED test scaffolds + 4-locale EInvoice i18n namespace
- [x] 61-02-PLAN.md — Wave 1: XRechnung 3.0.2 CII generator (D-01, D-02) + BT-10 Leitweg-ID embed helper + §13b/§19 UStG locked-phrase integration + XRechnungDEProfile class + registry registration + package re-exports + parser stub (Phase 62)
- [x] 61-03-PLAN.md — Wave 2: validator-bundle population (KoSIT release-2026-01-31 SEF + CII D16B XSD + checksums) + three-layer validator (XSD via libxmljs2 + EN16931/XRechnung Schematron via saxon-js) + SVRL normalizer + XXE/SSRF mitigations + 4 fixture integration tests + profile .validate() wiring
- [x] 61-04-PLAN.md — Wave 1: leitweg-id-resolver service (D-06 contract-override → contractor-default → null) + leitwegIdRouter (7 procedures) + tRPC input Zod schemas + peppolParticipantPairSchema (both-or-neither constraint) + 11 multi-tenant leak tests
- [x] 61-05-PLAN.md — Wave 2: Storecove adapter format discriminator (D-09 cii-xrechnung variant) + lookupParticipantCapabilities method + PeppolCapabilityCache service (6h TTL) + peppolRouter extensions (lookupCapabilities, listParticipants) + pre-flight helpers (assertSenderParticipantActive, assertReceiverAcceptsXRechnung)
- [x] 61-06-PLAN.md — Wave 3: EInvoiceLifecycle FSM (validation + transmission tables) + einvoice-finalize service (generator + validator + R2 + atomic event write) + einvoice router extensions (finalize/revalidate/downloadXml/downloadReport/send/listByOrg/summaryForOrg) + Storecove webhook handler (DELIVERY_ACK + idempotency)
- [x] 61-07-PLAN.md — Wave 4: Settings → E-invoicing page + PeppolParticipantCard + register/deregister dialogs + status pill + LeitwegIdListCard + row + create/edit/delete dialogs + LeitwegIdInlineSelector + PeppolIdentifierFields (pair-constraint form) + contractor-profile wiring
- [x] 61-08-PLAN.md — Wave 4: Invoice list compliance column + 7 filter chips + summary tile + URL-query-param binding + InvoiceDetailTabs + full E-invoice tab (Generation/Validation/Transmission sections + ValidationLayerRow + SvrlIssueList + TransmissionEventRow + LeitwegIdResolvedInline) + all CTA wiring + human-verify checkpoint (autonomous: false)
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
**Plans**: 7 plans
- [x] 63-01-PLAN.md — Wave 1: All Prisma schema additions (8 new models + enum extensions + UK bank fields + BACS submitter fields) + [BLOCKING] prisma db push + BoE rate seed data + BACS validators (modulus check) + locked phrases (GB LPCDA + DE Skonto) + feature flags (PAY_BACS/LATE_INTEREST/SKONTO) + i18n Payments namespace
- [x] 63-02-PLAN.md — Wave 2: ASCII transliteration utility + BACS Std 18 generator (fixed-width file with VOL/HDR/detail/trailer records) + format auto-detection (GBP+UK -> BACS_STD18)
- [x] 63-03-PLAN.md — Wave 2: Late payment interest calculation service (LPCDA-compliant: statutory period rate + simple interest + compensation tiers + partial payments + waivers) + BoE rate poller + cron route
- [x] 63-04-PLAN.md — Wave 3: BACS tRPC router (preview/generate/validate/saveSubmitter) + settings page (/settings/payments/) + BACS preview Card + UK bank fields on billing profile
- [x] 63-05-PLAN.md — Wave 3: Late interest tRPC router (get/waive/revoke/claim/download) + claim PDF (React-PDF) + admin BoE rate router + admin shell + /admin/boe-rate/ page
- [x] 63-06-PLAN.md — Wave 3: Skonto eligibility service + tRPC router (upsert/delete for invoice+profile) + XRechnung BG-20 Payment Terms extension (#SKONTO#TAGE=n#PROZENT=n#)
- [x] 63-07-PLAN.md — Wave 4: All UI surfaces (late interest card + claim/waive/revoke dialogs + dashboard tile + Skonto form/banner/checkbox + invoice list columns) + human-verify checkpoint
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 56 -> 57 -> 58 -> 59 -> 60 -> 61 -> 62 -> 63 -> 64 -> 65 -> 66 -> 67 -> 68 -> 69

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 56. Country Foundations & German i18n | v5.0 | 8/8 | Complete   | 2026-04-12 |
| 57. Government API Clients | v5.0 | 3/4 | In Progress|  |
| 58. Classification Engine & Rule Sets | v5.0 | 5/5 | Complete    | 2026-04-13 |
| 59. Classification Documents & Chain Tracking | v5.0 | 4/4 | Complete    | 2026-04-13 |
| 60. Classification Polish | v5.0 | 4/4 | Complete    | 2026-04-14 |
| 61. XRechnung E-Invoicing | v5.0 | 8/8 | Complete   | 2026-04-14 |
| 62. ZUGFeRD E-Invoicing | v5.0 | 7/7 | Complete    | 2026-04-16 |
| 63. UK Payments & Financial Features | v5.0 | 7/7 | Complete    | 2026-04-26 |
| 64. Legal Compliance Hardening | v5.0 | 9/9 | Complete | 2026-04-25 |
| 65. Phase 63 Critical Bug Fixes | v5.0 | 0/1 | Not started | - |
| 66. Phase 57 Completion & Verification | v5.0 | 4/4 | Complete    | 2026-04-26 |
| 67. Phase 56 & 58 Verification | v5.0 | 2/2 | Complete    | 2026-04-26 |
| 68. Skonto BG-20 XRechnung Emission Fix | v5.0 | 5/5 | Complete    | 2026-04-26 |
| 69. DE Message-Key Parity Fix | v5.0 | 1/1 | Complete    | 2026-04-26 |

### Phase 64: Legal Compliance Hardening
**Goal**: Classification features (Phases 58-60) are completely inaccessible when the feature flag is disabled — no routes, no sidebar entries, no API endpoints, no data leakage — and when enabled after legal sign-off, all screens clearly communicate advisory-only status with escalation paths
**Depends on**: Phase 58 (classification engine), Phase 59 (SDS + DRV documents), Phase 60 (economic dependency alerts, compliance dashboard)
**Requirements**: LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05, LEGAL-06, LEGAL-07, LEGAL-08, LEGAL-09, LEGAL-10
**Success Criteria** (what must be TRUE):
  1. A feature flag `classification-engine` in Unleash gates ALL classification functionality — when disabled, the feature is completely invisible and inaccessible as if it does not exist
  2. When FF is OFF: classification sidebar nav items, contractor profile classification tabs/tiles, classification assessment wizard routes, compliance health dashboard classification sections, and economic dependency alert UI are all removed from the render tree (not hidden with CSS — not rendered at all)
  3. When FF is OFF: all classification tRPC procedures (createDraft, getDraft, saveAnswer, submit, acknowledgeDisclaimer, getLatest, getById, listByContractor, and any Phase 60 procedures) return FORBIDDEN or are unregistered, preventing API-level access even if someone crafts a direct request
  4. When FF is OFF: SDS generation, DRV defense bundle generation, and all classification document endpoints are inaccessible — no PDF generation, no R2 storage writes for classification documents
  5. When FF is OFF: economic dependency cron job skips execution entirely, no background processing occurs for classification features
  6. CI pipeline fails if any locked disclaimer constant in packages/validators/src/legal/ contains the string "PENDING" when targeting production deployment
  7. All classification outcome pages display a persistent, non-dismissible advisory banner above the verdict stating the result is guidance only and recommending professional consultation
  8. Undetermined/amber classification outcomes show a "Get Expert Help" CTA linking to adviser referral with logged escalation event
  9. SDS PDF cover page includes client name, date, approval statement, and a confirmation checkbox that the client reviewed and approved the SDS before issuing
  10. DRV Statusfeststellungsverfahren tracking panel displays an unverified-entry disclaimer and supports R2 document upload for proof of DRV decision letter
  11. Platform Terms of Service include explicit "software not legal/tax advice" language covering all classification, e-invoicing, and payment features
**Plans**: TBD
**UI hint**: yes

### Phase 65: Phase 63 Critical Bug Fixes
**Goal**: All Phase 63 tRPC routers compile and function correctly — late payment interest procedures use the correct feature flag key, Skonto monetary calculations use the correct Invoice field, and the admin BoE rate router has a registered permission
**Depends on**: Phase 63 (late-payment-interest, skonto, admin-boe-rate routers)
**Requirements**: PAY-06, PAY-07
**Gap Closure**: Closes gaps from v5.0 audit
**Success Criteria** (what must be TRUE):
  1. `late-payment-interest.ts` compiles without TypeScript errors — all 6 procedures use `requireFeatureFlag('payments.late-interest-enabled')`
  2. Skonto monetary calculations produce correct GBP/EUR amounts — `skonto.ts` line 287 uses `invoice.amountToPayMinor`
  3. `admin-boe-rate.ts` permission check is type-safe — `'admin:boe-rate'` is registered in `accessControlStatement`
  4. `daysOverdue` in late-payment-interest service is computed from `overdueStartMs` (not `dueDateMs`) for LPCDA-correct claim letters
**Plans**: TBD

### Phase 66: Phase 57 Completion & Verification
**Goal**: Government API client tRPC surface is complete and all Phase 57 requirements are formally verified
**Depends on**: Phase 57 (HmrcVatClient, ViesClient, tax-id-validation orchestrator)
**Requirements**: PAY-02, PAY-03, PAY-04, PAY-05
**Gap Closure**: Closes gaps from v5.0 audit
**Success Criteria** (what must be TRUE):
  1. `57-04-PLAN.md` is fully executed — validateVat/revalidateVat/setKleinunternehmer tRPC mutations exist, invoice pipeline applies VAT rates and KU override, UI shows validation pill/button/toggles/footer notices
  2. `57-VERIFICATION.md` exists and confirms PAY-02 (UK VAT rates), PAY-03 (HMRC validation), PAY-04 (DE VAT + Kleinunternehmer), PAY-05 (VIES validation) are all satisfied
**Plans**: TBD

### Phase 67: Phase 56 & 58 Verification
**Goal**: Country foundations (Phase 56) and classification engine (Phase 58) requirements are formally verified with VERIFICATION.md files
**Depends on**: Phase 56 (UK/DE fields, German i18n, privacy pages), Phase 58 (classification engine, IR35/DRV rule sets)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, CLASS-01, CLASS-02, CLASS-05, CLASS-11
**Gap Closure**: Closes gaps from v5.0 audit
**Success Criteria** (what must be TRUE):
  1. `56-VERIFICATION.md` exists and confirms FOUND-01..06 are all satisfied — UK/DE contractor fields validate correctly, German i18n routing works, privacy notices render for correct jurisdiction
  2. `58-VERIFICATION.md` exists and confirms CLASS-01/02/05/11 are all satisfied — classification engine accepts UK/DE rule sets, IR35 5-area scoring and DRV 20-criteria scoring produce correct outcomes, per-engagement model stores assessments independently
**Plans**: TBD

### Phase 68: Skonto BG-20 XRechnung Emission Fix
**Goal**: User-configured Skonto (early payment discount) terms on a German invoice are emitted as structured BG-20 Payment Terms inside the finalized XRechnung CII XML and inside the embedded CII XML of ZUGFeRD PDF/A-3 documents — closing the cross-phase wiring defect surfaced by the v5.0 milestone audit (I-1)
**Depends on**: Phase 61 (XRechnungDEProfile + generator), Phase 62 (ZUGFeRD reuse of XRechnung CII), Phase 63 (Skonto term resolver in `payment.ts:1213-1294`)
**Requirements**: EINV-01, EINV-02, EINV-04, PAY-04
**Gap Closure**: Closes I-1 (CRITICAL cross-phase integration), EINV-01/02/04 partial, PAY-04 partial, broken E2E flow F-4 (DE invoice → XRechnung → KoSIT → Peppol)
**Success Criteria** (what must be TRUE):
  1. `XRechnungGenerateOptions` accepts an optional `skontoTerm` field; `XRechnungDEProfile.generate()` and `generateAndValidate()` plumb it through to `generateXRechnungCii(invoice, leitwegId, skontoTerm)`
  2. `packages/api/src/services/einvoice-finalize.ts` resolves the effective Skonto term (invoice-level → billing-profile default) using the same precedence as `resolveSkontoTerm` in `payment.ts:1213-1294`, and passes it into `profile.generateAndValidate()` alongside the existing `leitwegId`
  3. A regression test asserts that finalizing a DE invoice with a configured Skonto term emits `<ram:SpecifiedTradePaymentTerms>` containing `#SKONTO#TAGE=n#PROZENT=n#` semantics in the BG-20 group, and the same assertion passes for the embedded CII inside a ZUGFeRD PDF/A-3 generation path
  4. The KoSIT 3-layer validator continues to pass for invoices both with and without Skonto terms (no regression on the existing XRechnung 3.0.2 CIUS Schematron)
**Plans**: TBD

### Phase 69: DE Message-Key Parity Fix
**Goal**: User can switch the platform to German and see complete localized copy across late-payment-interest dialogs, Skonto preview, and the Admin Classification Engine flag panel — closing the 32-key parity gap introduced by Phases 63 and 64 against the Phase 56 invariant
**Depends on**: Phase 56 (de.json formal-Sie register baseline + R-06 parity test), Phase 63 (Payments.lateInterest + Payments.skonto namespaces), Phase 64 (Admin.ClassificationEngineFlag namespace)
**Requirements**: FOUND-03
**Gap Closure**: Closes FOUND-03 (unsatisfied in v5.0 audit; 32 EN-only keys identified by GAP-67-01-01 in 56-VERIFICATION.md)
**Success Criteria** (what must be TRUE):
  1. All 25 `Payments.lateInterest.*` keys (LPCDA late-interest dialog, claim PDF copy, waiver flow) have DE translations in formal-Sie register, present in `apps/web/messages/de.json`; copy is flagged for Steuerberater + Plain operations review post-deploy per Standing Project Constraints (LOCAL-ONLY, legal sign-off deferred)
  2. The `Payments.skonto.previewLineEn` key has a DE translation matching the Skonto preview banner copy contract from Phase 63
  3. All 6 `Admin.ClassificationEngineFlag.*` keys (super-admin classification-engine flag status panel from Phase 64) have DE translations in formal-Sie register
  4. The R-06 de-locale parity test (3639 leaf-key parity assertion across en/de) passes with zero missing keys; FOUND-03 traceability flips to `Complete` after this phase
**Plans**: TBD

---

### v6.0 Platform Maturity & Operational Hardening (Planned)

**Milestone Goal:** Make the platform production-grade across all supported markets (PL, UK, DE, UAE, SA) by closing critical operational gaps — compliance document lifecycle, automated access deprovisioning, Gulf operational polish, and offboarding hardening. No new market entry; focus on reliability and security for real users.

- [ ] **Phase 70: Compliance Document Lifecycle Engine** - Per-country required document definitions, automated expiry tracking with 90/60/30/15/7-day alerts, hard payment blocking on expired critical documents, automated contractor reminders via email/portal, compliance dashboard with at-risk contractor count
- [ ] **Phase 71: Identity Provider Deprovisioning** - Google Workspace auto-suspend, Azure AD/Entra ID auto-disable, Okta SSO revocation, GitHub org member removal, Slack workspace deactivation on offboarding, full audit trail of access revocation per contractor
- [ ] **Phase 72: Gulf Operational Polish** - UAE free zone entity tracking with permitted activity scope per zone and license expiry monitoring; Saudization workforce composition dashboard with nationality tracking (visibility only, not Nitaqat band simulation or advisory)
- [ ] **Phase 73: Offboarding Hardening** - Structured knowledge transfer checklist templates per role type, IP assignment verification workflow blocking offboarding completion, documentation handover task with repo/wiki/credential links, contract clause health check flagging missing IP assignment language
