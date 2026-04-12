# Architecture Research

**Domain:** UK & Germany market expansion integration with existing contractor ops platform
**Researched:** 2026-04-12
**Confidence:** HIGH (codebase-driven analysis with MEDIUM on external API specifics)

## System Overview

```
                         EXISTING ARCHITECTURE (unchanged)
 +---------------------------------------------------------------------------+
 |  apps/web (Next.js)                                                       |
 |   +-----------+  +------------+  +-------------+  +-----------+           |
 |   | next-intl |  | Contractor |  | Invoices /  |  | Payments  |           |
 |   | +de locale|  | + classify |  | e-invoicing |  | + BACS    |           |
 |   +-----------+  +-----+------+  +------+------+  +-----+-----+          |
 +---------------------------------------------------------------------------+
        |                  |                |                |
 +---------------------------------------------------------------------------+
 |  packages/api (tRPC)                                                      |
 |   +-----------+  +------------+  +-------------+  +-----------+           |
 |   | tax router|  | contractor |  | einvoice    |  | payment   |           |
 |   | +HMRC/VIES|  | + classify |  | router      |  | router    |           |
 |   +-----------+  +-----+------+  +------+------+  +-----+-----+          |
 +---------------------------------------------------------------------------+
        |                  |                |                |
 +------+------+  +--------+------+  +------+------+  +-----+------+
 | packages/   |  | NEW:          |  | packages/   |  | packages/  |
 | gov-api     |  | packages/     |  | einvoice    |  | api/       |
 | + HMRC      |  | classification|  | + xrechnung |  | services/  |
 | + VIES      |  |               |  | + zugferd   |  | payment-   |
 +-------------+  +---------------+  +-------------+  | export     |
                                                       | + BACS     |
 +------+------+  +--------+------+                    +------------+
 | packages/   |  | packages/     |
 | validators  |  | db (Prisma)   |
 | + UK/DE     |  | + new schemas |
 | fields/TIN  |  |               |
 +-------------+  +---------------+
```

### Component Responsibilities

| Component | Responsibility | Change Type |
|-----------|----------------|-------------|
| `packages/einvoice` | XRechnung + ZUGFeRD as new country profiles | **EXTEND** (new profiles, pipeline enhancement for PDF/A-3) |
| `packages/gov-api` | HMRC VAT check + VIES USt-IdNr validation | **EXTEND** (new GovApiClient subclasses) |
| `packages/api/services/payment-export` | BACS Standard 18 file generation | **EXTEND** (new export function + format detection rule) |
| `packages/validators/country-fields` | UK + German contractor field schemas | **EXTEND** (new schemas in existing map) |
| `packages/classification` | Contractor classification risk engine | **NEW PACKAGE** |
| `packages/db` | Classification, UK/DE compliance schemas | **EXTEND** (new .prisma files) |
| `apps/web/messages/de.json` | German translations | **NEW FILE** |
| `apps/web` (next-intl config) | Add `de` to supported locales | **MODIFY** (config only) |

## Integration Analysis: Question by Question

### 1. EN 16931 E-Invoicing (XRechnung + ZUGFeRD)

**Can the existing pluggable engine handle these as new country profiles? YES, with one architectural enhancement.**

The `EInvoiceProfile` interface (`generate`, `parse`, `validate`, `getComplianceStatus`, optional `sign`, `qrCode`) maps cleanly to XRechnung. XRechnung is pure UBL 2.1 / UN/CEFACT CII XML -- identical in nature to KSeF FA(3) XML and ZATCA UBL XML. It slots in as:

```
packages/einvoice/src/profiles/xrechnung/
  index.ts       -- XRechnungProfile implements EInvoiceProfile
  generator.ts   -- UBL 2.1 XML generation from EInvoice
  parser.ts      -- UBL 2.1 XML to EInvoice mapping
  validator.ts   -- EN 16931 + XRechnung CIUS rules
  schemas.ts     -- Zod schemas for XRechnung-specific fields
  compliance.ts  -- Leitweg-ID validation, routing status
```

**ZUGFeRD is architecturally different and requires a pipeline enhancement.** ZUGFeRD is PDF/A-3 with embedded CII XML (factur-x.xml attachment). The current pipeline is: `generate XML -> validate -> sign -> QR`. ZUGFeRD needs: `generate CII XML -> validate -> embed XML into PDF/A-3 -> output PDF`.

**Required changes:**

1. **New pipeline step: `embed`** -- Add an optional `Embeddable` capability interface to `EInvoiceProfile`:

```typescript
// New capability in types/profile.ts
export interface Embeddable {
  /** Embed XML into a carrier document (e.g., PDF/A-3 for ZUGFeRD) */
  embed(xml: string, carrierPdf?: Buffer): Promise<Buffer>;
  /** Extract embedded XML from a carrier document */
  extract(document: Buffer): Promise<string>;
}
```

2. **Pipeline extension** -- `runPipeline` gains a new step after validate: if `profile.embed` exists, call it. The `PipelineResult` gains a `document: Buffer | null` field.

3. **PDF/A-3 generation** -- Use `pdf-lib` (already viable in Node.js) or `@nicepage/pdfa-converter` to create PDF/A-3 compliant documents with the CII XML as an AF (Associated File) attachment. This is the key technical challenge. The `pdf-lib` library can manipulate PDFs but PDF/A-3 compliance requires specific metadata (XMP, color profiles). Consider `muhimbi` or building a thin wrapper around `pdf-lib` + `xmp-toolkit`.

**ZUGFeRD profile structure:**

```
packages/einvoice/src/profiles/zugferd/
  index.ts       -- ZugferdProfile implements EInvoiceProfile (with embed capability)
  generator.ts   -- UN/CEFACT CII XML generation
  parser.ts      -- CII XML to EInvoice mapping
  validator.ts   -- EN 16931 + ZUGFeRD profile rules (BASIC, COMFORT, EXTENDED)
  embedder.ts    -- PDF/A-3 creation with embedded factur-x.xml
  extractor.ts   -- Extract CII XML from PDF/A-3
  schemas.ts     -- ZUGFeRD-specific field schemas
```

**Confidence:** HIGH for XRechnung (pure XML, same pattern as existing profiles). MEDIUM for ZUGFeRD PDF/A-3 (PDF/A-3 compliance in Node.js requires careful library selection -- verify `pdf-lib` capabilities during implementation).

### 2. Contractor Classification Engine

**Where it should live: NEW PACKAGE `packages/classification`.**

Rationale for a separate package rather than extending the contractor module:

1. **Distinct domain** -- Classification (IR35 / Scheinselbstaendigkeit) is a risk assessment engine with questionnaire logic, scoring algorithms, and document generation. This is fundamentally different from contractor CRUD.
2. **Multiple consumers** -- The classification engine feeds: contractor profiles (risk score badge), compliance health (classification status as compliance item), reports (risk distribution), and notifications (re-assessment triggers).
3. **Country-pluggable** -- Same pattern as einvoice: a generic `ClassificationEngine` with country-specific `ClassificationRuleSet` implementations.

**Architecture:**

```
packages/classification/
  src/
    types/
      engine.ts          -- ClassificationRuleSet interface
      assessment.ts      -- Assessment, Question, RiskScore types
      document.ts        -- SDS/audit-defense doc generation types
    engine/
      engine.ts          -- ClassificationEngine (orchestrates rule sets)
      scoring.ts         -- Generic risk scoring algorithm
    rulesets/
      ir35/
        index.ts         -- IR35RuleSet implements ClassificationRuleSet
        questions.ts     -- CEST-aligned question bank
        scoring.ts       -- IR35-specific weight/threshold config
        sds-generator.ts -- Status Determination Statement PDF
      scheinselbst/
        index.ts         -- ScheinselbstRuleSet implements ClassificationRuleSet
        questions.ts     -- DRV criteria question bank
        scoring.ts       -- German-specific scoring
        drv-generator.ts -- DRV audit defense documentation
    registry.ts          -- Rule set registry (same pattern as einvoice)
    index.ts
```

**Key interface:**

```typescript
export interface ClassificationRuleSet {
  readonly ruleSetId: string;
  readonly country: string;
  readonly displayName: string;
  
  /** Get the question bank for this classification */
  getQuestions(): ClassificationQuestion[];
  /** Score responses and return risk assessment */
  assess(responses: QuestionResponse[]): ClassificationResult;
  /** Generate determination/defense documents */
  generateDocument(assessment: ClassificationResult): Promise<Buffer>;
}
```

**Integration with existing modules:**

| Integration Point | How |
|-------------------|-----|
| Contractor profile | `classificationStatus` field on Contractor model (JSON, stores latest assessment result + date) |
| Compliance health | Classification expiry as a `ContractorComplianceItem` (type: `CLASSIFICATION`) -- auto-created when assessment completes |
| Country-specific fields | UK: UTR, Companies House number. DE: Steuernummer, Handelsregister. Added to `countryFieldsSchemaMap` in `packages/validators` |
| Notifications | Re-assessment reminders via existing notification system (trigger when contract renews or 12 months elapsed) |

**Database additions (new `classification.prisma`):**

```prisma
model ClassificationAssessment {
  id               String   @id @default(cuid())
  organizationId   String
  contractorId     String
  ruleSetId        String   // "ir35" | "scheinselbst"
  status           ClassificationStatus
  riskScore        Decimal  @db.Decimal(5, 2)
  riskLevel        RiskLevel
  responsesJson    Json
  determinedAt     DateTime
  determinedByUserId String
  expiresAt        DateTime?
  documentId       String?  // Link to generated SDS/defense doc
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([organizationId, contractorId])
  @@index([organizationId, ruleSetId])
}
```

**Confidence:** HIGH -- follows the same pluggable pattern established by einvoice profiles.

### 3. BACS Payment Export

**Can this be added alongside existing SEPA/SWIFT? YES, cleanly as a new format.**

The existing architecture already supports this pattern perfectly:

1. **`PaymentExportFormat` enum** -- Already has CSV, BANK_FILE, SEPA_XML, SWIFT_XML, MT940, XML, API_PUSH. Add `BACS_STD18`.
2. **`payment-export.ts`** -- Add `generateBacsStd18()` alongside existing `generateSepaXml()` and `generateSwiftXml()`.
3. **`payment-format-detection.ts`** -- Add a rule: `GBP + GB IBAN -> BACS_STD18`.

**BACS Standard 18 is a fixed-width flat file format** (similar in concept to the existing Elixir format for Polish domestic transfers). Each record is a fixed-width line with specific field positions for sort code, account number, amount, and reference.

**Implementation:**

```typescript
// In payment-format-detection.ts - add to detectFormat():
if (currency === 'GBP' && ibanCountry === 'GB') {
  return 'BACS_STD18';
}

// In payment-export.ts - new function:
export function generateBacsStd18(
  items: ExportItem[],
  org: OrgBankInfo,
  processingDate: Date
): Buffer {
  // VOL1 header, HDR1/HDR2, UHL1 header record
  // Transaction records (type "CR" for credits)  
  // EOF1/EOF2, UTL1 trailer
}
```

**The `ExportItem` type already has** `contractorName`, `iban` (extract sort code + account from GB IBAN), `amountMinor`, `currency`, `invoiceNumber`, `transferTitle`. No new fields needed.

**UK IBAN structure:** GB + 2 check digits + 4 char bank code + 6 digit sort code + 8 digit account number. The sort code and account number are extractable from the IBAN directly.

**Confidence:** HIGH -- identical integration pattern to Elixir flat file. BACS Standard 18 format is well-documented. MEDIUM on whether Faster Payments needs a separate format (it typically uses BACS or ISO 20022 depending on the bank -- research during implementation).

### 4. German i18n

**Architectural impact of adding German: MINIMAL.**

The existing setup with next-intl and 3 languages (pl, en, ar) is already proven at scale. Adding German (`de`) requires:

1. **New message file:** `apps/web/messages/de.json` -- Translation of all keys from `en.json`.
2. **next-intl config update:** Add `'de'` to the `locales` array.
3. **Middleware update:** Add `'de'` to locale detection.
4. **Locale-aware formatting:** Already uses Intl APIs for date/currency formatting -- German formatting comes free (Intl supports `de-DE` natively).

**Concerns with 4 languages:**

- **Bundle size:** next-intl loads messages per-locale (not all at once), so no bundle impact.
- **RTL:** German is LTR like English and Polish. No new layout direction concerns (Arabic RTL is already handled).
- **Compound nouns:** German has very long compound words (e.g., "Scheinselbstaendigkeitspruefung"). UI may need wider containers or text truncation in table columns and buttons. This is a UI concern, not architectural.
- **Date/number formats:** German uses DD.MM.YYYY dates and 1.234,56 number formatting. Already handled by Intl.DateTimeFormat and Intl.NumberFormat with locale parameter.
- **Translation maintenance:** 4 languages is manageable. The real scaling concern starts at 8+.

**Confidence:** HIGH -- adding a 4th language to next-intl is a well-trodden path, and the existing i18n architecture is already battle-tested with RTL.

### 5. HMRC and VIES Validation APIs

**Do these fit the existing government API framework? YES for HMRC. VIES is simpler but should still use it for consistency.**

**HMRC VAT Check API:**

HMRC provides a REST API for checking UK VAT registration numbers. It requires:
- OAuth 2.0 authentication (application-restricted or user-restricted endpoints)
- Rate limiting (HMRC has strict rate limits)
- Sandbox/production URL switching

This maps directly to the existing `GovApiClient` abstract class:

```typescript
// packages/gov-api/src/clients/hmrc.ts
export class HmrcVatClient extends GovApiClient {
  getApiName() { return 'hmrc-vat'; }
  
  async checkVatNumber(vatNumber: string, orgId: string): Promise<HmrcVatCheckResult> {
    const response = await this.fetch(`/organisations/vat/check-vat-number/lookup/${vatNumber}`, {
      method: 'GET',
    }, { organizationId: orgId });
    // ...
  }
}
```

The existing `GovApiClient` already provides: retry with exponential backoff, timeout via AbortController, audit logging, cert/auth loading from secret store. HMRC uses OAuth rather than cert auth, so the auth header would be set differently -- but the `fetch` method already supports custom headers.

**VIES VAT Validation (EU USt-IdNr):**

VIES provides a SOAP API (legacy) and a newer REST API for validating EU VAT numbers. It is simpler than HMRC (no auth required, just rate-limited), but should still use `GovApiClient` for:
- Rate limiting (VIES is notoriously slow and rate-limited)
- Retry (VIES has frequent downtime)
- Audit logging (compliance record of validation attempts)

```typescript
// packages/gov-api/src/clients/vies.ts
export class ViesClient extends GovApiClient {
  getApiName() { return 'vies'; }
  
  async checkVatNumber(countryCode: string, vatNumber: string, orgId: string): Promise<ViesCheckResult> {
    const response = await this.fetch(
      `/check-vat-number`, 
      { method: 'POST', body: JSON.stringify({ countryCode, vatNumber }) },
      { organizationId: orgId }
    );
    // ...
  }
}
```

**Integration with tax router:** Both HMRC and VIES clients integrate via the existing `tax` tRPC router, adding `tax.validateUkVat` and `tax.validateEuVat` procedures.

**Confidence:** HIGH for architectural fit. MEDIUM on exact HMRC API endpoints (verify during implementation -- HMRC frequently updates their developer documentation).

### 6. Suggested Build Order

Based on dependency analysis:

```
Phase 1: Foundation (no dependencies)
  ├── UK country fields (validators + DB)
  ├── German country fields (validators + DB)  
  ├── UK VAT rates (seed data in TaxRate table)
  ├── German VAT rates (seed data)
  └── German i18n (de.json + config)
       
Phase 2: Government APIs (depends on: nothing new)
  ├── HMRC VAT validation client (extends GovApiClient)
  ├── VIES validation client (extends GovApiClient)
  └── Tax router procedures for validation
       
Phase 3: Classification Engine (depends on: Phase 1 country fields)
  ├── packages/classification (new package)
  ├── IR35 rule set + SDS generation
  ├── Scheinselbstaendigkeit rule set + DRV docs
  ├── Classification DB schema
  └── Contractor profile integration (risk badge, compliance items)
       
Phase 4: E-Invoicing (depends on: Phase 1 for VAT rates, Phase 2 for validation)
  ├── EInvoiceProfile pipeline enhancement (Embeddable interface)
  ├── XRechnung profile (UBL XML -- simpler, do first)
  ├── ZUGFeRD profile (CII XML + PDF/A-3 embedding -- complex, do second)
  └── EN 16931 validation rules
       
Phase 5: Payments (depends on: Phase 1 for GBP support)
  ├── BACS Standard 18 export function
  ├── Format detection rule (GBP + GB -> BACS)
  └── Payment run UI for BACS format
       
Phase 6: Compliance & Polish (depends on: all above)
  ├── UK GDPR adaptations
  ├── German GDPR (BDSG) adaptations
  ├── Chain participant tracking (IR35)
  └── Re-assessment notification triggers
```

**Ordering rationale:**
- **Phase 1 first** because country fields, VAT rates, and i18n are prerequisites for everything else and have zero external dependencies.
- **Phase 2 early** because HMRC/VIES validation is needed by classification (validate tax IDs before classification) and e-invoicing (validate VAT numbers on invoices).
- **Phase 3 before Phase 4** because classification is the key differentiator for UK/DE markets and is independent of e-invoicing. Ship value early.
- **Phase 4 after Phase 3** because XRechnung/ZUGFeRD is the most complex work and benefits from having country fields and VAT rates already in place.
- **Phase 5 late** because BACS is a straightforward format addition with proven patterns (Elixir precedent) -- low risk, can be fast.
- **Phase 6 last** because compliance polish depends on all functional pieces being in place.

## Architectural Patterns

### Pattern 1: Country Profile Plugin (Established)

**What:** Each country/market implements a standard interface. The engine delegates all country-specific logic to the profile. New markets are added without modifying engine code.
**Where used:** `packages/einvoice` (EInvoiceProfile), to be reused in `packages/classification` (ClassificationRuleSet).
**Trade-offs:** Slightly more boilerplate per country vs. inline conditionals, but dramatically better maintainability and testability.

### Pattern 2: Capability Interfaces (Established, Extending)

**What:** Optional behaviors as separate interfaces. A profile declares capabilities it supports (signing, QR codes, PDF embedding) by implementing the corresponding interface.
**Extension needed:** Add `Embeddable` capability for ZUGFeRD PDF/A-3.
**Trade-offs:** Clean optional behavior without forcing empty implementations. Type system enforces correct pipeline behavior.

### Pattern 3: Format Detection with Routing (Established)

**What:** Payment format is auto-detected from currency + IBAN country code. Items are grouped by format, then each group is exported with the appropriate generator.
**Extension needed:** One new rule in `detectFormat()` for GBP + GB -> BACS_STD18.
**Trade-offs:** Simple, deterministic routing. May need override mechanism eventually (e.g., org prefers SWIFT over BACS for some UK payments).

### Pattern 4: Country Fields via JSON + Zod (Established)

**What:** The `Contractor.countryFields` JSON column stores country-specific data, validated by Zod schemas keyed by country code in `countryFieldsSchemaMap`.
**Extension needed:** Add `GB` and `DE` schemas to the map.
**Trade-offs:** Avoids schema migrations for every new country's fields. Zod ensures type safety at runtime. Downside: no DB-level constraints on JSON contents.

## Data Flow

### Classification Assessment Flow

```
[User starts classification]
    |
[Select contractor] -> [Engine loads rule set for contractor.countryCode]
    |
[Display questionnaire] -> [User answers questions]
    |
[Submit responses] -> [Engine.assess(responses)]
    |
[Return ClassificationResult with riskScore, riskLevel, determination]
    |
[Save ClassificationAssessment to DB]
    |
[Create/update ContractorComplianceItem (type: CLASSIFICATION)]
    |
[Generate SDS/DRV document if requested] -> [Store in Document system]
    |
[Update contractor.classificationStatus JSON field]
```

### ZUGFeRD Invoice Flow (New)

```
[Invoice data (EInvoice)]
    |
[ZugferdProfile.generate()] -> CII XML (factur-x.xml)
    |
[ZugferdProfile.validate()] -> EN 16931 + ZUGFeRD rules
    |
[ZugferdProfile.embed.embed(xml, basePdf?)] -> PDF/A-3 with XML attachment
    |
[Pipeline returns PipelineResult with document: Buffer]
    |
[Store PDF/A-3 in R2 + link to Invoice record]
```

### BACS Export Flow (Follows Existing Pattern)

```
[Payment run with GBP items]
    |
[detectFormat('GBP', 'GB...')] -> BACS_STD18
    |
[groupItemsByFormat()] -> groups BACS items together
    |
[generateBacsStd18(items, org, date)] -> Fixed-width flat file Buffer
    |
[Store export in R2 + create PaymentExport record]
```

## Anti-Patterns

### Anti-Pattern 1: Putting Classification Logic in the Contractor Router

**What people do:** Add IR35/Scheinselbstaendigkeit scoring directly to `packages/api/src/routers/contractor.ts` with country-specific if/else branches.
**Why it's wrong:** Classification is a separate domain with its own data model, document generation, and rule versioning. Embedding it in the contractor router creates a 2000+ line file and makes it impossible to test rule sets in isolation.
**Do this instead:** New `packages/classification` package with clean interfaces. The contractor router calls the classification engine, but doesn't contain classification logic.

### Anti-Pattern 2: Forking the Pipeline for ZUGFeRD

**What people do:** Create a separate `runZugferdPipeline()` function that duplicates the generate/validate logic and adds PDF embedding.
**Why it's wrong:** Pipeline logic duplication. Every future pipeline enhancement needs updating in two places.
**Do this instead:** Extend the existing `runPipeline()` with the `Embeddable` capability check -- same pattern as the existing `Signable` and `QRCodeable` checks.

### Anti-Pattern 3: Hardcoding UK Sort Codes in Payment Export

**What people do:** Add UK-specific bank code extraction logic scattered through the payment module.
**Why it's wrong:** The IBAN already contains the sort code (positions 9-14 in a GB IBAN). The `ExportItem` type already has `iban`.
**Do this instead:** Extract sort code and account number from the IBAN within `generateBacsStd18()` as a pure function. No schema changes needed.

### Anti-Pattern 4: Separate HMRC/VIES Fetch Without GovApiClient

**What people do:** Use raw `fetch()` for HMRC/VIES since they're "simple HTTP APIs."
**Why it's wrong:** Loses retry, rate limiting, timeout, and audit logging. VIES is notoriously unreliable and needs all of these. HMRC has strict rate limits.
**Do this instead:** Extend `GovApiClient` even for simple APIs. The base class is lightweight and provides exactly the reliability features these APIs need.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| HMRC VAT API | `GovApiClient` subclass, OAuth 2.0 auth | Rate limited, sandbox available, verify OAuth flow during implementation |
| VIES REST API | `GovApiClient` subclass, no auth needed | Notoriously slow/unreliable, aggressive retry needed, cache valid results |
| XRechnung Leitweg-ID | Validation only (regex + checksum) | No external API -- just format validation |
| ZUGFeRD validator | Local validation against EN 16931 schematron | Consider `mustangproject` via child process or pure JS reimplementation |
| BACS | File export only (no API submission) | Org uploads file to their bank portal manually |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `classification` -> `contractor` | tRPC procedures call classification engine | Classification stores assessment, contractor gets risk badge |
| `classification` -> `compliance` | Classification creates/updates ComplianceItem | Uses existing compliance item pattern |
| `einvoice` (ZUGFeRD) -> Document storage | Pipeline result includes PDF Buffer | Store via existing document upload service (R2) |
| `gov-api` (HMRC/VIES) -> `tax` router | Tax router calls gov-api clients | Existing pattern used by ZATCA/Peppol |
| `payment-export` -> `payment` router | Router calls new `generateBacsStd18()` | Same as existing SEPA/SWIFT/Elixir calls |
| `validators` -> `contractor` router | Country field validation on save | Existing pattern -- just new schemas in map |

## New vs Modified Summary

| Change | Type | Package | Effort |
|--------|------|---------|--------|
| `packages/classification/` | **NEW** | New package | HIGH |
| XRechnung profile | **NEW** | `packages/einvoice/profiles/xrechnung/` | MEDIUM |
| ZUGFeRD profile | **NEW** | `packages/einvoice/profiles/zugferd/` | HIGH |
| `Embeddable` capability interface | **MODIFY** | `packages/einvoice/types/profile.ts` | LOW |
| Pipeline `embed` step | **MODIFY** | `packages/einvoice/engine/pipeline.ts` | LOW |
| HMRC VAT client | **NEW** | `packages/gov-api/src/clients/hmrc.ts` | MEDIUM |
| VIES client | **NEW** | `packages/gov-api/src/clients/vies.ts` | MEDIUM |
| `generateBacsStd18()` | **NEW** | `packages/api/services/payment-export.ts` | MEDIUM |
| BACS format detection rule | **MODIFY** | `packages/api/services/payment-format-detection.ts` | LOW |
| `BACS_STD18` enum value | **MODIFY** | `packages/db/prisma/schema/payment.prisma` | LOW |
| UK country fields schema | **NEW** | `packages/validators/src/country-fields.ts` | LOW |
| DE country fields schema | **NEW** | `packages/validators/src/country-fields.ts` | LOW |
| UK/DE TIN validators | **NEW** | `packages/validators/src/country-fields.ts` | LOW |
| `classification.prisma` | **NEW** | `packages/db/prisma/schema/` | MEDIUM |
| `de.json` translations | **NEW** | `apps/web/messages/de.json` | MEDIUM (volume) |
| UK/DE VAT rate seed data | **NEW** | Seed script | LOW |
| Tax router HMRC/VIES procedures | **MODIFY** | `packages/api/src/routers/tax.ts` | LOW |

## Sources

- Codebase analysis: `packages/einvoice/src/types/profile.ts` (EInvoiceProfile interface)
- Codebase analysis: `packages/einvoice/src/engine/pipeline.ts` (pipeline pattern)
- Codebase analysis: `packages/einvoice/src/profiles/ksef/index.ts` (profile implementation pattern)
- Codebase analysis: `packages/gov-api/src/client.ts` (GovApiClient base class)
- Codebase analysis: `packages/api/src/services/payment-export.ts` (export generators)
- Codebase analysis: `packages/api/src/services/payment-format-detection.ts` (format routing)
- Codebase analysis: `packages/validators/src/country-fields.ts` (country field pattern)
- Codebase analysis: `packages/db/prisma/schema/contractor.prisma` (countryFields JSON pattern)
- Codebase analysis: `packages/db/prisma/schema/payment.prisma` (PaymentExportFormat enum)
- Codebase analysis: `packages/db/prisma/schema/tax.prisma` (TaxRate model for VAT rates)
- Training data: EN 16931, XRechnung, ZUGFeRD specifications (MEDIUM confidence -- verify during implementation)
- Training data: BACS Standard 18 file format (MEDIUM confidence -- verify format spec during implementation)
- Training data: HMRC VAT API, VIES REST API (MEDIUM confidence -- verify endpoints during implementation)

---
*Architecture research for: UK & Germany market expansion*
*Researched: 2026-04-12*
