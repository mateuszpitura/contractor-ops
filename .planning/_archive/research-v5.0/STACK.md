# Stack Research: v5.0 UK & Germany Market Expansion

**Domain:** UK IR35 compliance, German Scheinselbstaendigkeit, EN 16931 e-invoicing (XRechnung/ZUGFeRD), BACS payments, German localization, HMRC/VIES VAT validation
**Researched:** 2026-04-12
**Confidence:** MEDIUM (web search tools unavailable; recommendations based on thorough codebase analysis of existing patterns and training data knowledge of standards/APIs)

## Key Finding: Build From Spec, Not From Libraries

The JS/TS ecosystem for EU e-invoicing is extremely thin. Unlike the Java/.NET world (which has Mustang, ZUGFeRD-csharp, etc.), Node.js has no mature, maintained libraries for XRechnung, ZUGFeRD, or EN 16931. The existing codebase already uses the right approach: `fast-xml-parser` for XML generation + `xml-crypto` for digital signatures, building country profiles that implement the `EInvoiceProfile` interface. **The new profiles (XRechnung, ZUGFeRD) follow this same pattern with zero engine changes.**

Similarly, no meaningful npm packages exist for BACS Standard 18, IR35 determination, or Scheinselbstaendigkeit risk assessment. These are all build-from-spec domains.

---

## What We Already Have (DO NOT Add)

| Capability | Existing Package | Version | Notes |
|------------|------------------|---------|-------|
| XML generation | fast-xml-parser | ^5.5.9 | Used by ZATCA + Peppol-AE generators. Same `XMLBuilder`/`XMLParser` for XRechnung UBL and ZUGFeRD CII. |
| XAdES digital signatures | xml-crypto | ^6.0.0 | Used by `ZatcaXAdESSigner`. Same `SignedXml` + `ExclusiveCanonicalization` for XRechnung XAdES. |
| XML DOM | @xmldom/xmldom | 0.8.12 | Peer dependency of xml-crypto. Already installed. |
| E-invoice profile architecture | @contractor-ops/einvoice | workspace | `EInvoiceProfile` interface, `Signable` capability, `registerProfile()` registry. New profiles slot in with zero engine changes. |
| Payment export framework | payment-export.ts | -- | `generateCsv()`, `generateElixir()`, `generateSepaXml()`, `generateSwiftXml()`. BACS is another generator alongside these. |
| Payment format detection | payment-format-detection.ts | -- | `detectFormat()` routes by currency + IBAN country. Add BACS rule for GBP + GB. |
| Government API framework | @contractor-ops/gov-api | workspace | Cert auth, retry, rate limiting, audit logging. HMRC + VIES clients fit this pattern. |
| i18n framework | next-intl | ^4.8.3 | Routing, pluralization, ICU MessageFormat. Adding `de` locale is config + translation file. |
| Locale-aware formatting | date-fns + Intl | ^4.1.0 | German `de-DE` locale supported out of the box by both. |
| Schema validation | zod | ^3.23.0 | Extend for IR35 questionnaire, Scheinselbstaendigkeit assessment, BACS format validation. |
| Certificate handling | node-forge + crypto | ^1.3.1 | Node.js crypto module handles RSA-SHA256 for XRechnung (ZATCA uses ECDSA-SHA256). |
| QR code generation | qrcode | ^1.5.4 | Already installed. Potentially useful for German invoice QR codes. |

## Recommended Stack Additions

### New Libraries to Add

| Library | Version | Package Target | Purpose | Why Recommended |
|---------|---------|----------------|---------|-----------------|
| pdf-lib | ^1.17.1 | @contractor-ops/einvoice | PDF/A-3 generation for ZUGFeRD (embed CII XML in PDF) | Pure JS, no native dependencies, works on Vercel. Supports PDF modification: file attachments (AF array), XMP metadata, output intent. The only mature JS library capable of producing PDF/A-3b compliant output with embedded XML. react-pdf (already installed) is for viewing -- pdf-lib is for generation/modification. |

That is the only new dependency. Everything else is build-from-spec using existing libraries.

### Libraries NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any npm `zugferd` package | No mature, maintained packages in JS/TS. What exists is experimental or abandoned. | Build CII XML with `fast-xml-parser` following existing ZATCA/Peppol generator pattern. |
| Any npm `xrechnung` package | Same situation -- no viable JS packages. | Build XRechnung UBL XML with `fast-xml-parser`, structurally identical to Peppol-AE generator. |
| Any npm `bacs` package | Nothing exists. BACS Standard 18 is fixed-width text, simpler than the Elixir format already built. | `generateBacs()` function in `payment-export.ts` (~100-150 lines). |
| `hmrc-client` or `hmrc-mtd-api` | No official HMRC npm SDK. Existing packages are unmaintained. | Direct `fetch` to HMRC REST API + Zod response validation. Fits existing gov-api pattern. |
| `soap` for VIES | EU VIES now has a REST API alongside SOAP. Avoid adding a SOAP dependency. | Direct `fetch` to VIES REST endpoint (`/rest-api/check-vat-number`). Fall back to SOAP only if REST proves unreliable. |
| Any "IR35 calculator" library | Does not exist. IR35 determination is a rules engine based on public CEST criteria. | Build questionnaire-driven weighted rules engine. |
| `mustangserver` (Java ZUGFeRD) | Wrong ecosystem -- requires JVM. | Build natively in TypeScript. |
| `pdfkit` | No PDF/A-3 support, no file embedding API for ZUGFeRD compliance. | `pdf-lib` |
| `libxmljs` / `libxmljs2` | Native C++ bindings, breaks on Vercel/Edge. | `fast-xml-parser` (pure JS, already installed). |
| `xrechnung-visualization` | For rendering XRechnung as HTML, not for generation. | Our UI already renders invoices. |

---

## Detailed Analysis by Domain

### 1. EN 16931 E-Invoicing: XRechnung (UBL 2.1)

**Confidence: HIGH** -- existing Peppol-AE UBL 2.1 generator is structurally identical.

XRechnung is Germany's CIUS (Core Invoice Usage Specification) of EN 16931 using UBL 2.1 syntax. The existing `generatePintAeXml()` in `packages/einvoice/src/profiles/peppol-ae/generator.ts` is the direct template:

- Same `XMLBuilder` from fast-xml-parser
- Same UBL namespaces (`urn:oasis:names:specification:ubl:schema:xsd:Invoice-2`, `cac:`, `cbc:`)
- Different `CustomizationID`: `urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0`
- Different `ProfileID`: `urn:fdc:peppol.eu:2017:poacc:billing:01:1.0`
- Mandatory German fields: `BuyerReference` (Leitweg-ID for B2G), `PaymentTerms` (Skonto)

**Key difference from Peppol-AE:** XRechnung requires German-specific business rules (BR-DE-1 through BR-DE-26). These are Schematron validation rules, not XML structure differences. Implementation: add a `validate()` method that checks these rules.

**New profile structure:**
```
packages/einvoice/src/profiles/xrechnung/
  index.ts          -- XRechnungProfile implementing EInvoiceProfile
  generator.ts      -- UBL 2.1 XML generation (adapt from peppol-ae/generator.ts)
  parser.ts         -- UBL 2.1 XML parsing
  validator.ts      -- BR-DE-* business rule validation
  signer.ts         -- XAdES-BES with RSA-SHA256 (adapt from zatca/signer.ts)
  constants.ts      -- XRechnung-specific IDs, namespaces
  schemas.ts        -- Zod schemas for XRechnung extensions
```

### 2. EN 16931 E-Invoicing: ZUGFeRD (CII + PDF/A-3)

**Confidence: MEDIUM** -- CII syntax is new to the codebase; pdf-lib PDF/A-3 capabilities should be verified during implementation.

ZUGFeRD 2.2+ (also Factur-X in France) uses UN/CEFACT CII (Cross-Industry Invoice) XML syntax. This is a different XML structure from UBL but maps to the same `EInvoice` canonical model.

**CII vs UBL key differences:**
- Different root element: `rsm:CrossIndustryInvoice` (not `Invoice`)
- Different namespaces: `urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100`
- Different element names: `ram:SellerTradeParty` (not `cac:AccountingSupplierParty`)
- Same semantic content, different XML vocabulary

**ZUGFeRD profiles** (conformance levels):
- MINIMUM -- basic metadata only
- BASIC WL -- no line items
- BASIC -- with line items
- EN 16931 (COMFORT) -- full EN 16931 compliance (recommended for contractor invoices)
- EXTENDED -- additional German-specific fields

**PDF/A-3 workflow:**
1. Generate CII XML from `EInvoice` canonical model
2. Take the contractor's submitted invoice PDF (or generate one)
3. Convert to PDF/A-3b: embed sRGB ICC profile, add XMP metadata with `pdfaid:part=3` and `pdfaid:conformance=B`
4. Attach CII XML as `factur-x.xml` with AFRelationship `Data` and MIME type `text/xml`
5. Add the file to the catalog's AF (Associated Files) array

**pdf-lib** handles steps 2-5. Step 1 uses fast-xml-parser.

**New profile structure:**
```
packages/einvoice/src/profiles/zugferd/
  index.ts          -- ZUGFeRDProfile implementing EInvoiceProfile
  generator.ts      -- CII XML generation (NEW syntax, new builder)
  parser.ts         -- CII XML parsing
  validator.ts      -- ZUGFeRD profile conformance validation
  pdf-embedder.ts   -- PDF/A-3b creation with XML attachment (uses pdf-lib)
  constants.ts      -- CII namespaces, ZUGFeRD profile identifiers
  schemas.ts        -- Zod schemas for ZUGFeRD extensions
```

**ZUGFeRD does NOT need XML digital signatures.** The PDF can optionally be signed (PAdES), but the XML itself is unsigned. This is a key difference from XRechnung.

### 3. BACS Standard 18 File Format

**Confidence: HIGH** -- simpler than Elixir format already implemented.

BACS Standard 18 is the UK domestic payment file format. Fixed-width flat file with:

- **VOL1** header (80 chars) -- volume label
- **HDR1/HDR2** headers -- file identification, processing date
- **UHL1** user header -- service/originator codes, processing date
- **Data records** (100 chars) -- destination sort code (6), account number (8), transaction type (2 = credit), amount in pence (11), originator sort code (6), account number (8), free text ref (18), originator name (18)
- **EOF1/EOF2** file trailers
- **UTL1** user trailer -- debit/credit totals, record count

**Implementation:** Add `generateBacs()` to `packages/api/src/services/payment-export.ts` alongside existing generators. The function signature matches the existing pattern:

```typescript
export function generateBacs(items: ExportItem[], org: OrgBankInfo): Buffer
```

**Payment format detection changes** in `payment-format-detection.ts`:
- Add `'BACS'` to `ExportFormat` type
- Add rule: GBP + GB IBAN -> `BACS`
- Note: UK sort codes (6 digits) and account numbers (8 digits) can be extracted from GB IBANs (positions 9-14 and 15-22 respectively after the `GB` country code and 2-digit check)

**Important BACS specifics:**
- Amounts in pence (minor units) -- already the project standard
- All text must be uppercase ASCII -- reuse `stripDiacritics()` helper + `.toUpperCase()`
- Transaction code 99 = credit transfer (the payment type we need)
- File must end with CRLF line endings -- same as Elixir

### 4. HMRC VAT Number Validation

**Confidence: MEDIUM** -- API exists and is REST-based; verify exact endpoint URLs during implementation.

HMRC provides a REST API for VAT number validation (no authentication needed for basic lookup):

```
GET https://api.service.hmrc.gov.uk/organisations/vat/check-vat-number/lookup/{vatNumber}
```

Returns JSON:
```json
{
  "target": {
    "name": "ACME LTD",
    "vatNumber": "123456789",
    "address": { "line1": "...", "postcode": "..." }
  },
  "processingDate": "2026-04-12"
}
```

**Implementation:** Add `hmrc-vat.ts` client in `packages/gov-api/src/` following the existing client pattern (fetch + Zod response validation + retry + rate limiting).

**No new dependency needed.** Direct HTTP fetch with Zod response schema.

**UK VAT number format:** `GB` + 9 digits (or 12 for government departments). Validate with regex before API call.

### 5. VIES USt-IdNr (VAT ID) Validation

**Confidence: LOW** -- VIES REST API availability needs verification during implementation.

The EU VIES service validates EU VAT numbers. Two endpoints exist:

1. **SOAP** (legacy, guaranteed available): WSDL at `https://ec.europa.eu/taxation_customs/vies/checkVatService.wsdl`
2. **REST** (newer, verify availability): `POST https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number`

**Recommendation:** Try REST first (no new dependency). Request body: `{ "countryCode": "DE", "vatNumber": "123456789" }`. If REST is unreliable or in beta, fall back to SOAP (add `soap` package).

**German USt-IdNr format:** `DE` + 9 digits. VIES validates against Bundeszentralamt fuer Steuern (BZSt) records.

**Implementation:** Add `vies.ts` client in `packages/gov-api/src/`. Use qualified confirmation requests (provides name/address match) for KYC compliance.

**Validation flag:** VIES REST API stability MUST be verified before implementation. If unavailable, add `soap@^1.1.0` as dependency.

### 6. IR35 Determination Engine

**Confidence: HIGH** -- well-documented public criteria, build-from-spec.

No npm library or commercial API exists for IR35 determination. HMRC's CEST (Check Employment Status for Tax) tool is web-only with no public API.

**Build a generic classification engine** with pluggable rule sets:

```
packages/classification/    (NEW package)
  src/
    engine.ts               -- Generic weighted questionnaire evaluator
    types.ts                -- RuleSet, Question, Answer, RiskAssessment interfaces
    rulesets/
      ir35.ts               -- UK IR35 rule set (~20 weighted questions)
      scheinselbst.ts       -- German Scheinselbstaendigkeit rule set
    generators/
      sds.ts                -- UK Status Determination Statement (PDF)
      drv-defense.ts        -- German DRV audit defense documentation
```

**IR35 assessment factors** (from case law + CEST):
1. Personal service / substitution rights
2. Mutuality of obligation
3. Control (how, when, where)
4. Financial risk (own equipment, insurance, bad debt)
5. Part of the organization (integration)
6. Provision of equipment
7. Right of dismissal / engagement length
8. Employee-type benefits (holiday pay, pension)

**Output:** INSIDE IR35 / OUTSIDE IR35 / INDETERMINATE with per-factor weighted scores and reasoning text.

**SDS generation:** UK law requires medium/large companies to issue a Status Determination Statement. Template-driven document using assessment results.

### 7. Scheinselbstaendigkeit Risk Engine

**Confidence: HIGH** -- well-established German case law criteria.

Same architecture as IR35 -- uses the generic classification engine with a different rule set.

**DRV (Deutsche Rentenversicherung) assessment criteria:**
1. Weisungsgebundenheit (bound by instructions)
2. Eingliederung (organizational integration)
3. Eigenes Unternehmerrisiko (own business risk)
4. Eigene Arbeitsmittel (own work equipment)
5. Mehrere Auftraggeber (multiple clients)
6. Eigene Mitarbeiter (own employees)
7. Marktauftritt (market presence)
8. Keine Arbeitnehmeraehnliche Verguetung (not employee-like compensation)

**Output:** HIGH RISK / MEDIUM RISK / LOW RISK with per-factor assessment and German-language reasoning for DRV audit defense.

**DRV Statusfeststellungsverfahren** documentation: Generate structured defense documents that can be submitted to DRV if audited.

### 8. German i18n with next-intl

**Confidence: HIGH** -- next-intl handles German with zero issues.

**Changes needed:**

1. **Routing:** Add `'de'` to `locales` array in `apps/web/src/i18n/routing.ts`:
   ```typescript
   locales: ['en', 'pl', 'ar', 'de'] as const
   ```

2. **Messages:** Create `apps/web/messages/de.json` translation file (copy structure from `en.json`, translate)

3. **No library changes.**

**German-specific formatting handled by existing Intl APIs:**
- Numbers: `1.234,56` (comma decimal, period thousands) -- `Intl.NumberFormat('de-DE')`
- Dates: `12.04.2026` (DD.MM.YYYY) -- `Intl.DateTimeFormat('de-DE')`
- Currency: `1.234,56 EUR` -- `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`

**German-specific field formats (validation with Zod, not i18n):**
- Handelsregister: `HR[AB]\s?\d+` (e.g., "HRB 12345")
- Steuernummer: varies by Bundesland, 10-11 digits with slashes (e.g., "123/456/78901")
- USt-IdNr: `DE\d{9}` (e.g., "DE123456789")
- Skonto terms: display string like "2% Skonto bei Zahlung innerhalb von 10 Tagen" -- translation key with ICU placeholders

**UI layout note:** German compound words are long (Rechnungsstellungsdatum, Zahlungsbedingungen, Umsatzsteuervoranmeldung). Ensure:
- Flexible column widths in tables (already using TanStack Table with auto-sizing)
- `hyphens: auto` with `lang="de"` on `<html>` element for line breaking
- Test all UI views with German translations for overflow

### 9. XAdES Digital Signatures for XRechnung

**Confidence: HIGH** -- existing ZATCA XAdES-BES signer is directly reusable.

XRechnung requires XAdES-BES enveloped signatures when submitted to German public sector portals (ZRE -- Zentrale Rechnungseingangsplattform, OZG-RE).

**Existing infrastructure in `packages/einvoice/src/profiles/zatca/signer.ts`:**
- `ZatcaXAdESSigner` implements `Signable` interface
- Uses `xml-crypto` for canonicalization + `crypto` for signing
- Builds XAdES-BES SignedProperties manually
- Full sign + verify flow

**Key adaptation for XRechnung:**
- ZATCA: ECDSA-SHA256 (secp256k1 curve) -- `dsaEncoding: 'ieee-p1363'`
- XRechnung: RSA-SHA256 -- standard RSA signing, simpler
- Algorithm URI: `http://www.w3.org/2001/04/xmldsig-more#rsa-sha256`
- Certificate: Standard X.509 RSA certificate (not ECDSA)

**Create `XRechnungSigner` class** adapting `ZatcaXAdESSigner`:
- Change algorithm from ECDSA-SHA256 to RSA-SHA256
- Remove ECDSA-specific `dsaEncoding` option
- Same XAdES-BES structure (SignedProperties, CertDigest, IssuerSerial)
- Same enveloped signature injection pattern

**No new library needed.** `xml-crypto@^6.0.0` + Node.js `crypto` handles RSA-SHA256 natively.

---

## Installation

```bash
# The ONLY new dependency for the entire v5.0 milestone
pnpm --filter @contractor-ops/einvoice add pdf-lib@^1.17.1
```

**Conditional (only if VIES REST API proves unreliable):**
```bash
pnpm --filter @contractor-ops/gov-api add soap@^1.1.0
```

---

## New Package: @contractor-ops/classification

A new workspace package for the contractor classification engine:

```bash
# Create new package
mkdir -p packages/classification/src
```

**Dependencies:** Only `zod` (already in workspace). No external libraries.

**package.json:**
```json
{
  "name": "@contractor-ops/classification",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| pdf-lib (PDF/A-3) | puppeteer/playwright | If pixel-perfect HTML-to-PDF rendering needed. Not our case -- we need PDF metadata control for ZUGFeRD compliance. Also, puppeteer requires browser binary (breaks Vercel). |
| pdf-lib (PDF/A-3) | @react-pdf/renderer | If generating PDFs from React components. Lacks PDF/A-3 metadata control and file embedding needed for ZUGFeRD. |
| Direct fetch (HMRC) | Any `hmrc-*` npm package | Never. All are unmaintained; the API is simple REST. |
| Direct fetch (VIES REST) | soap package (VIES SOAP) | Only if VIES REST API is unreliable or undocumented. Verify REST first. |
| Build BACS from spec | N/A | No alternatives exist. Simple fixed-width format. |
| Build IR35 engine | Commercial API (IR35 Shield, Kingsbridge) | If legal liability for determination is a concern. Commercial APIs cost $$$, add vendor lock-in, and CEST criteria are public. Build own engine, consider commercial validation as optional premium feature later. |
| Build Scheinselbstaendigkeit engine | N/A | No APIs or libraries exist for this. |
| CII XML with fast-xml-parser | Dedicated CII library | No maintained CII library exists in JS/TS. fast-xml-parser handles arbitrary XML generation. |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| pdf-lib@^1.17.1 | Node.js 18+, Vercel serverless | Pure JS, zero native deps. No conflict with existing react-pdf (different purpose). |
| fast-xml-parser@^5.5.9 | pdf-lib (no conflict) | Already installed. Generates both UBL (XRechnung) and CII (ZUGFeRD) XML. |
| xml-crypto@^6.0.0 | RSA-SHA256 + ECDSA-SHA256 | Already installed. Supports both algorithm families needed. |
| next-intl@^4.8.3 | German `de` locale | No version change. ICU MessageFormat handles German pluralization (2 forms: singular/plural). |
| zod@^3.23.0 | All new schemas | Already installed everywhere. Classification engine uses it for questionnaire validation. |

---

## Integration Summary

| Domain | Approach | New Deps | Effort Estimate |
|--------|----------|----------|-----------------|
| XRechnung (UBL 2.1) | New einvoice profile, adapt Peppol-AE generator | None | Medium -- familiar pattern |
| ZUGFeRD (CII + PDF/A-3) | New einvoice profile + PDF embedding | pdf-lib | High -- new XML syntax + PDF/A-3 |
| BACS Standard 18 | Add generator to payment-export.ts | None | Low -- simpler than Elixir |
| HMRC VAT validation | Add client to gov-api | None | Low -- simple REST call |
| VIES validation | Add client to gov-api | None (maybe soap) | Low-Medium -- depends on REST availability |
| IR35 engine | New classification package | None | Medium-High -- rules engine + SDS generation |
| Scheinselbstaendigkeit | Rule set in classification package | None | Medium -- follows IR35 pattern |
| German i18n | Config change + translation file | None | Low (translation effort is content, not code) |
| XRechnung XAdES | Adapt ZATCA signer for RSA | None | Low -- algorithm swap only |

**Total new runtime dependencies: 1 (pdf-lib)**

---

## Validation Flags (MUST Verify During Implementation)

1. **VIES REST API** -- Confirm `https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number` is production-ready. If beta-only, add `soap@^1.1.0`.
2. **pdf-lib PDF/A-3b compliance** -- Verify pdf-lib can set required XMP metadata (`pdfaid:part=3`, `pdfaid:conformance=B`), embed ICC output intent profile, and create AF (Associated Files) entries. May need manual `PDFDict`/`PDFArray` manipulation.
3. **XRechnung CIUS version** -- Confirm current version (expected 3.0.x in 2026). Schematron rules change between versions.
4. **ZUGFeRD version** -- Confirm current version (expected 2.3.x). Verify Factur-X alignment still maintained.
5. **HMRC VAT API** -- Verify exact endpoint URLs and rate limits.
6. **BACS Standard 18** -- Verify if any 2025/2026 spec updates exist (format is stable but check).

---

## Sources

- Codebase analysis: `packages/einvoice/` profile architecture (HIGH confidence)
- Codebase analysis: `packages/api/src/services/payment-export.ts` payment generators (HIGH confidence)
- Codebase analysis: `packages/einvoice/src/profiles/zatca/signer.ts` XAdES implementation (HIGH confidence)
- Codebase analysis: `apps/web/src/i18n/routing.ts` locale configuration (HIGH confidence)
- EN 16931 / XRechnung / ZUGFeRD standard knowledge (training data) -- MEDIUM confidence
- BACS Standard 18 specification (training data) -- HIGH confidence, well-established format
- HMRC VAT API (training data) -- MEDIUM confidence, verify endpoints
- VIES API (training data) -- LOW confidence, verify REST availability
- pdf-lib capabilities (training data) -- MEDIUM confidence, verify PDF/A-3b specifics
- IR35 CEST criteria (training data) -- HIGH confidence, publicly documented
- Scheinselbstaendigkeit DRV criteria (training data) -- HIGH confidence, established case law

---
*Stack research for: v5.0 UK & Germany Market Expansion*
*Researched: 2026-04-12*
