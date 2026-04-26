# Project Research Summary

**Project:** v5.0 UK & Germany Market Expansion
**Domain:** UK IR35 compliance, German Scheinselbstaendigkeit, EN 16931 e-invoicing (XRechnung/ZUGFeRD), BACS payments, HMRC/VIES VAT validation, German i18n
**Researched:** 2026-04-12
**Confidence:** MEDIUM (codebase analysis HIGH; external regulatory API specifics and 2026 standard versions MEDIUM; VIES REST availability LOW)

## Executive Summary

v5.0 is a compliance-heavy market expansion that adds two new jurisdictions — UK and Germany — to the existing multi-market contractor operations platform. The defining architectural investment is a generic contractor classification engine (analogous to the v4.0 e-invoicing engine) that treats IR35 and Scheinselbstaendigkeit as pluggable rule sets. This pattern is already proven in the codebase: the e-invoicing engine's `EInvoiceProfile` interface, the gov-api `GovApiClient` base class, and the country-fields JSON/Zod pattern all extend naturally to the new domains with minimal friction. Crucially, the JS/TS ecosystem has no mature libraries for XRechnung, ZUGFeRD, BACS Standard 18, IR35 determination, or Scheinselbstaendigkeit — everything must be built from specification. Only one new runtime dependency (`pdf-lib`) is required for the entire milestone.

The highest-risk work is the ZUGFeRD PDF/A-3 pipeline (embedding EN 16931-compliant CII XML into a PDF/A-3 archival container is a strict compliance requirement with limited Node.js tooling) and the classification engines (which carry existential legal liability if framed incorrectly — the tools must present risk assessments with mandatory disclaimers, never binding determinations). UK case law (Atholl House 2022, PGMOL 2024) and DRV audit precedent are unambiguous on this point. Both require careful design decisions before implementation begins. XRechnung, BACS, and German i18n are all extensions of proven patterns and carry substantially lower execution risk.

The recommended build order starts with country field foundations and i18n (zero external dependencies), then government API clients (start HMRC developer hub registration immediately — approval takes weeks), then the classification engine (the key v5.0 differentiator), then e-invoicing profiles (XRechnung first, ZUGFeRD second), then payment export. Legal disclaimer design and German legal terminology review by a Steuerberater must happen before any user-facing implementation — not as polish at the end.

## Key Findings

### Recommended Stack

The project needs only one new runtime dependency: `pdf-lib@^1.17.1` for ZUGFeRD PDF/A-3 generation. Every other capability is satisfied by existing packages (`fast-xml-parser`, `xml-crypto`, `zod`, `next-intl`, `node-forge`) or direct HTTP calls via `fetch` (HMRC VAT API, VIES REST). A new workspace package `@contractor-ops/classification` is required for the classification engine; its only dependency is `zod` (already in the workspace). `soap@^1.1.0` is a conditional second dependency, added only if VIES REST API proves unreliable in production.

The `pdf-lib` PDF/A-3b capabilities must be verified during implementation with a proof-of-concept — the library can manipulate PDFs but PDF/A-3 compliance (XMP metadata, ICC color profiles, Associated Files mechanism) may require manual `PDFDict`/`PDFArray` work. If `pdf-lib` cannot meet requirements, the fallback is Apache PDFBox called as a child process.

**Core technologies:**
- `fast-xml-parser@^5.5.9`: UBL 2.1 XML for XRechnung and CII XML for ZUGFeRD — already installed, same pattern as Peppol-AE and ZATCA generators
- `xml-crypto@^6.0.0`: XAdES-BES digital signatures for XRechnung — already installed, adapt ZATCA signer from ECDSA-SHA256 to RSA-SHA256
- `pdf-lib@^1.17.1` (NEW): PDF/A-3b generation for ZUGFeRD — pure JS, Vercel-compatible, the only viable Node.js option for PDF/A-3 with AF support
- `zod@^3.23.0`: IR35 questionnaire, Scheinselbstaendigkeit assessment, BACS format, UK/DE country fields — already installed everywhere
- `next-intl@^4.8.3`: German `de` locale requires only a config change and `de.json` translation file — no version bump needed
- Direct `fetch` + `GovApiClient`: HMRC VAT API and VIES REST; no SDK exists for either; both fit the existing retry/rate-limit/audit-logging pattern

### Expected Features

**Must have (P0 table stakes for v5.0 launch):**
- Generic contractor classification engine — abstract framework for IR35 and Scheinselbstaendigkeit rule sets; the architectural investment of v5.0, enabling future France URSSAF and Netherlands DBA as incremental additions
- IR35 rule set — CEST-aligned assessment (5 areas: personal service, control, financial risk, part-and-parcel, MOO), risk scoring, inside/outside/undetermined outcomes with mandatory human sign-off
- Status Determination Statement (SDS) generation + chain participant tracking — legal requirement under UK off-payroll rules; must include reasoning per assessment area, dispute process, and delivery timestamps
- Scheinselbstaendigkeit rule set — DRV-aligned assessment (~20 criteria, 4 categories), weighted risk scoring, traffic-light outcomes
- DRV audit defense documentation — exportable PDF bundle with assessment history, independence indicators, contractor revenue attestation
- Economic dependency monitoring — billing concentration tracking with 70%/83.33% threshold alerts (5/6 rule per Section 2 SGB VI)
- XRechnung e-invoicing profile — EN 16931 + BR-DE-* business rules, Leitweg-ID handling (B2G only, private sector uses order reference in BT-10), KoSIT Schematron validation
- ZUGFeRD e-invoicing profile — PDF/A-3b with embedded CII XML (`factur-x.xml`), EN 16931 COMFORT level target, veraPDF-validated output
- BACS Standard 18 export — fixed-width ASCII payment file for UK domestic batch payments
- UK + German VAT rates and validation — UK (20%/5%/0%) via HMRC API; German (19%/7%/0%) via VIES
- UK + German contractor profile fields — UTR, Companies House number (UK); Steuernummer, Handelsregister, USt-IdNr (DE)
- German i18n — full `de` locale with locked legal terminology constants (tax law phrases must never be in translatable strings)

**Should have (P1 competitive differentiators, add after market validation):**
- IR35 reassessment triggers — auto-detect material changes from contract amendments, rate changes, extensions
- UK late payment interest calculator — statutory interest (BoE base rate + 8%) plus fixed compensation tiers under Late Payment of Commercial Debts Act 1998
- German Skonto support — early payment discount terms (2%/10 days, net 30 is German B2B standard)
- Statusfeststellungsverfahren tracking — DRV clearance procedure application status management
- Compliance health dashboard (UK/DE) — aggregated classification coverage, e-invoicing status, overdue reassessments, economic dependency alerts
- Peppol BIS UK profile — low marginal effort given existing Peppol PINT-AE; trigger: NHS/government contract customer

**Defer to v6+:**
- Faster Payments API — requires banking partnership; BACS covers the MVP
- France URSSAF / Netherlands DBA classification rule sets — prove the engine pattern with UK+DE first
- MTD VAT bridging — accounting software territory (Xero, FreeAgent)
- Automated Statusfeststellungsverfahren DRV submission — no public API; pre-filled form generation is the correct alternative

**Anti-features (explicitly do not build):**
- Definitive IR35 determination — platform cannot carry legal liability for determinations; always frame as risk assessment requiring human sign-off
- German payroll processing for reclassified contractors — DATEV/Personio territory; generate a handoff package instead
- KoSIT XRechnung validator rebuilt in-house — use KoSIT's open-source Java validator; tracking Schematron changes across releases is significant ongoing burden
- CIS (Construction Industry Scheme) deductions — niche construction payroll, out of scope

### Architecture Approach

The v5.0 architecture is entirely additive. Existing patterns — country profile plugins, capability interfaces, format detection routing, and country fields JSON/Zod — absorb all new domains without engine changes. The only structural addition is the new `packages/classification` workspace package, which mirrors the `packages/einvoice` pattern exactly. The e-invoicing pipeline requires one surgical enhancement: an optional `Embeddable` capability interface for ZUGFeRD's PDF/A-3 embed step, following the same pattern as the existing `Signable` and `QRCodeable` capabilities. Classification is stored per engagement (not per contractor) — a single contractor can have independent IR35 (UK) and Scheinselbstaendigkeit (DE) assessments for different engagements.

**Major components:**
1. `packages/classification` (NEW) — generic `ClassificationEngine` with pluggable `ClassificationRuleSet` interface; IR35 and Scheinselbstaendigkeit are the first two rule sets; SDS/DRV document generators and `ClassificationAssessment` DB model live here
2. `packages/einvoice` (EXTEND) — new `xrechnung/` and `zugferd/` country profiles; `Embeddable` capability interface added to pipeline; `pdf-embedder.ts` for ZUGFeRD PDF/A-3
3. `packages/gov-api` (EXTEND) — `HmrcVatClient` and `ViesClient` subclassing `GovApiClient`; async validation pattern, 30-day result caching, manual override for VIES downtime
4. `packages/api/services/payment-export` (EXTEND) — `generateBacsStd18()` with ASCII transliteration, 18-char truncation, banking day calendar; BACS format detection rule (GBP + GB IBAN -> `BACS_STD18`)
5. `packages/validators` (EXTEND) — `GB` and `DE` schemas added to `countryFieldsSchemaMap`; UK/DE TIN validators (UTR checksum, Steuernummer regional format, USt-IdNr check digit)
6. `packages/db` (EXTEND) — new `classification.prisma`; `BACS_STD18` enum value; UK/DE VAT rate seed data
7. `apps/web/messages/de.json` (NEW) — German translations with locked legal terminology constants (non-translatable tax law phrases stored as code constants, not in the translation file)

### Critical Pitfalls

1. **IR35 tool presented as legally binding** — Never show "IS inside/outside IR35." Always frame as risk assessment with indicators consistent with a status. Require acknowledgement disclaimers before each determination, store full questionnaire evidence in the SDS (not just the result), and version-stamp with regulatory rules version. Even HMRC's CEST tool is not binding; Atholl House 2022 and PGMOL 2024 both overturned CEST-aligned determinations.

2. **ZUGFeRD PDF/A-3 embedding done incorrectly** — Attaching XML to a PDF is not ZUGFeRD compliance. The PDF must be ISO 19005-3 (PDF/A-3b), the XML must use the Associated Files (AF) mechanism in the document catalog, the filename must be exactly `factur-x.xml`, and XMP metadata must declare the ZUGFeRD profile and conformance level. Validate all output with veraPDF before shipping.

3. **EN 16931 Schematron validation incomplete** — XSD schema validation is not sufficient. EN 16931 has ~170 Schematron business rules (BR-XX) plus ~26 German-specific rules (BR-DE-XX). Invoices that appear valid locally will be rejected by receiving systems and government portals. Run all three validation layers: XSD schema + EN 16931 Schematron + XRechnung CIUS Schematron. Use KoSIT reference invoices for the test suite.

4. **Scheinselbstaendigkeit tool creating false security** — DRV audits are holistic assessments, not checklists. The 5/6 rule (83.33% income concentration) is a hard automatic alert that must be monitored in real time from billing data — it is the single most common DRV audit trigger. A "LOW risk" score does not constitute legal compliance. Include a German-language legal disclaimer: "Diese Risikobewertung ersetzt keine rechtliche Beratung."

5. **BACS character encoding and field constraints** — BACS Standard 18 accepts only ASCII (0x20-0x7E). Contractor names with umlauts, Polish diacritics, or apostrophes cause full-file rejection. Implement `stripDiacritics()` + `.toUpperCase()`, truncate names to 18 characters with an audit trail showing original vs truncated, validate sort codes against EISCD structure, and calculate processing dates on banking days only (exclude weekends and UK bank holidays). Include contra record in every batch.

6. **VIES treated as a reliable real-time service** — VIES has approximately 95% availability. Never block user flows on VIES validation. Validate German USt-IdNr format locally first (DE + 9 digits + check digit algorithm), then validate asynchronously, cache results for 30 days, and allow manual override when VIES is unavailable. HMRC API validates UK VAT numbers separately — never send UK numbers to VIES.

7. **German legal terminology translated informally** — Tax law phrases like "Steuerschuldnerschaft des Leistungsempfaengers" (reverse charge, Section 14a(5) UStG) must appear verbatim on invoices. These are legal citations, not UI copy. Store them as locked constants in `packages/i18n/glossary/de-legal.ts`, not in `de.json` where translators could edit them. Use formal "Sie" consistently. Have a German Steuerberater review all tax-related strings before launch.

8. **HMRC OAuth and fraud prevention headers** — HMRC requires fraud prevention headers (Gov-Client-Public-IP, Gov-Client-Timezone, etc.) on every API call. OAuth access tokens expire after 4 hours. Sandbox behaves differently from production. Register on HMRC developer hub early — the approval process can take weeks.

## Implications for Roadmap

Based on the dependency graph identified in ARCHITECTURE.md, combined with feature priorities from FEATURES.md and pitfall phase mappings from PITFALLS.md, a 6-phase structure is recommended. Each phase delivers standalone value while satisfying prerequisites for the next.

### Phase 1: Country Field Foundations + i18n
**Rationale:** Zero external dependencies. Country fields, VAT rates, and i18n are prerequisites for classification, e-invoicing, and payment export. Fastest path to a testable foundation. German legal terminology must be locked before any invoice generation begins — this phase is the correct place to do it.
**Delivers:** UK/DE contractor profile fields (UTR, Companies House, Steuernummer, Handelsregister, USt-IdNr), UK/DE VAT rates in TaxRate table, German `de` locale in next-intl, locked German legal terminology constants (`de-legal.ts`), Zod validators for UK/DE tax identifiers (UTR checksum, Steuernummer regional formats, GB IBAN structure), DB migration for `classification.prisma` (structure ready for Phase 3). Commission German Steuerberater review during this phase.
**Addresses:** UK/DE contractor profile fields, German i18n, UK/DE VAT rates (P0 table stakes)
**Avoids:** German legal terminology pitfall — lock phrases before any German invoice or compliance document is generated

### Phase 2: Government API Clients (HMRC + VIES)
**Rationale:** Needed by Phase 3 (classification validates contractor tax IDs before assessment) and Phase 4 (e-invoicing validates VAT numbers on invoices). No dependencies beyond Phase 1 country fields. HMRC developer hub registration must be initiated during Phase 1 planning — do not wait until Phase 2 starts.
**Delivers:** `HmrcVatClient` extending `GovApiClient` (UK VAT validation, OAuth 2.0, fraud prevention headers, 2 req/s rate limiting), `ViesClient` extending `GovApiClient` (EU USt-IdNr async-only validation, 30-day caching, manual override when unavailable), `tax.validateUkVat` and `tax.validateEuVat` tRPC procedures.
**Uses:** `GovApiClient` base class (retry, rate limiting, audit logging), `zod` response schemas, existing encrypted credential store for OAuth tokens
**Avoids:** HMRC OAuth/fraud-prevention-header pitfall; VIES reliability pitfall (async validation, never block flows)

### Phase 3: Contractor Classification Engine
**Rationale:** The key v5.0 differentiator. Architecturally independent of e-invoicing, so it ships marketable value early. The generic engine design is the architectural investment that enables France URSSAF and Netherlands DBA as low-cost future additions. Must be designed as a risk assessment framework from the first design document — retrofitting disclaimers and human-sign-off flows after implementation is much harder.
**Delivers:** `packages/classification` new package — `ClassificationEngine`, `ClassificationRuleSet` interface, IR35 rule set (CEST-aligned, 5 areas, ~25 questions, mandatory disclaimer + acknowledgement), SDS generation with chain participant tracking and delivery timestamps, Scheinselbstaendigkeit rule set (DRV-aligned, ~20 criteria, 4 categories), DRV audit defense documentation bundle, economic dependency monitoring (5/6 rule with real-time billing alerts), `ClassificationAssessment` DB model (per-engagement, not per-contractor), contractor profile risk badge and compliance item integration, reassessment notification hooks.
**Avoids:** IR35 legal liability pitfall (risk assessment framing, disclaimers, human sign-off, full evidence storage); Scheinselbstaendigkeit false security pitfall (5/6 rule as hard real-time alert, holistic scoring); dual classification confusion pitfall (per-engagement data model, jurisdiction-separated UI)

### Phase 4: EN 16931 E-Invoicing (XRechnung + ZUGFeRD)
**Rationale:** Depends on Phase 1 (VAT rates, country fields), Phase 2 (VAT number validation on invoices). The most technically complex phase. Build XRechnung first (pure UBL 2.1 XML — a familiar pattern from Peppol-AE) and fully validate it before starting ZUGFeRD. ZUGFeRD (new CII syntax + PDF/A-3 tooling uncertainty) is the hardest work in the milestone; beginning it with a pdf-lib proof-of-concept reduces risk significantly.
**Delivers:** `Embeddable` capability interface in einvoice pipeline types; XRechnung profile (UBL 2.1 generator adapted from Peppol-AE, BR-DE-* validation, conditional Leitweg-ID for B2G vs order reference for B2B, XAdES-BES RSA-SHA256 signer adapted from ZATCA signer); ZUGFeRD profile (CII XML generator — new syntax, EN 16931 COMFORT level, PDF/A-3b embedding via pdf-lib, `factur-x.xml` AF attachment, veraPDF-validated output); three-layer validation (XSD + EN 16931 Schematron + XRechnung CIUS Schematron); KoSIT reference invoice test suite.
**Uses:** `fast-xml-parser` (both UBL and CII XML), `xml-crypto` (XRechnung XAdES-BES), `pdf-lib` (ZUGFeRD PDF/A-3b)
**Avoids:** Incomplete Schematron validation pitfall; ZUGFeRD AF mechanism pitfall; Leitweg-ID misuse pitfall (B2G/B2B distinction)

### Phase 5: UK Payment Infrastructure (BACS)
**Rationale:** Depends only on Phase 1 (GBP currency and GB country code). Follows the proven Elixir generator pattern. Low-risk and fast to ship. Does not block Phase 3 or Phase 4, so it can proceed in parallel if team capacity allows.
**Delivers:** `generateBacsStd18()` in `payment-export.ts` (VOL1/HDR1/HDR2/UHL1/data records/EOF1/EOF2/UTL1 structure, ASCII transliteration, 18-char name truncation with audit trail, contra record, banking day calendar for processing dates), BACS format detection rule (GBP + GB IBAN -> `BACS_STD18`), `PaymentExportFormat.BACS_STD18` enum value, pre-validation step with per-field error messages, BACS bureau sandbox test submission.
**Avoids:** BACS character encoding and field constraint pitfall (ASCII-only, strict column positions, contra records, banking day calendar)

### Phase 6: Compliance Polish + v5.x Features
**Rationale:** Requires all previous phases to be functional. Compliance health dashboard aggregates data that only exists once Phases 3 and 4 are live. IR35 reassessment triggers require the classification engine to have real assessments against which to detect material changes.
**Delivers:** UK/DE compliance health dashboard (classification coverage %, e-invoicing compliance status, overdue reassessments, economic dependency alerts), IR35 reassessment triggers (material change detection from contract amendments, rate period changes, extensions), UK late payment interest calculator (BoE base rate + 8%, GBP 40/70/100 fixed compensation tiers), German Skonto support (early payment discount terms on invoices, payment date eligibility tracking), Statusfeststellungsverfahren tracking (DRV clearance application status, validity period reminders), UK GDPR and German BDSG compliance adaptations.
**Addresses:** P1 differentiator features from FEATURES.md

### Phase Ordering Rationale

- Phase 1 first: Country fields, VAT rates, and i18n have zero external dependencies and unblock every subsequent phase. German terminology review should be commissioned here to avoid a last-minute scramble before Phase 4.
- Phase 2 early: HMRC developer hub registration (initiated in Phase 1 planning) has an approval lag of weeks. Delivering the client in Phase 2 prevents it from blocking Phase 4. VIES reliability design decisions must be made here to establish the async-only pattern.
- Phase 3 before Phase 4: Classification is the primary market differentiator and architecturally independent of e-invoicing. Shipping it first demonstrates market value and proves the new package pattern before tackling the more complex e-invoicing work.
- Phase 4 internally ordered: XRechnung (familiar UBL pattern, low risk) must be implemented and validated before ZUGFeRD (new CII syntax, PDF/A-3 tooling uncertainty). Do not parallelize these two profiles within Phase 4.
- Phase 5 parallel-eligible: BACS is a straightforward extension with no dependency on classification or e-invoicing. If team capacity allows, it can run in parallel with Phase 3 or Phase 4.
- Phase 6 last: Compliance polish and v5.x features depend on all functional pieces being in place. Reassessment triggers cannot be tested without real classification assessments.

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:

- **Phase 3 (Classification Engine):** Legal liability framing for IR35 tools is nuanced and case-law-driven. Recommend a focused research sprint on CEST question bank alignment (all 5 assessment areas, ~25 questions), DRV Betriebspruefung documentation requirements, and SDS statutory content requirements before implementation begins. The distinction between advisory tool and binding determination must be designed in from the first wireframe.
- **Phase 4 (EN 16931 E-Invoicing — ZUGFeRD sub-phase):** Before committing to `pdf-lib` for PDF/A-3b, run a proof-of-concept that creates a minimal PDF/A-3b document with an Associated File entry and validates it with veraPDF. If this fails, the fallback path (Apache PDFBox as child process, or commercial PDF/A service) needs to be selected before implementation begins. Also confirm the exact XRechnung CIUS version in effect in 2026 from KoSIT artifacts — the `customizationID` URI is version-specific.
- **Phase 2 (HMRC Client):** Verify whether the VAT number validation endpoint uses server-token (application-level) or user-restricted OAuth before building the auth flow. HMRC documentation is spread across multiple portals and is frequently outdated; sandbox verification is mandatory.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Country Fields + i18n):** Adding `GB`/`DE` Zod schemas and a `de.json` locale file are mechanical extensions of confirmed existing patterns. No research needed beyond confirming tax identifier formats (UTR, Steuernummer) from official sources.
- **Phase 5 (BACS):** Fixed-width format generation follows the existing Elixir generator pattern. The main risk (character encoding) is well-understood and has a clear mitigation strategy. No research phase needed — implement against the BACS Standard 18 spec with careful testing against the bureau sandbox.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | One new dependency (pdf-lib). All other libraries confirmed present in codebase. pdf-lib PDF/A-3b AF mechanism capabilities need implementation-time proof-of-concept verification. |
| Features | MEDIUM | IR35 and Scheinselbstaendigkeit regulatory frameworks are well-documented. XRechnung version (3.0.x) and ZUGFeRD version (2.3.x) specifics could not be verified against live KoSIT/ZUGFeRD.de sources in 2026. |
| Architecture | HIGH | Based on direct codebase analysis. Extension points (EInvoiceProfile, GovApiClient, payment-export generators, country-fields map) are confirmed existing patterns. New package structure mirrors proven einvoice layout. |
| Pitfalls | MEDIUM | Legal pitfalls (IR35 liability, German terminology) are grounded in case law and statute. Technical pitfalls (BACS format, VIES reliability) based on training data without live 2026 verification. HMRC OAuth flow type needs sandbox confirmation. |

**Overall confidence:** MEDIUM-HIGH. Architecture and stack decisions are high-confidence (codebase-driven). Feature and regulatory specifics are MEDIUM — implementation must include a verification step against live HMRC developer docs, KoSIT validator artifacts, and ZUGFeRD specification documents before building.

### Gaps to Address

- **VIES REST API production availability:** Confirm `https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number` is production-stable in 2026. Decision gate: add `soap@^1.1.0` if REST is beta-only or unreliable. Verify at Phase 2 start before building the client.
- **pdf-lib PDF/A-3b compliance:** Run a proof-of-concept at Phase 4 start verifying that pdf-lib can set `pdfaid:part=3` / `pdfaid:conformance=B` XMP metadata, embed an ICC output intent profile, and create AF (Associated Files) entries via low-level `PDFDict`/`PDFArray` APIs. If it cannot, select fallback (Apache PDFBox child process or commercial PDF/A service) before implementation.
- **XRechnung CIUS version (2026):** The exact minor version and its Schematron rule set must be confirmed from KoSIT artifacts (github.com/itplr-kosit/validator-configuration-xrechnung) at Phase 4 start. The `customizationID` URI is version-specific and must not be hardcoded without a version config.
- **HMRC developer hub registration timeline:** OAuth app approval can take weeks. Registration must be initiated during Phase 1 planning to avoid blocking Phase 2 delivery.
- **BACS Standard 18 specification access:** The full spec is not freely available online — Vocalink/Pay.UK charges for it. Must be obtained through the client's BACS bureau or sponsoring bank before Phase 5 implementation begins.
- **German Steuerberater review:** German tax law phrases must be reviewed by a qualified German tax professional before any German-language invoice or compliance document is generated. Commission this review during Phase 1 and complete before Phase 4 begins.

## Sources

### Primary (HIGH confidence — codebase analysis)
- `packages/einvoice/src/types/profile.ts` — EInvoiceProfile interface and capability interface pattern
- `packages/einvoice/src/engine/pipeline.ts` — existing pipeline structure and Embeddable hook point
- `packages/einvoice/src/profiles/zatca/signer.ts` — XAdES-BES implementation (RSA-SHA256 adaptation for XRechnung)
- `packages/einvoice/src/profiles/peppol-ae/generator.ts` — UBL 2.1 generator pattern (direct XRechnung template)
- `packages/gov-api/src/client.ts` — GovApiClient base class (retry, rate limiting, audit logging)
- `packages/api/src/services/payment-export.ts` — payment generator pattern (BACS follows Elixir generator)
- `packages/api/src/services/payment-format-detection.ts` — format detection routing (BACS rule addition point)
- `packages/validators/src/country-fields.ts` — countryFieldsSchemaMap pattern (GB/DE schemas slot in here)
- `apps/web/src/i18n/routing.ts` — next-intl locale configuration (add `de` to locales array)
- `packages/db/prisma/schema/payment.prisma` — PaymentExportFormat enum (add BACS_STD18)

### Secondary (MEDIUM confidence — training data, established standards)
- EN 16931 / XRechnung 3.0.x / ZUGFeRD 2.3.x standard specifications
- HMRC CEST assessment criteria (5 areas: personal service, control, financial risk, part-and-parcel, mutuality of obligation)
- DRV Scheinselbstaendigkeit assessment criteria (~20 criteria, 4 categories: integration, independence, personal dependency, economic dependency)
- BACS Standard 18 fixed-width format specification (VOL1/HDR1/HDR2/UHL1/data/UTL1/EOF structure)
- HMRC VAT validation REST API (`/organisations/vat/check-vat-number/lookup/{vatNumber}`)
- IR35 case law: Atholl House Productions Ltd v HMRC [2022] CSIH 3; PGMOL v HMRC [2024] UKSC 29
- Section 2 SGB VI (5/6 economic dependency rule)
- Section 14a(5) UStG (reverse charge mandatory phrase: Steuerschuldnerschaft des Leistungsempfaengers)
- Chapter 10 ITEPA 2003 (UK off-payroll working rules, IR35 reform April 2021)

### Tertiary (LOW confidence — requires live verification)
- VIES REST API availability at `https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number` in 2026
- pdf-lib PDF/A-3b Associated Files (AF) mechanism capabilities with current library version
- Exact XRechnung CIUS version in effect April 2026 and its Schematron rule set from KoSIT
- HMRC OAuth token type (server-token vs user-restricted) for VAT number check endpoint
- BACS Standard 18 any 2025/2026 specification updates from Vocalink/Pay.UK

---
*Research completed: 2026-04-12*
*Ready for roadmap: yes*
