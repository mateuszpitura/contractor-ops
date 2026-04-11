# Project Research Summary

**Project:** v4.0 International Foundation & Gulf Expansion
**Domain:** Pluggable e-invoicing, multi-currency, Arabic RTL, SWIFT payments, multi-region deployment, Gulf government API integrations (ZATCA Fatoorah, Peppol PINT-AE)
**Researched:** 2026-04-11
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone transforms Contractor Ops from a Poland-focused platform into a multi-market contractor operations SaaS by building the technical foundation for Gulf expansion (UAE, Saudi Arabia). The core architectural investment is a pluggable e-invoicing engine built on EN 16931 / UBL 2.1 standards — this one abstraction unlocks ZATCA Fatoorah (Saudi, mandatory now), Peppol PINT-AE (UAE, mandatory July 2026 voluntary / January 2027 for large businesses), and makes all future market entries (Germany XRechnung, France Factur-X, UK Peppol) incremental additions rather than full rewrites. The existing codebase has strong foundations to build on: the BaseAdapter/provider pattern extends naturally to government APIs, the integer minor-unit money pattern works for AED and SAR (both 2-decimal), and QStash already handles async fire-and-forget integration calls.

The recommended approach is sequential by dependency: build the e-invoicing engine core and refactor KSeF into the first country profile, then extend multi-currency to AED/SAR with a proper Money utility, then add the multi-tier VAT and WHT tax engine, then integrate ZATCA (Saudi), then Peppol PINT-AE (UAE), then Arabic localization and RTL, then PDPL compliance (privacy), and finally multi-region infrastructure as a deferred-but-architecturally-prepared layer. Multi-currency, SWIFT payment export, and country-specific contractor fields ship alongside the tax engine phase as they are tightly coupled dependencies. The SWIFT pain.001 format (ISO 20022) is the correct choice over MT101 — the MT message sunset deadline is November 2026.

The most significant risk is the ZATCA cryptographic signing chain: invoices must be processed sequentially per organization, certificates have a two-stage issuance process (Compliance CSID then Production CSID), and a broken hash chain requires ZATCA support to reset. The second major risk is RTL layout corruption across 469K LOC of existing LTR-only components — this requires a surgical codebase-wide migration to CSS logical properties before any Arabic locale is exposed to users. A critical infrastructure constraint discovered in research: Neon has no Middle East region. Frankfurt (`aws-eu-central-1`) is the nearest available region and is acceptable for PDPL compliance via contractual safeguards, matching how most Gulf SaaS companies operate today.

## Key Findings

### Recommended Stack

The existing stack requires no replacement — only targeted additions. The e-invoicing engine needs `xmlbuilder2` (type-safe XML construction for UBL 2.1 documents), `xml-crypto` (XML digital signatures for ZATCA XAdES), `@xmldom/xmldom` (required peer dependency for xml-crypto), and `qrcode` (ZATCA TLV QR codes and Peppol identifiers). For ZATCA's X.509 certificate lifecycle, add `@peculiar/x509` and `@peculiar/asn1-schema`. ZATCA-specific library packages (`zatca-xml-js`, `zatca-xml-ts`) are explicitly not recommended — they are unmaintained, only support simplified invoices, and require system OpenSSL, which conflicts with the pluggable engine architecture.

Multi-currency uses `@dinero.js/dinero.js` v2 (alpha but production-stable) for type-safe money operations, wrapping the existing integer minor-units pattern. Exchange rates come from the Frankfurter API (ECB-sourced, free, no API key, cached daily in Redis). For RTL, shadcn CLI's built-in `migrate rtl` command converts physical CSS to logical properties; `rtl-detect` (1KB) handles programmatic locale direction detection. SWIFT payment generation is a custom implementation using `xmlbuilder2` to produce ISO 20022 `pain.001.001.09` XML — no production-quality JS library exists for SWIFT generation. Peppol network transmission requires partnering with an Accredited Service Provider (ASP) via REST API; the application generates PINT-AE XML but never becomes an Access Point itself.

**Core new dependencies:**
- `xmlbuilder2` ^4.0.0: UBL 2.1 XML document construction — type-safe chainable API with namespace support
- `xml-crypto` ^6.0.0: XML digital signatures (XAdES) for ZATCA — battle-tested, 3M+ weekly downloads
- `@peculiar/x509` ^1.12.0: X.509 certificate parsing, CSR creation for ZATCA onboarding — pure JS, uses native crypto
- `@dinero.js/dinero.js` ^2.0.0-alpha.14: Type-safe multi-currency arithmetic — enforces currency matching at compile time
- `rtl-detect` ^2.0.0: Locale-to-direction mapping — tiny (1KB) utility for setting `dir` attribute
- `qrcode` ^1.5.4: QR code generation for ZATCA TLV encoding — 5M+ weekly downloads

### Expected Features

**Must have (table stakes for Gulf market launch):**
- Pluggable e-invoicing engine (abstract core): EN 16931/UBL 2.1 abstraction shared by all country profiles — architectural prerequisite for everything else
- ZATCA Fatoorah Phase 2 integration: Saudi e-invoicing is legally mandatory now for businesses above SAR 375K; includes XML generation, XML DSig, invoice hash chain, QR codes, Fatoora Portal API
- Peppol PINT-AE integration: UAE e-invoicing mandatory from January 2027; penalty AED 2,500 per non-compliant invoice; requires certified ASP partnership
- Multi-currency (AED, SAR): Invoice, payment run, and reporting currency fields; AED and SAR are USD-pegged so exchange rate volatility is minimal
- Multi-tier VAT engine: UAE 5%, Saudi 15% — must be configuration-driven, not code branches; WHT calculator for Saudi cross-border payments (5–20% by service type)
- SWIFT pain.001 payment export: Gulf B2B payments require SWIFT with purpose codes; ISO 20022 format future-proofs against MT101 sunset (November 2026)
- Country-specific contractor fields: UAE freelance permit / trade license; Saudi freelance license / commercial registration
- Arabic locale (translation strings): Saudi requires Arabic; UAE benefits from Arabic for broader market credibility
- WHT certificates: Saudi clients must deduct and remit withholding tax; certificate generation required
- PDPL compliance: Saudi PDPL enforceable since September 2024 (48 enforcement actions in first year); UAE Federal Decree-Law 45/2021; consent management and cross-border transfer safeguards required

**Should have (competitive differentiators, add after validation):**
- Full Arabic RTL layout: Codebase-wide CSS logical properties migration; shadcn/ui RTL audit; chart axis mirroring — signals Gulf-first commitment, most international platforms do this poorly
- Compliance status dashboard: Consolidated ZATCA clearance, Peppol submission, WHT filing deadline, contractor license expiry per organization
- ZATCA onboarding wizard: Guided CSR generation → CSID issuance → compliance testing → production certificate flow
- Multi-region deployment (ME region): Data residency for strict PDPL requirements; deferred until first enterprise customer requires it
- Live exchange rates for reporting: Frankfurter API integration; display invoices in home currency alongside original

**Defer to v5+:**
- XRechnung / ZUGFeRD (Germany): Engine core makes this incremental when Germany market opens
- Factur-X / PDP (France): Hardest EU market; defer until Germany is proven
- IR35 tracking, BACS export, Scheinselbstandigkeit (UK/Germany): Separate market entry phases

### Architecture Approach

The architectural centerpiece is a new `packages/einvoicing` package implementing the Strategy pattern via country profiles. Each profile (`KSeFProfile`, `ZatcaProfile`, `PeppolPINTAEProfile`) implements a common `EInvoiceProfile` interface with `generateXml()`, `validate()`, `signXml()`, `generateQrData()`, and `submit()`. The existing KSeF integration is refactored into the first profile rather than being replaced — this proves the abstraction while preserving production behavior. Integration adapters in `packages/integrations` handle connection lifecycle (credentials, health checks, webhooks) and delegate all document generation to `packages/einvoicing`. All government API calls (ZATCA clearance, Peppol submission) flow through QStash for reliability and retry semantics, matching the existing pattern.

**Major components:**
1. `packages/einvoicing` (NEW): Core UBL 2.1 engine + country profiles (KSeF, ZATCA, Peppol PINT-AE); XML generation, validation, signing, QR code generation
2. `packages/integrations` (EXTENDED): `ZatcaAdapter`, `PeppolAdapter` extending `BaseAdapter`; connection lifecycle only, delegates XML work to einvoicing
3. `packages/db` (EXTENDED): New Prisma schema files — `einvoice.prisma`, `currency.prisma`, `tax-rule.prisma`, `consent.prisma`; modifications to `invoice.prisma`, `payment.prisma`, `contractor.prisma`, `organization.prisma`
4. `packages/validators` (EXTENDED): `Money` value object with `CURRENCY_MINOR_UNITS` lookup; exchange rate Zod schemas; WHT/VAT rule schemas
5. `packages/api` (EXTENDED): New tRPC routers for `einvoicing`, `currency`, `tax`; modified `payment` router for SWIFT export
6. `apps/web` (EXTENDED): RTL layout with `dir` attribute set from locale; currency display components; government API status UIs; country-specific contractor form fields

### Critical Pitfalls

1. **Breaking KSeF while refactoring into pluggable engine** — Write comprehensive KSeF integration tests BEFORE touching any code. Use the Strangler Fig pattern: build the abstract engine alongside KSeF, wrap KSeF as the first adapter, verify all tests pass, then remove direct calls. If the abstract interface exceeds 6–8 methods, it is over-abstracted.

2. **ZATCA cryptographic signing chain errors** — ZATCA requires sequential per-organization invoice processing to maintain hash chain integrity. Implement the full two-stage onboarding (CSR → Compliance CSID → sandbox certification → Production CSID). Build certificate renewal from day 1. Never parallelize invoice signing within a single organization.

3. **Multi-currency `* 100` arithmetic breaking for 3-decimal currencies** — Replace all `toMinorUnits()` calls with a `Money` utility that takes a currency parameter and looks up the correct decimal places from ISO 4217. AED and SAR are both 2-decimal (safe for v4.0), but hardcoding `* 100` now creates a painful migration when BHD/KWD are added later.

4. **RTL layout corruption across existing LTR-only components** — Do a codebase-wide migration of physical CSS properties (`ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`) to logical equivalents (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) BEFORE adding any Arabic locale. Test every page with `dir="rtl"` before writing translations. Enforce logical properties in new code via lint rule.

5. **Peppol ASP scope creep** — Never attempt to build a Peppol Access Point. Partner with an existing ASP (Storecove, Pagero, EDICOM) before starting development. Budget 2–4 weeks for partnership, API access, and sandbox testing. Keep XML line items as products/services only; never use them as metadata containers.

## Implications for Roadmap

Based on feature dependencies, architectural patterns, and pitfall phase mappings, the research consistently points to an 8-phase structure ordered by dependency chain.

### Phase 1: Pluggable E-Invoicing Engine Core
**Rationale:** Every other e-invoicing feature (ZATCA, Peppol, future Germany/France) depends on this abstraction. KSeF regression is the highest-risk operation in the milestone — front-loading it with the Strangler Fig pattern protects the production integration while establishing the foundation.
**Delivers:** `packages/einvoicing` with `EInvoiceProfile` interface; KSeF refactored as first country profile; all existing KSeF integration tests passing green; XML pipeline, validation framework, and signing abstraction in place.
**Addresses:** Pluggable e-invoicing engine (table stakes), KSeF continuity
**Avoids:** KSeF regression (Pitfall 1), over-abstracted engine interface

### Phase 2: Multi-Currency Foundation & SWIFT Payment Export
**Rationale:** ZATCA and Peppol invoices reference specific currencies. SWIFT export requires currency on payment runs. The `Money` utility must exist before any currency-aware feature is built to prevent the `* 100` anti-pattern from spreading.
**Delivers:** `Money` value object with `CURRENCY_MINOR_UNITS` lookup; AED and SAR currency support on invoices, payment runs, reports; exchange rate table with Frankfurter API cron via QStash; ISO 20022 `pain.001.001.09` SWIFT export with purpose codes; contractor currency fields.
**Uses:** `@dinero.js/dinero.js`, `@dinero.js/currencies`, Frankfurter API, `xmlbuilder2` (SWIFT XML)
**Avoids:** Multi-currency integer arithmetic corruption (Pitfall 2), SWIFT purpose code failures

### Phase 3: Multi-Tier VAT Engine & WHT Calculator
**Rationale:** ZATCA and Peppol require compliant tax calculations on invoices. VAT and WHT must be configuration-driven before the government API integrations are built; adding them as code branches later is a confirmed anti-pattern from the pitfalls research.
**Delivers:** `TaxEngine` service with database-backed rate tables (UAE 5%, Saudi 15%, Poland unchanged); WHT calculator for Saudi cross-border payments (5–20% by service type + contractor residency + treaty lookup); WHT certificate PDF generation; country-specific contractor fields (UAE freelance permit, Saudi commercial registration).
**Avoids:** VAT engine hardcoding (Pitfall 7), incorrect WHT rates creating client tax liability

### Phase 4: ZATCA Fatoorah Integration (Saudi Arabia)
**Rationale:** Saudi e-invoicing is already legally mandatory. This is the highest-value Gulf deliverable. Depends on the e-invoicing engine (Phase 1), currency (Phase 2), and VAT/WHT (Phase 3). The hash chain and certificate lifecycle require the most careful implementation in the milestone.
**Delivers:** `ZatcaProfile` implementing `EInvoiceProfile`; `ZatcaAdapter` extending `BaseAdapter`; full ZATCA onboarding flow (CSR → CCSID → sandbox → PCSID); XML DSig signing with X.509 certificates; TLV-encoded QR codes; invoice hash chain with sequential per-org processing queue via QStash; ZATCA Fatoora Portal API integration (clearance for B2B, reporting for B2C).
**Uses:** `xmlbuilder2`, `xml-crypto`, `@xmldom/xmldom`, `@peculiar/x509`, `@peculiar/asn1-schema`, `qrcode`
**Avoids:** ZATCA crypto signing chain errors (Pitfall 3), CCSID/PCSID certificate lifecycle mistakes

### Phase 5: Peppol PINT-AE Integration (UAE)
**Rationale:** UAE e-invoicing mandate begins July 2026 (voluntary) and January 2027 (mandatory for large businesses). Depends on e-invoicing engine (Phase 1) and currency (Phase 2). ASP partnership must be secured before development starts — the 5-corner model makes this fundamentally different from KSeF/ZATCA direct integrations.
**Delivers:** `PeppolPINTAEProfile` implementing `EInvoiceProfile`; PINT-AE UBL 2.1 XML generation; `PeppolAdapter` with ASP REST API integration; Peppol Participant ID registration flow per organization; submission status tracking (ASP delivery confirmation).
**Uses:** `xmlbuilder2`, Peppol ASP REST API (Storecove, Pagero, or EDICOM)
**Avoids:** Peppol ASP scope creep (Pitfall 6), attempting to become an Access Point

### Phase 6: Arabic Localization & RTL Layout
**Rationale:** RTL layout requires the codebase-wide migration to CSS logical properties to be done as a focused effort, not incrementally. Arabic translations without RTL would leave Saudi users with broken layouts. Arabic is mandatory for Saudi Arabia; RTL is required for both KSA and broader Arabic-speaking market credibility.
**Delivers:** Arabic (`ar`) as third locale in next-intl routing; full UI translation (professional review required for financial terms); `dir="rtl"` on `<html>` from `rtl-detect`; codebase-wide migration of physical CSS to logical properties via `shadcn migrate rtl`; all ICU messages extended with 6 Arabic plural forms; `DirectionProvider` wrapper; number and currency formatting tested with Western (Latin) numerals in financial contexts.
**Uses:** `rtl-detect`, `shadcn migrate rtl`, `@radix-ui/react-direction` (already installed)
**Avoids:** RTL layout corruption (Pitfall 4), next-intl Arabic plural failures (Pitfall 8)

### Phase 7: PDPL Compliance
**Rationale:** Saudi PDPL is actively enforced (48 decisions in first year). Can be done after the core Gulf integrations ship because it does not block API functionality, but must be in place before onboarding real Saudi/UAE organizations.
**Delivers:** Consent management UI for UAE/Saudi orgs during onboarding; privacy notices per jurisdiction; data processing agreement documentation; cross-border transfer safeguards (contractual SCCs for Frankfurt hosting); data residency configuration per org; "right to erasure" deletion that removes data from the correct regional database.
**Avoids:** PDPL compliance gaps (AED 5M penalty exposure for UAE, criminal penalties in Saudi)

### Phase 8: Multi-Region Infrastructure (Deferred, Architecture-Ready)
**Rationale:** Neon has no Middle East region. Frankfurt is the current nearest region and is acceptable for most PDPL use cases via contractual safeguards. This phase becomes mandatory when an enterprise customer has a hard in-country data residency requirement. Earlier phases must not preclude this by using a Prisma singleton that cannot be made region-aware.
**Delivers:** Region-aware Prisma client factory (`getPrismaClient(orgRegion)`) replacing singleton; Neon logical replication (EU → ME for shared/global data); per-org region routing at tRPC middleware layer; Vercel Edge Config for region preferences; Neon `always-on` compute for ME region to prevent cold starts; global admin dashboard aggregating across regions without violating data residency.
**Avoids:** Neon multi-region split-brain (Pitfall 5), cross-region data leaks violating PDPL residency

### Phase Ordering Rationale

- Phases 1–3 are pure infrastructure with no external API dependencies. They can be built, tested, and validated without ZATCA sandbox access.
- Phase 4 (ZATCA) requires sandbox certification and government API access — external dependency that benefits from having stable infrastructure beneath it.
- Phase 5 (Peppol) requires ASP partnership negotiation — should be initiated concurrently with Phase 4 development to compress the timeline.
- Phase 6 (RTL) is isolated from government integrations and can run in parallel with Phase 5 if capacity allows, but must complete before Gulf market launch.
- Phase 7 (PDPL) is a compliance layer that does not break other features when added; sequenced last among functional phases.
- Phase 8 (Multi-Region) is deferred until an enterprise customer requires it, but architecturally prepared from Phase 1 by avoiding Prisma singletons and designing region-aware data access patterns.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (ZATCA):** Certificate lifecycle details (CCSID/PCSID exchange, renewal), TLV QR encoding spec, hash chain database schema, and Fatoora API rate limits all need detailed research during phase planning. ZATCA documentation is official but dense.
- **Phase 5 (Peppol):** ASP selection and API contract details are unknown until a partner is chosen. Research should cover Storecove vs Pagero vs EDICOM REST API differences, Peppol PINT-AE validation rule specifics, and Participant ID registration process.
- **Phase 8 (Multi-Region):** Neon logical replication setup between projects, Prisma multi-connection patterns, and Vercel Edge Config routing specifics need hands-on investigation.

Phases with standard, well-documented patterns (can skip deep research):
- **Phase 2 (Multi-Currency):** Dinero.js v2 has complete documentation; Frankfurter API is trivial to integrate; integer minor-unit pattern is already established in the codebase.
- **Phase 3 (VAT/WHT):** PwC/KPMG rate tables are available; `TaxEngine` is straightforward configuration-driven design; WHT certificate PDF uses existing react-pdf infrastructure.
- **Phase 6 (RTL):** shadcn `migrate rtl` command is well-documented; Tailwind v4 logical properties are covered in official docs; next-intl Arabic locale setup is documented.
- **Phase 7 (PDPL):** Consent management UI is standard; legal requirements are documented; implementation is primarily database schema + UI.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified via npm/GitHub; ZATCA and UAE MoF specs are official government sources; Neon region availability confirmed in docs |
| Features | MEDIUM-HIGH | Government mandate timelines verified via official portals and KPMG/Avalara analysis; WHT rates verified via PwC Tax Summaries; PDPL enforcement verified via Clyde & Co |
| Architecture | HIGH | Based on direct codebase inspection; existing BaseAdapter/QStash/Prisma patterns confirmed; EN 16931/UBL 2.1 spec reviewed; government API architecture (2-corner ZATCA, 4-corner Peppol) verified |
| Pitfalls | HIGH | Most pitfalls derived from codebase analysis of specific files (`ksef-xml-parser.ts`, `ksef-sync-orchestrator.ts`, Prisma schemas) plus ZATCA developer community post-mortems and Peppol error documentation |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **ASP selection for Peppol:** No ASP has been chosen or contacted. Storecove, Pagero (Thomson Reuters), and EDICOM are candidates. API contracts, pricing, and UAE FTA accreditation status need validation before Phase 5 planning begins. Initiate vendor evaluation concurrently with Phase 4 development.
- **Arabic translation volume and cost:** The codebase has significant UI text. Professional financial translation (required — machine translation is not acceptable for legal/tax terms) requires budget and timeline estimation. Needs scoping before Phase 6 planning.
- **ZATCA Wave 24 timeline confirmation:** Research notes Wave 24 (businesses > SAR 375K) begins June 2026. Confirm directly with ZATCA portal before committing to a Saudi launch date.
- **PDPL cross-border transfer mechanism:** Whether Saudi NDMO will accept EU-based hosting (Frankfurt) with contractual protections vs. requiring in-country storage is an evolving legal question. Legal counsel review recommended before onboarding Saudi enterprise clients.
- **Dinero.js v2 alpha stability:** The library is production-used but remains in alpha. A fallback plan (custom Money utility using the `CURRENCY_MINOR_UNITS` lookup directly) should be identified before Phase 2 starts.

## Sources

### Primary (HIGH confidence)
- [ZATCA E-Invoicing Technical Guidelines v2](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-invoicing-Detailed-Technical-Guideline.pdf) — XML schema, signing requirements, QR TLV spec, Phase 2 wave schedules
- [UAE Electronic Invoicing Guidelines V1.0 (MoF, Feb 2026)](https://mof.gov.ae/wp-content/uploads/2026/02/UAE-Electronic-Invoicing-Guidelines_V-1.0-23Feb2026.pdf) — PINT-AE format, ASP requirements, mandate timeline
- [Neon Regions Documentation](https://neon.com/docs/introduction/regions) — confirmed no Middle East region
- [shadcn/ui RTL Documentation](https://ui.shadcn.com/docs/rtl) — `migrate rtl` command, logical property conversion
- [xml-crypto npm](https://www.npmjs.com/package/xml-crypto) — XML digital signature library
- [xmlbuilder2 npm](https://www.npmjs.com/package/xmlbuilder2) — XML builder v4.0.0
- [Frankfurter API](https://frankfurter.dev/) — free ECB exchange rate API
- [@peculiar/x509 GitHub](https://github.com/PeculiarVentures/x509) — X.509 certificate handling

### Secondary (MEDIUM confidence)
- [Dinero.js v2 Documentation](https://v2.dinerojs.com/) — multi-currency money library (alpha but production-stable)
- [Avalara: UAE e-invoicing mandate 2026](https://www.avalara.com/blog/en/europe/2026/03/uae-e-invoicing-mandate-2026-readiness-asp-pint-ae.html) — Peppol PINT-AE architecture overview
- [PwC: Saudi WHT rates](https://taxsummaries.pwc.com/saudi-arabia/corporate/withholding-taxes) — rate tables and treaty information
- [ICLG: Saudi Data Protection 2025-2026](https://iclg.com/practice-areas/data-protection-laws-and-regulations/saudi-arabia) — PDPL requirements
- [Clyde & Co: Saudi PDPL enforcement](https://www.clydeco.com/en/insights/2026/03/enforcement-of-the-saudi-pdp-law) — 48 enforcement decisions in first year
- [SWIFT ISO 20022 migration](https://www.swift.com/news-events/news/iso-20022-bytes-payments-maintaining-momentum-2025) — pain.001 replacing MT101, November 2026 deadline
- [10 Most Common Peppol E-Invoicing Errors](https://qvalia.com/10-most-common-e-invoicing-errors-and-mistakes-in-peppol/) — Peppol validation failure patterns
- [ZATCA Fatoorah Developer Community](https://zatca1.discourse.group/) — certificate lifecycle errors (CCSID vs PCSID)

### Tertiary (LOW confidence)
- [KPMG: UAE technical guidance on mandatory e-invoicing fields](https://kpmg.com/us/en/taxnewsflash/news/2026/02/uae-technical-guidance-mandatory-e-invoicing-fields.html) — field requirements (secondary to official MoF guidelines)
- [SWIFT MT101 Specifications](https://www.paiementor.com/swift-mt101-format-specifications/) — used to confirm pain.001 superiority, not a primary source
- Internal: `MARKET-EXPANSION-ANALYSIS.md` — per-market requirements (internal document, not externally verifiable)

---
*Research completed: 2026-04-11*
*Ready for roadmap: yes*
