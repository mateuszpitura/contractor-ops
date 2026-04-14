# Requirements: Contractor Ops

**Defined:** 2026-04-12
**Core Value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail.

## v5.0 Requirements

Requirements for UK & Germany market expansion. Each maps to roadmap phases.

### Country Foundations

- [ ] **FOUND-01**: User can add UK-specific contractor fields (UTR, Companies House number, VAT registration number) to contractor profiles for UK-based organizations
- [ ] **FOUND-02**: User can add German-specific contractor fields (Steuernummer, Handelsregister number, USt-IdNr, Sozialversicherungsnummer) to contractor profiles for German-based organizations
- [ ] **FOUND-03**: User can switch the platform UI to German (full i18n as third language alongside Polish and English)
- [ ] **FOUND-04**: User sees German-localized legal terminology with correct formal register (Sie, mandatory tax phrases like "Steuerschuldnerschaft des Leistungsempfängers")
- [ ] **FOUND-05**: User can view UK GDPR-compliant privacy notices and data processing information
- [ ] **FOUND-06**: User can view German GDPR-compliant privacy notices (Datenschutzerklärung) with BfDI-aligned language

### Contractor Classification

- [x] **CLASS-01**: User can run a contractor classification risk assessment using a generic pluggable engine that supports multiple country rule sets
- [x] **CLASS-02**: User can assess IR35 status for a UK contractor engagement using CEST-aligned questions across 5 assessment areas (substitution, control, financial risk, part-and-parcel, mutuality of obligation) with inside/outside/undetermined outcomes
- [x] **CLASS-03**: User can generate a Status Determination Statement (SDS) PDF containing determination outcome, reasoning per assessment area, engagement details, and dispute process
- [x] **CLASS-04**: User can track IR35 chain participants (client → agency/intermediary → contractor PSC → worker) and SDS delivery timestamps per engagement
- [x] **CLASS-05**: User can assess Scheinselbständigkeit risk for a German contractor engagement using ~20 DRV criteria across 4 categories (integration, entrepreneurial independence, personal dependency, economic dependency) with weighted risk scoring
- [x] **CLASS-06**: User can generate DRV audit defense documentation as an exportable PDF bundle (engagement structure summary, independence indicators, risk assessment history, other-client attestation)
- [ ] **CLASS-07**: User receives automated alerts when a German contractor's billing exceeds 70% (warning) or 83.33% (critical) from a single client, indicating economic dependency under Section 2 SGB VI
- [ ] **CLASS-08**: User receives automated reassessment triggers when a UK engagement materially changes (contract amendment, rate change, scope change, extension) linking to previous SDS for comparison
- [ ] **CLASS-09**: User can track Statusfeststellungsverfahren (DRV clearance procedure) applications with filing date, DRV reference, outcome, validity period, and expiry reminders
- [ ] **CLASS-10**: User can view a per-market compliance health dashboard showing IR35 assessment coverage, Scheinselbständigkeit risk distribution, overdue reassessments, and economic dependency alerts
- [ ] **CLASS-11**: Classification assessments are stored per-engagement (not per-contractor), supporting contractors with multiple concurrent engagements having independent assessments

### E-Invoicing

- [ ] **EINV-01**: User can generate XRechnung-compliant e-invoices (EN 16931 with German CIUS rules) in CII XML syntax
- [ ] **EINV-02**: User can generate ZUGFeRD e-invoices as PDF/A-3 documents with embedded CII XML at EN 16931 (COMFORT) profile level
- [ ] **EINV-03**: User can receive and parse incoming XRechnung and ZUGFeRD invoices, extracting structured data into the invoice intake flow
- [ ] **EINV-04**: User can validate generated e-invoices against KoSIT's three-layer validation (XSD schema, EN 16931 Schematron, XRechnung-specific Schematron)
- [ ] **EINV-05**: User can manage Leitweg-IDs for German B2G (public sector) invoicing with per-contractor or per-contract Leitweg-ID storage
- [ ] **EINV-06**: User can send e-invoices to UK public sector recipients via Peppol BIS Billing 3.0, reusing the existing Storecove ASP integration
- [ ] **EINV-07**: User can view e-invoicing compliance status per organization showing which invoices are EN 16931 compliant and which need attention

### Payments & Financial

- [ ] **PAY-01**: User can export UK contractor payments as BACS Standard 18 Direct Credit files with correct fixed-width formatting, sort code validation, and ASCII transliteration for non-ASCII characters
- [ ] **PAY-02**: User can apply UK VAT rates (20% standard, 5% reduced, 0% zero-rated) to invoices for UK-based organizations
- [ ] **PAY-03**: User can validate UK VAT registration numbers via HMRC API
- [ ] **PAY-04**: User can apply German VAT rates (19% standard, 7% reduced) with Kleinunternehmerregelung exemption flag and reverse charge labeling ("Steuerschuldnerschaft des Leistungsempfängers")
- [ ] **PAY-05**: User can validate German USt-IdNr via VIES API with qualified confirmation response
- [ ] **PAY-06**: User sees automatically calculated late payment interest on overdue UK invoices per the Late Payment of Commercial Debts Act (BoE base rate + 8% + fixed compensation of £40/£70/£100)
- [ ] **PAY-07**: User can configure Skonto (early payment discount) terms on German invoices with discount percentage and discount period, with automatic discounted amount calculation and eligibility tracking based on payment date

### Legal Compliance Hardening

- [ ] **LEGAL-01**: Classification features (IR35 assessment, Scheinselbständigkeit assessment, SDS generation, DRV defense bundle) are gated behind a feature flag that prevents production access until all locked disclaimer constants are updated from PENDING to APPROVED status
- [ ] **LEGAL-02**: CI pipeline includes a deployment gate that fails the production build if any locked disclaimer constant in packages/validators/src/legal/ contains "PENDING"
- [ ] **LEGAL-03**: All classification outcome pages display a persistent, non-dismissible advisory banner above the verdict recommending consultation with a qualified UK tax adviser (IR35) or Steuerberater (Scheinselbständigkeit) before making business decisions
- [ ] **LEGAL-04**: Undetermined or amber classification outcomes display a "Get Expert Help" call-to-action with adviser referral, and the platform logs an escalation event for audit trail
- [ ] **LEGAL-05**: SDS PDF includes a cover page with client name, date, approval statement, and confirmation that the client reviewed and approved the determination before issuing it to HMRC or chain participants
- [ ] **LEGAL-06**: DRV Statusfeststellungsverfahren tracking panel displays an unverified-entry disclaimer for manually entered records and supports R2 document upload for proof of the actual DRV decision letter
- [ ] **LEGAL-07**: Platform Terms of Service include explicit "software not legal or tax advice" language covering classification assessments, e-invoicing generation, payment file exports, and interest calculations
- [ ] **LEGAL-08**: When the `classification-engine` feature flag is OFF, all classification UI is completely removed from the render tree — no sidebar nav items, no contractor profile classification tabs/tiles, no wizard routes, no compliance dashboard classification sections, no economic dependency alert UI — the feature is invisible as if it does not exist
- [ ] **LEGAL-09**: When the `classification-engine` feature flag is OFF, all classification tRPC procedures return FORBIDDEN or are unregistered, all classification document generation endpoints are inaccessible, and no background processing (economic dependency cron) executes — zero API-level access even via direct requests
- [ ] **LEGAL-10**: When the `classification-engine` feature flag is ON, it requires that all locked disclaimer constants have been updated from PENDING to APPROVED — the flag cannot be enabled while disclaimers are unsigned

## v5.x Requirements

Deferred to future release. Tracked but not in current roadmap.

### UK Advanced Payments

- **PAY-F01**: User can submit UK payments via Faster Payments (ISO 20022) for same-day settlement

### Construction Industry

- **PAY-F02**: User can flag UK construction industry contractors for CIS deduction tracking

### Extended Classification

- **CLASS-F01**: User can request pre-filled Statusfeststellungsverfahren application forms for manual submission to DRV
- **CLASS-F02**: User can view consolidated classification status across multiple jurisdictions for contractors operating in both UK and Germany

## Out of Scope

| Feature | Reason |
|---------|--------|
| Binding IR35 determinations | Legal liability — tool assists decision-making, not replaces legal advice |
| Automated DRV submission | No public API; requires personal authentication and wet signatures |
| MTD VAT filing | Accounting software territory (Xero, QuickBooks) — we validate and export |
| German payroll processing | Full payroll is DATEV/Personio territory — we flag risk and hand off |
| CIS deduction processing | Construction niche, significant complexity for small segment — defer |
| Become KoSIT XRechnung validator | Use their open-source validator; don't maintain rule updates |
| Faster Payments (v5.0) | Research showed medium complexity; BACS covers batch payments — defer to v5.x |
| Multi-country consolidated assessment | UK and Germany are separate legal frameworks; combined assessment would be legally meaningless |
| France market expansion (Factur-X, PDP, URSSAF, French i18n, salariat déguisé, e-reporting) | Requires certified PDP partner (12-18 month certification); no partner signed — non-deliverable until partnership secured |
| Cross-border EU compliance (A1 certs, PE risk, multi-jurisdiction reverse charge automation) | Serves subset of pan-EU clients; not a market-entry requirement — revisit after UK+DE customers |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 56 | Pending |
| FOUND-02 | Phase 56 | Pending |
| FOUND-03 | Phase 56 | Pending |
| FOUND-04 | Phase 56 | Pending |
| FOUND-05 | Phase 56 | Pending |
| FOUND-06 | Phase 56 | Pending |
| CLASS-01 | Phase 58 | Complete |
| CLASS-02 | Phase 58 | Complete |
| CLASS-03 | Phase 59 | Complete |
| CLASS-04 | Phase 59 | Complete |
| CLASS-05 | Phase 58 | Complete |
| CLASS-06 | Phase 59 | Complete |
| CLASS-07 | Phase 60 | Pending |
| CLASS-08 | Phase 60 | Pending |
| CLASS-09 | Phase 60 | Pending |
| CLASS-10 | Phase 60 | Pending |
| CLASS-11 | Phase 58 | Pending |
| EINV-01 | Phase 61 | Pending |
| EINV-02 | Phase 62 | Pending |
| EINV-03 | Phase 62 | Pending |
| EINV-04 | Phase 61 | Pending |
| EINV-05 | Phase 61 | Pending |
| EINV-06 | Phase 61 | Pending |
| EINV-07 | Phase 61 | Pending |
| PAY-01 | Phase 63 | Pending |
| PAY-02 | Phase 57 | Pending |
| PAY-03 | Phase 57 | Pending |
| PAY-04 | Phase 57 | Pending |
| PAY-05 | Phase 57 | Pending |
| PAY-06 | Phase 63 | Pending |
| PAY-07 | Phase 63 | Pending |
| LEGAL-01 | Phase 64 | Pending |
| LEGAL-02 | Phase 64 | Pending |
| LEGAL-03 | Phase 64 | Pending |
| LEGAL-04 | Phase 64 | Pending |
| LEGAL-05 | Phase 64 | Pending |
| LEGAL-06 | Phase 64 | Pending |
| LEGAL-07 | Phase 64 | Pending |
| LEGAL-08 | Phase 64 | Pending |
| LEGAL-09 | Phase 64 | Pending |
| LEGAL-10 | Phase 64 | Pending |

**Coverage:**
- v5.0 requirements: 41 total
- Mapped to phases: 41/41
- Unmapped: 0

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-14 after Phase 64 (Legal Compliance Hardening) added to v5.0 milestone*
