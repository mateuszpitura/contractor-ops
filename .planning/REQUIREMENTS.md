# Requirements: Contractor Ops

**Defined:** 2026-04-11
**Core Value:** The invoice-to-payment flow must work end-to-end: a contractor's invoice arrives, gets matched to their contract, routed through approval, and batched for payment — with full audit trail and zero manual tracking in spreadsheets.

## v4.0 Requirements

Requirements for International Foundation & Gulf Expansion. Each maps to roadmap phases.

### E-Invoicing Engine

- [ ] **EINV-01**: Platform has a pluggable e-invoicing engine with abstract UBL 2.1 core that country profiles plug into
- [ ] **EINV-02**: Engine supports XML generation, validation, and parsing per country profile
- [ ] **EINV-03**: Engine supports digital signature infrastructure (XML DSig) per country profile requirements
- [ ] **EINV-04**: Engine supports QR code generation per country profile requirements
- [ ] **EINV-05**: Existing KSeF integration is refactored as the first country profile in the new engine (no regression)
- [ ] **EINV-06**: Engine exposes compliance status tracking per organization per country profile

### ZATCA Fatoorah (Saudi Arabia)

- [x] **ZATCA-01**: Platform generates ZATCA-compliant UBL 2.1 XML invoices with all mandatory fields
- [x] **ZATCA-02**: Invoices are cryptographically signed using X.509 certificates (XAdES enveloped signatures)
- [x] **ZATCA-03**: Each invoice includes a TLV-encoded QR code (seller name, VAT number, timestamp, total, VAT amount)
- [x] **ZATCA-04**: Invoice hash chain is maintained — each invoice references the hash of the previous invoice per organization
- [x] **ZATCA-05**: Invoices are submitted to ZATCA Fatoora Portal API for clearance (B2B tax invoices)
- [x] **ZATCA-06**: Platform supports ZATCA device onboarding — CSR generation, CSID request, production certificate exchange
- [x] **ZATCA-07**: Platform handles ZATCA reporting for simplified invoices (B2C)

### Peppol PINT-AE (UAE)

- [ ] **PEPPOL-01**: Platform generates Peppol PINT-AE compliant UBL 2.1 XML invoices
- [ ] **PEPPOL-02**: Invoices are transmitted via a certified Accredited Service Provider (ASP) integration
- [ ] **PEPPOL-03**: Platform receives and parses inbound Peppol invoices from ASP
- [ ] **PEPPOL-04**: QR codes are generated on invoices per UAE e-invoicing requirements

### Multi-Currency

- [ ] **CURR-01**: Platform supports AED, SAR, GBP currencies alongside existing PLN and EUR
- [ ] **CURR-02**: Each organization can set its home currency
- [ ] **CURR-03**: Invoices, contracts, and payment runs operate in their specified currency with correct minor unit precision
- [ ] **CURR-04**: Exchange rates are fetched daily for reporting purposes (display-only, not FX conversion)
- [ ] **CURR-05**: All financial reports can display amounts in the organization's home currency

### VAT & Tax

- [ ] **TAX-01**: Platform supports configurable per-country VAT rates (5% UAE, 15% Saudi, existing Polish rates)
- [ ] **TAX-02**: Reverse charge is flagged on cross-border B2B invoices per country rules
- [ ] **TAX-03**: WHT calculator determines withholding tax rate based on contractor residency, service type, and treaty rates (Saudi)
- [ ] **TAX-04**: WHT certificates are generated for Saudi cross-border payments
- [ ] **TAX-05**: Organizations see VAT and WHT obligations on a compliance dashboard

### Payments

- [ ] **PAY-01**: Platform generates SWIFT pain.001 (ISO 20022) payment files for Gulf bank transfers
- [ ] **PAY-02**: Purpose codes are automatically assigned based on service category and overridable per payment
- [ ] **PAY-03**: Payment runs support multi-currency batching (group by currency)

### Arabic Localization & RTL

- [ ] **L10N-01**: Full Arabic translation of all UI strings (3rd locale alongside Polish and English)
- [ ] **L10N-02**: RTL layout support — all CSS converted to logical properties (start/end instead of left/right)
- [ ] **L10N-03**: Bidirectional text handling for mixed Arabic/English content (with proper `<bdi>` isolation)
- [ ] **L10N-04**: Charts and data visualizations render correctly in RTL mode
- [ ] **L10N-05**: Date, number, and currency formatting follows Arabic locale conventions

### Contractor Profile — Country Fields

- [ ] **PROF-01**: UAE contractor profiles include freelance permit and trade license fields (free zone vs mainland)
- [ ] **PROF-02**: Saudi contractor profiles include Freelance.sa license and commercial registration fields
- [ ] **PROF-03**: Country-specific field sets are activated per organization's country setting
- [ ] **PROF-04**: Contractor tax ID fields support per-country formats (TIN for UAE/Saudi)

### PDPL Compliance

- [ ] **PDPL-01**: Platform displays jurisdiction-specific privacy notices (UAE PDPL, Saudi PDPL)
- [ ] **PDPL-02**: Consent management UI captures and tracks user consent per data processing purpose
- [ ] **PDPL-03**: Data processing agreements are available per organization
- [ ] **PDPL-04**: Cross-border data transfer documentation is generated (standard contractual clauses)

### Multi-Region Infrastructure

- [ ] **INFRA-01**: Database deployment supports multiple regions (EU + closest available to Middle East)
- [ ] **INFRA-02**: Per-organization region routing directs data to the correct regional deployment
- [ ] **INFRA-03**: File storage (R2) supports regional buckets for document residency
- [ ] **INFRA-04**: Government API integration framework provides reusable patterns (cert auth, retry, rate limiting, sandbox/production modes, audit logging)

## v5.0 Requirements (Deferred)

### EU Wave — UK, Germany, France

- **UK-01**: IR35 status determination tracking and SDS document generation
- **UK-02**: BACS payment file export (Standard 18 format)
- **UK-03**: GBP VAT engine with reverse charge support
- **DE-01**: XRechnung/ZUGFeRD e-invoicing (EN 16931 profiles for Germany)
- **DE-02**: Scheinselbstandigkeit risk assessment engine
- **DE-03**: German UI localization
- **FR-01**: Factur-X generator with CIUS-FR extensions
- **FR-02**: PDP integration for French e-invoicing mandate
- **FR-03**: URSSAF attestation de vigilance API integration
- **FR-04**: French UI localization

## Out of Scope

| Feature | Reason |
|---------|--------|
| FX conversion / payment processing | Requires money transmission licenses per jurisdiction — let banks/Wise handle actual transfers |
| Contractor classification determination engine | Legal liability risk — store client's determination, not provide one |
| Become ZATCA-certified e-invoicing provider | 6-12 month certification, massive distraction from core product |
| Become Peppol Access Point | OpenPeppol certification requires per-region legal entity and annual audits |
| Arabic machine translation | Professional financial domain translation required, not MT |
| Open banking / payment initiation | Deferred beyond v5.0 |
| SSO/SCIM | Deferred beyond v5.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EINV-01 | Phase 45 | Pending |
| EINV-02 | Phase 45 | Pending |
| EINV-03 | Phase 45 | Pending |
| EINV-04 | Phase 45 | Pending |
| EINV-05 | Phase 45 | Pending |
| EINV-06 | Phase 45 | Pending |
| ZATCA-01 | Phase 48 | Complete |
| ZATCA-02 | Phase 48 | Complete |
| ZATCA-03 | Phase 48 | Complete |
| ZATCA-04 | Phase 48 | Complete |
| ZATCA-05 | Phase 48 | Complete |
| ZATCA-06 | Phase 48 | Complete |
| ZATCA-07 | Phase 48 | Complete |
| PEPPOL-01 | Phase 49 | Pending |
| PEPPOL-02 | Phase 49 | Pending |
| PEPPOL-03 | Phase 49 | Pending |
| PEPPOL-04 | Phase 49 | Pending |
| CURR-01 | Phase 46 | Pending |
| CURR-02 | Phase 46 | Pending |
| CURR-03 | Phase 46 | Pending |
| CURR-04 | Phase 46 | Pending |
| CURR-05 | Phase 46 | Pending |
| TAX-01 | Phase 47 | Pending |
| TAX-02 | Phase 47 | Pending |
| TAX-03 | Phase 47 | Pending |
| TAX-04 | Phase 47 | Pending |
| TAX-05 | Phase 47 | Pending |
| PAY-01 | Phase 46 | Pending |
| PAY-02 | Phase 46 | Pending |
| PAY-03 | Phase 46 | Pending |
| L10N-01 | Phase 50 | Pending |
| L10N-02 | Phase 50 | Pending |
| L10N-03 | Phase 50 | Pending |
| L10N-04 | Phase 50 | Pending |
| L10N-05 | Phase 50 | Pending |
| PROF-01 | Phase 47 | Pending |
| PROF-02 | Phase 47 | Pending |
| PROF-03 | Phase 47 | Pending |
| PROF-04 | Phase 47 | Pending |
| PDPL-01 | Phase 51 | Pending |
| PDPL-02 | Phase 51 | Pending |
| PDPL-03 | Phase 51 | Pending |
| PDPL-04 | Phase 51 | Pending |
| INFRA-01 | Phase 52 | Pending |
| INFRA-02 | Phase 52 | Pending |
| INFRA-03 | Phase 52 | Pending |
| INFRA-04 | Phase 52 | Pending |

**Coverage:**
- v4.0 requirements: 47 total
- Mapped to phases: 47
- Unmapped: 0

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after roadmap creation*
