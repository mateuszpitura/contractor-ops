# Architecture Research

**Domain:** International expansion of contractor ops platform -- pluggable e-invoicing, multi-currency, multi-region, RTL, government API integrations
**Researched:** 2026-04-11
**Confidence:** HIGH (existing codebase fully inspected, government API specs verified via official sources)

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           apps/web (Next.js)                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌─────────────────────────┐ │
│  │ RTL/i18n │  │ Multi-currency│  │ Gov API   │  │ Country-specific       │ │
│  │ Layout   │  │ Display Layer │  │ Status UI │  │ Contractor Fields UI   │ │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  └──────────┬────────────┘ │
├───────┴───────────────┴────────────────┴─────────────────────┴──────────────┤
│                         packages/api (tRPC)                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ einvoicing   │  │ currency     │  │ tax          │  │ payment        │  │
│  │ router       │  │ router       │  │ router       │  │ router (ext)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬─────────┘  │
├─────────┴──────────────────┴────────────────┴──────────────────┴────────────┤
│                    NEW: packages/einvoicing                                   │
│  ┌─────────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Core Engine     │  │ KSeF     │  │ ZATCA    │  │ Peppol   │            │
│  │ (EN 16931/UBL)  │  │ Profile  │  │ Profile  │  │ PINT-AE  │            │
│  └────────┬────────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│           │                │              │              │                   │
│  ┌────────┴────────┐  ┌───┴──────────────┴──────────────┴────┐             │
│  │ XML/Validation  │  │ Government API Clients               │             │
│  │ Pipeline        │  │ (KSeF, ZATCA Fatoora, Peppol ASP)    │             │
│  └─────────────────┘  └─────────────────────────────────────┘             │
├──────────────────────────────────────────────────────────────────────────────┤
│                    EXISTING: packages/integrations                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Registry │  │ Cred Svc │  │ Webhook  │  │ Health   │  │ ZATCA/Peppol │ │
│  │          │  │ (AES-GCM)│  │ Pipeline │  │ Monitor  │  │ Adapters     │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│                    packages/db (Prisma) + packages/validators (Zod)          │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ einvoice.prisma│ │ currency.prisma│ │ tax.prisma   │ │ consent.prisma│ │
│  │ (submissions, │  │ (rates, Money │  │ (WHT, rules, │  │ (PDPL, data  │ │
│  │  documents)   │  │  conversion)  │  │  certificates)│ │  residency)  │ │
│  └───────────────┘  └──────────────┘  └──────────────┘  └───────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│                    Infrastructure                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Neon PG      │  │ QStash       │  │ R2 Storage   │  │ Vercel Edge   │  │
│  │ (eu-central-1│  │ (async govt  │  │ (XML archive,│  │ (geo-routing) │  │
│  │  + logical   │  │  API calls)  │  │  certificates)│ │               │  │
│  │  replication) │  │              │  │              │  │               │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `packages/einvoicing` (NEW) | Pluggable e-invoicing engine -- XML generation, validation, signing, QR codes | Country profiles implementing abstract core; EN 16931/UBL 2.1 base |
| `packages/integrations` (EXTENDED) | ZATCA + Peppol adapters in existing adapter registry | New `ZatcaAdapter`, `PeppolAdapter` extending `BaseAdapter` |
| `packages/db` (EXTENDED) | New schemas for e-invoice submissions, currency rates, tax rules, WHT, PDPL consent | New Prisma schema files in existing multi-file structure |
| `packages/validators` (EXTENDED) | Zod schemas for ZATCA XML fields, currency amounts, tax calculations | New validator files following existing pattern |
| `packages/api` (EXTENDED) | New tRPC routers for e-invoicing, currency, tax | New routers in existing router structure |
| `apps/web` (EXTENDED) | RTL layout, currency display, government API status UIs | Existing pages + new country-specific components |

## Recommended Project Structure

### New Package: `packages/einvoicing`

```
packages/einvoicing/
├── src/
│   ├── core/
│   │   ├── types.ts                  # InvoiceDocument, LineItem, Party, TaxSubtotal
│   │   ├── ubl-builder.ts            # UBL 2.1 XML document builder
│   │   ├── en16931-validator.ts       # EN 16931 semantic validation rules
│   │   ├── xml-signer.ts             # XML DSig / XAdES signing abstraction
│   │   └── qr-generator.ts           # QR code generation (TLV + standard)
│   ├── profiles/
│   │   ├── base-profile.ts           # Abstract profile interface
│   │   ├── ksef/
│   │   │   ├── ksef-profile.ts       # KSeF FA(3) XML specifics
│   │   │   ├── ksef-mapper.ts        # Invoice -> KSeF FA(3) XML mapping
│   │   │   └── ksef-validator.ts     # KSeF-specific validation rules
│   │   ├── zatca/
│   │   │   ├── zatca-profile.ts      # ZATCA Fatoorah specifics
│   │   │   ├── zatca-mapper.ts       # Invoice -> ZATCA UBL 2.1 mapping
│   │   │   ├── zatca-signer.ts       # ZATCA XML DSig + hash chain
│   │   │   ├── zatca-qr.ts           # TLV-encoded Base64 QR for ZATCA
│   │   │   └── zatca-validator.ts    # ZATCA-specific validation
│   │   └── peppol/
│   │       ├── peppol-profile.ts     # Peppol BIS Billing 3.0
│   │       ├── pint-ae-mapper.ts     # Invoice -> PINT-AE mapping
│   │       └── peppol-validator.ts   # Peppol-specific validation
│   ├── clients/
│   │   ├── zatca-api-client.ts       # ZATCA Fatoora Portal REST API
│   │   └── peppol-asp-client.ts      # Peppol ASP integration client
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Extensions to Existing Packages

```
packages/db/prisma/schema/
├── einvoice.prisma               # NEW: EInvoiceSubmission, EInvoiceDocument, HashChain
├── currency.prisma                # NEW: ExchangeRate, CurrencyConfig
├── tax-rule.prisma                # NEW: TaxRule, WHTRate, WHTCertificate
├── consent.prisma                 # NEW: ConsentRecord, DataResidencyConfig
├── invoice.prisma                 # MODIFIED: add eInvoiceStatus, clearanceRef
├── payment.prisma                 # MODIFIED: add SWIFT format, purpose codes
├── contractor.prisma              # MODIFIED: add country-specific fields JSON
├── organization.prisma            # MODIFIED: add region, taxJurisdiction
└── integration.prisma             # MODIFIED: add ZATCA, PEPPOL to IntegrationProvider enum

packages/integrations/src/adapters/
├── zatca-adapter.ts               # NEW: extends BaseAdapter, ZATCA Fatoorah
├── peppol-adapter.ts              # NEW: extends BaseAdapter, Peppol ASP
└── ksef-adapter.ts                # EXISTING: refactored to use packages/einvoicing

packages/validators/src/
├── einvoicing.ts                  # NEW: ZATCA XML fields, UBL validation
├── currency.ts                    # NEW: exchange rates, Money type validation
├── tax-rules.ts                   # NEW: WHT rates, VAT config validation
└── invoice.ts                     # MODIFIED: multi-currency amount validation

packages/api/src/routers/
├── einvoicing.ts                  # NEW: e-invoice submission, status, history
├── currency.ts                    # NEW: exchange rates, conversion endpoints
├── tax.ts                         # NEW: WHT calculation, tax rule config
└── payment.ts                     # MODIFIED: SWIFT export, purpose codes
```

### Structure Rationale

- **`packages/einvoicing` as a separate package:** The e-invoicing engine has complex XML generation, cryptographic signing, and government-specific validation that should not live inside `packages/integrations`. The integrations package handles connection lifecycle (OAuth, credentials, health) while einvoicing handles document generation and compliance logic. The ZATCA/Peppol adapters in integrations delegate to einvoicing for XML work.
- **Profile-based architecture:** Each country's e-invoicing requirements differ in XML format, validation rules, signing requirements, and QR codes. A profile pattern (similar to the existing `BaseAdapter` pattern) keeps country-specific logic isolated while sharing the UBL 2.1 core.
- **No new `packages/currency`:** Multi-currency is a cross-cutting concern. Exchange rates go in `packages/db`, conversion logic goes in a utility module within `packages/api` or a shared helper in `packages/validators`, display formatting stays in `apps/web`. Creating a full package for this would be overengineering.

## Architectural Patterns

### Pattern 1: E-Invoice Profile Strategy

**What:** Abstract base profile with country-specific implementations, each providing XML generation, validation, signing, and submission logic.
**When to use:** Adding any new country's e-invoicing requirements.
**Trade-offs:** More initial setup per country, but complete isolation of country-specific logic. Prevents one country's changes from breaking another.

```typescript
// packages/einvoicing/src/profiles/base-profile.ts
export interface EInvoiceProfile {
  readonly countryCode: string;
  readonly formatName: string;

  /** Generate compliant XML from normalized invoice data */
  generateXml(invoice: InvoiceDocument): Promise<string>;

  /** Validate invoice against country-specific rules */
  validate(invoice: InvoiceDocument): ValidationResult;

  /** Sign XML (XML DSig, XAdES, or country-specific) */
  signXml?(xml: string, certificate: SigningCertificate): Promise<string>;

  /** Generate QR code data (TLV for ZATCA, standard for others) */
  generateQrData?(invoice: InvoiceDocument): string;

  /** Submit to government API (clearance/reporting) */
  submit?(signedXml: string, client: GovernmentApiClient): Promise<SubmissionResult>;
}

// packages/einvoicing/src/profiles/zatca/zatca-profile.ts
export class ZatcaProfile implements EInvoiceProfile {
  readonly countryCode = "SA";
  readonly formatName = "ZATCA Fatoorah UBL 2.1";

  async generateXml(invoice: InvoiceDocument): Promise<string> {
    // ZATCA-specific UBL 2.1 with required extensions
    // UUID, seller/buyer TIN, hash of previous invoice
  }

  validate(invoice: InvoiceDocument): ValidationResult {
    // ZATCA-specific: TIN format, hash chain, mandatory fields
  }

  async signXml(xml: string, cert: SigningCertificate): Promise<string> {
    // XML DSig with X.509 CSD certificate from ZATCA
  }

  generateQrData(invoice: InvoiceDocument): string {
    // TLV-encoded Base64: seller name, VAT number, timestamp, total, VAT
  }

  async submit(signedXml: string, client: GovernmentApiClient): Promise<SubmissionResult> {
    // B2B: clearance (synchronous validation by ZATCA)
    // B2C: reporting (within 24 hours)
  }
}
```

### Pattern 2: Integration Adapter Delegation to E-Invoice Engine

**What:** ZATCA and Peppol adapters in `packages/integrations` handle connection lifecycle (credentials, health, webhooks) and delegate document work to `packages/einvoicing`.
**When to use:** Any government e-invoicing API that requires both connection management AND document generation.
**Trade-offs:** Two-package coordination adds indirection but maintains clean separation of concerns. The adapter registry stays lightweight; the heavy XML/crypto work lives in the specialized package.

```typescript
// packages/integrations/src/adapters/zatca-adapter.ts
export class ZatcaAdapter extends BaseAdapter {
  readonly slug = "zatca";
  readonly displayName = "ZATCA Fatoorah";
  readonly supportsOAuth = false;  // Uses CSD certificate, not OAuth
  readonly supportsWebhooks = false;  // Polling-based like KSeF

  async getHealthStatus(connectionId: string): Promise<ProviderHealthStatus> {
    // Same pattern as KsefAdapter -- check sync logs, token expiry
    // ZATCA CSD certificates have expiration dates
  }

  // Document generation delegated to packages/einvoicing
  // This adapter does NOT generate XML -- it manages the connection
}
```

### Pattern 3: Multi-Currency Money Type with Integer Minor Units

**What:** Extend existing integer grosze pattern to handle multiple currencies with different decimal places (AED: 2 decimals = fils, SAR: 2 decimals = halalas, BHD: 3 decimals = fils). All arithmetic stays in minor units. Exchange rate conversion produces a new Money value with explicit rate + timestamp.
**When to use:** Any monetary calculation, display, or storage.
**Trade-offs:** Requires knowing each currency's minor unit factor (stored in a lookup). Conversion always produces a new amount -- never mutate in place.

```typescript
// packages/validators/src/currency.ts
import { z } from "zod";

export const CURRENCY_MINOR_UNITS: Record<string, number> = {
  PLN: 2, EUR: 2, USD: 2, GBP: 2, AED: 2, SAR: 2,
  BHD: 3, KWD: 3, OMR: 3,  // Gulf currencies with 3 decimals
  JPY: 0,                    // Zero-decimal currencies
};

export const moneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z.string().length(3),
});

export const exchangeRateSchema = z.object({
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
  rate: z.number().positive(),        // e.g., 1 PLN = 0.92 SAR
  inverseRate: z.number().positive(),  // e.g., 1 SAR = 1.087 PLN
  effectiveDate: z.date(),
  source: z.enum(["ECB", "MANUAL", "API"]),
});

// Conversion function -- always explicit, never implicit
export function convertCurrency(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): { amountMinor: number; currency: string } {
  const fromDecimals = CURRENCY_MINOR_UNITS[fromCurrency] ?? 2;
  const toDecimals = CURRENCY_MINOR_UNITS[toCurrency] ?? 2;

  // Convert to major units, apply rate, convert back to minor units
  const majorAmount = amountMinor / Math.pow(10, fromDecimals);
  const convertedMajor = majorAmount * rate;
  const convertedMinor = Math.round(convertedMajor * Math.pow(10, toDecimals));

  return { amountMinor: convertedMinor, currency: toCurrency };
}
```

### Pattern 4: Country-Scoped Tax Rules via Organization Configuration

**What:** Tax rules (VAT rates, WHT rates, reverse charge rules) stored per-organization based on their `countryCode` and `taxJurisdiction`. Rules are configurable but seeded with country defaults. The tax engine resolves applicable rules at invoice/payment time.
**When to use:** Any tax calculation -- VAT on invoices, WHT on cross-border payments.
**Trade-offs:** Slightly more complex than hardcoded Polish VAT, but essential for multi-market. Default seeding means zero config for standard cases.

```typescript
// Tax rule resolution at invoice time
async function resolveTaxRules(
  orgId: string,
  contractorCountry: string,
  serviceType: string,
): Promise<TaxRuleSet> {
  const org = await getOrganization(orgId);

  // 1. Get org's country VAT rate
  const vatRule = await getVatRule(org.countryCode, serviceType);

  // 2. Check for reverse charge (cross-border B2B within EU)
  const reverseCharge = shouldApplyReverseCharge(org.countryCode, contractorCountry);

  // 3. Check for WHT (Saudi cross-border payments)
  const whtRule = await getWhtRule(org.countryCode, contractorCountry, serviceType);

  return { vatRule, reverseCharge, whtRule };
}
```

### Pattern 5: QStash-Based Government API Submission Pipeline

**What:** All government API calls (ZATCA clearance, Peppol submission, KSeF sync) go through QStash for reliability. The flow: tRPC mutation triggers QStash job, QStash calls a Next.js API route, API route calls the einvoicing engine, result is stored in DB and surfaces via tRPC query.
**When to use:** Any government API interaction that can fail, retry, or take time.
**Trade-offs:** Async means UI needs polling/optimistic state. But government APIs are unreliable and slow -- synchronous calls would block the user and risk timeouts.

```
User submits invoice for clearance
    |
tRPC mutation: creates EInvoiceSubmission (status: PENDING)
    |
QStash: enqueue "zatca-clearance" job with submissionId
    |
API route: /api/qstash/zatca-clearance
    |
packages/einvoicing: generateXml() -> signXml() -> submit()
    |
DB update: EInvoiceSubmission (status: CLEARED | REJECTED)
    |
User polls via tRPC query or receives notification
```

## Data Flow

### E-Invoice Submission Flow (ZATCA Example)

```
Invoice (existing) -> [Generate XML] -> [Validate] -> [Sign with CSD] -> [Add QR] -> [Submit to ZATCA]
       |                    |              |              |                |              |
  packages/db        einvoicing/      einvoicing/    einvoicing/     einvoicing/    integrations/
  Invoice model      core/ubl-builder profiles/zatca  profiles/zatca  profiles/zatca  zatca-adapter
                     + zatca-mapper   zatca-validator  zatca-signer    zatca-qr       -> zatca-api-client
```

### Multi-Currency Invoice Processing Flow

```
Invoice received (SAR amount)
    |
OCR/KSeF/Portal extracts: { amountMinor: 150000, currency: "SAR" }
    |
Match against contract (contract may be in PLN)
    |
Currency conversion: SAR 1500.00 -> PLN at rate from ExchangeRate table
    |
Deviation check: converted PLN amount vs expected contract amount
    |
Store both original (SAR) and converted (PLN) amounts on invoice
    |
Payment run: group by currency, SWIFT export for SAR, SEPA for PLN
```

### RTL Layout Flow

```
Request with locale cookie/header
    |
next-intl resolves locale (ar, pl, en)
    |
Root layout: <html lang={locale} dir={rtlLocales.includes(locale) ? 'rtl' : 'ltr'}>
    |
shadcn/ui components: logical CSS properties (ms-*, me-*, ps-*, pe-*, start-*, end-*)
    |
Tailwind RTL plugin: rtl:rotate-180 on directional icons (chevrons, arrows)
    |
Currency/number formatting: Intl.NumberFormat(locale, { style: 'currency', currency })
```

### Key Data Flows

1. **E-invoice lifecycle:** Invoice created/received -> XML generated per country profile -> validated -> signed -> submitted to government API via QStash -> clearance/rejection stored -> status surfaces in UI
2. **Multi-currency payment:** Invoices in mixed currencies -> grouped by currency in payment run -> SEPA export for EUR/PLN, SWIFT export for AED/SAR/GBP -> purpose codes added for Gulf SWIFT transfers
3. **WHT calculation:** Cross-border payment detected (org=SA, contractor=foreign) -> resolve WHT rate by service type + treaty -> calculate withholding -> generate WHT certificate -> net payment = gross - WHT
4. **Country profile onboarding:** Organization selects country -> tax rules seeded (VAT rates, WHT rates) -> e-invoicing profile configured -> contractor fields schema adjusted (freelance permit for UAE, commercial registration for SA)

## Schema Changes

### New Models

```prisma
// einvoice.prisma
model EInvoiceSubmission {
  id                String              @id @default(cuid())
  organizationId    String
  invoiceId         String
  profile           EInvoiceProfile     // KSEF, ZATCA, PEPPOL
  status            EInvoiceStatus      // PENDING, GENERATING, SUBMITTED, CLEARED, REJECTED, ERROR
  xmlDocumentId     String?             // Reference to R2-stored XML
  signedXmlDocumentId String?
  governmentRef     String?             // KSeF ref, ZATCA clearance ID, Peppol message ID
  previousHashRef   String?             // For ZATCA hash chain
  qrCodeData        String?
  submittedAt       DateTime?
  clearedAt         DateTime?
  rejectedAt        DateTime?
  rejectionReason   String?
  retryCount        Int                 @default(0)
  lastErrorMessage  String?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  organization      Organization        @relation(fields: [organizationId], references: [id])
  invoice           Invoice             @relation(fields: [invoiceId], references: [id])

  @@index([organizationId])
  @@index([organizationId, invoiceId])
  @@index([organizationId, status])
}

// currency.prisma
model ExchangeRate {
  id              String   @id @default(cuid())
  organizationId  String?  // null = system-wide rate
  fromCurrency    String   @db.Char(3)
  toCurrency      String   @db.Char(3)
  rate            Decimal  @db.Decimal(18, 8)
  inverseRate     Decimal  @db.Decimal(18, 8)
  effectiveDate   DateTime @db.Date
  source          String   // ECB, MANUAL, etc.
  createdAt       DateTime @default(now())

  organization    Organization? @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, fromCurrency, toCurrency, effectiveDate])
  @@index([fromCurrency, toCurrency, effectiveDate])
}

// tax-rule.prisma
model TaxRule {
  id              String   @id @default(cuid())
  organizationId  String?  // null = system default
  countryCode     String   @db.Char(2)
  taxType         TaxType  // VAT, WHT, CORPORATE_TAX
  name            String
  rate            Decimal  @db.Decimal(8, 4)
  serviceCategory String?  // For WHT: MANAGEMENT, TECHNICAL, ROYALTY
  appliesToNonResident Boolean @default(false)
  effectiveFrom   DateTime @db.Date
  effectiveTo     DateTime? @db.Date
  createdAt       DateTime @default(now())

  organization    Organization? @relation(fields: [organizationId], references: [id])

  @@index([countryCode, taxType])
}

model WhtCertificate {
  id              String   @id @default(cuid())
  organizationId  String
  invoiceId       String
  contractorId    String
  grossAmountMinor Int
  whtAmountMinor  Int
  whtRate         Decimal  @db.Decimal(8, 4)
  netAmountMinor  Int
  currency        String   @db.Char(3)
  certificateRef  String?
  documentId      String?  // Generated PDF stored in R2
  issuedAt        DateTime @default(now())

  organization    Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([organizationId, contractorId])
}

// consent.prisma
model ConsentRecord {
  id              String      @id @default(cuid())
  organizationId  String
  entityType      String      // CONTRACTOR, PORTAL_USER
  entityId        String
  consentType     String      // DATA_PROCESSING, CROSS_BORDER_TRANSFER, MARKETING
  jurisdiction    String      @db.Char(2) // AE, SA
  granted         Boolean
  grantedAt       DateTime?
  revokedAt       DateTime?
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime    @default(now())

  organization    Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, entityType, entityId])
  @@index([organizationId, consentType])
}
```

### Modified Existing Models

```prisma
// invoice.prisma -- ADD fields
model Invoice {
  // ... existing fields ...
  originalCurrency      String?   @db.Char(3)   // Original invoice currency
  originalAmountMinor   Int?                     // Original amount before conversion
  exchangeRateId        String?                  // Rate used for conversion
  eInvoiceProfile       String?                  // KSEF, ZATCA, PEPPOL
  eInvoiceStatus        String?                  // CLEARED, REPORTED, PENDING
  governmentRef         String?                  // External reference from govt API
  eInvoiceSubmissions   EInvoiceSubmission[]
}

// payment.prisma -- ADD to PaymentExportFormat enum
enum PaymentExportFormat {
  CSV
  BANK_FILE
  SEPA_XML
  MT940
  XML
  API_PUSH
  SWIFT_MT103    // NEW: SWIFT single payment
  SWIFT_MT101    // NEW: SWIFT batch payment
}

// payment.prisma -- ADD to PaymentRunItem
model PaymentRunItem {
  // ... existing fields ...
  purposeCode     String?   @db.VarChar(10)  // SWIFT purpose code (e.g., SCVE for services)
  whtAmountMinor  Int?                        // Withheld tax amount
  netAmountMinor  Int?                        // Amount after WHT
}

// organization.prisma -- ADD fields
model Organization {
  // ... existing fields ...
  taxJurisdiction   String?   @db.Char(2)  // Primary tax jurisdiction
  region            String?                 // Deployment region hint
  eInvoiceProfile   String?                 // Default e-invoice profile
}

// contractor.prisma -- ADD to ContractorType enum
enum ContractorType {
  SOLE_TRADER
  COMPANY
  INDIVIDUAL_FREELANCER
  FREEZONE_ENTITY        // NEW: UAE free zone
  MICRO_ENTREPRENEUR     // NEW: France
  OTHER
}

// integration.prisma -- ADD to IntegrationProvider enum
enum IntegrationProvider {
  // ... existing providers ...
  ZATCA              // NEW
  PEPPOL             // NEW
}
```

## Integration Points with Existing Architecture

### What Gets Reused Directly

| Existing Component | How v4.0 Uses It |
|-------------------|-----------------|
| `BaseAdapter` + adapter registry | ZATCA and Peppol adapters register via `registerAdapter()` |
| `CredentialService` (AES-256-GCM) | ZATCA CSD certificates and Peppol ASP credentials stored encrypted |
| QStash pipeline | Government API calls (clearance, reporting) use existing async pattern |
| Health monitoring | ZATCA/Peppol health status follows same `getHealthStatus()` pattern |
| `IntegrationSyncLog` | All government API interactions logged via existing sync log model |
| `WebhookDelivery` | Peppol ASP may send webhooks for delivery receipts |
| Multi-tenant scoping | All new models include `organizationId` + existing Prisma extension |
| `InvoiceSource` enum | Add `ZATCA` and `PEPPOL` sources (already has `KSEF`) |
| next-intl | Add Arabic locale + RTL detection |
| Integer minor units | All new monetary fields use `*Minor: Int` pattern |
| Document/R2 storage | XML documents, signed XML, WHT certificates stored via existing document service |

### What Gets Modified

| Component | Change | Risk |
|-----------|--------|------|
| `KsefAdapter` | Refactor to delegate XML parsing to `packages/einvoicing` KSeF profile | LOW -- adapter becomes thinner, logic moves to dedicated package |
| `KsefApiClient` | Move to `packages/einvoicing/src/clients/` or keep in integrations and import | LOW -- just a location change |
| Invoice model | Add e-invoice fields + multi-currency fields | LOW -- additive columns only |
| Payment export | Add SWIFT formats + purpose codes | LOW -- new enum values + export generator |
| `PaymentExportFormat` enum | Add SWIFT_MT103, SWIFT_MT101 | LOW -- additive |
| `IntegrationProvider` enum | Add ZATCA, PEPPOL | LOW -- additive |
| Organization model | Add taxJurisdiction, region, eInvoiceProfile | LOW -- additive nullable columns |

### What Is Completely New

| Component | Complexity | Dependencies |
|-----------|-----------|-------------|
| `packages/einvoicing` | HIGH | `packages/db`, `packages/validators`, node:crypto |
| ZATCA API client | MEDIUM | ZATCA sandbox/prod, CSD certificates |
| Peppol ASP client | MEDIUM | Third-party ASP provider selection required |
| Multi-currency exchange rate service | MEDIUM | ECB API or manual rate entry |
| WHT calculator + certificate generator | LOW-MEDIUM | Tax rule configuration |
| Arabic locale files + RTL layout | MEDIUM | next-intl, shadcn RTL mode |
| PDPL consent management | LOW | New DB models + UI forms |
| SWIFT payment export generator | LOW-MEDIUM | MT103/MT101 format specification |
| Country-specific contractor fields | LOW | JSON schema in existing `customFieldsJson` |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-50 orgs (current) | Single Neon instance in eu-central-1. Government API calls via QStash. No caching needed for exchange rates. |
| 50-500 orgs | ECB rate caching in Upstash Redis (rates change daily, cache for 1h). ZATCA API rate limiting may require per-org queuing. Peppol ASP selection affects throughput. |
| 500+ orgs | Logical replication from Neon eu-central-1 to a second Neon project in ap-southeast-1 (Singapore, closest to Gulf). Read replicas for Gulf users. Consider dedicated ZATCA submission queue per large org. |

### Neon Multi-Region Strategy

Neon does NOT have a Middle East region. Available closest options:
- **Primary:** `aws-eu-central-1` (Frankfurt) -- existing, serves EU + UK
- **Gulf read replica:** `aws-ap-southeast-1` (Singapore) -- closest to UAE/Saudi
- **Implementation:** Neon logical replication from Frankfurt to Singapore project
- **Latency:** Frankfurt-to-Dubai ~100ms, Singapore-to-Dubai ~80ms -- marginal improvement
- **Recommendation:** Stay on Frankfurt for now. Gulf latency is acceptable for B2B SaaS (not real-time). Revisit when Neon adds `me-south-1` (Bahrain) or `me-central-1` (UAE).

### Scaling Priorities

1. **First bottleneck:** ZATCA API rate limits during invoice volume spikes. Mitigation: per-org QStash queuing with configurable concurrency.
2. **Second bottleneck:** Exchange rate freshness for multi-currency matching. Mitigation: daily ECB rate fetch + manual override capability.

## Anti-Patterns

### Anti-Pattern 1: Monolithic E-Invoice Processor

**What people do:** Put all country-specific XML generation, signing, validation, and API calls in a single service or a single massive function with country-code switches.
**Why it's wrong:** Each country's requirements are complex enough to warrant isolation. ZATCA needs hash chains and TLV QR codes; KSeF needs RSA-OAEP auth and FA(3) format; Peppol needs ASP routing. Mixing them creates untestable spaghetti.
**Do this instead:** Profile-per-country pattern. Each profile is independently testable and deployable.

### Anti-Pattern 2: Synchronous Government API Calls

**What people do:** Call ZATCA clearance API synchronously in the tRPC mutation that processes the invoice.
**Why it's wrong:** Government APIs are slow (2-10 seconds for ZATCA clearance), unreliable (maintenance windows), and rate-limited. Synchronous calls block the user and risk Vercel function timeouts (default 10s).
**Do this instead:** QStash-based async pipeline. Create submission record immediately, process via background job, surface result via polling or notification.

### Anti-Pattern 3: Implicit Currency Conversion

**What people do:** Auto-convert all amounts to org's default currency at storage time, discarding the original currency/amount.
**Why it's wrong:** Audit trails require original amounts. Exchange rates change daily. WHT calculations need original currency. Tax authorities audit in the original transaction currency.
**Do this instead:** Always store original `currency` + `amountMinor`. Store converted amounts separately with explicit rate reference. Never overwrite originals.

### Anti-Pattern 4: Hardcoded Tax Rates

**What people do:** Replace the existing hardcoded Polish VAT with hardcoded rate tables per country.
**Why it's wrong:** Tax rates change (Saudi VAT went from 5% to 15% in 2020). WHT rates vary by treaty. New countries mean code changes instead of data changes.
**Do this instead:** Tax rules in the database, seeded with defaults, configurable per org. Rate lookups at calculation time with effective date filtering.

### Anti-Pattern 5: RTL as an Afterthought CSS Override

**What people do:** Build the entire UI in LTR, then add RTL-specific CSS overrides and `[dir="rtl"]` selectors.
**Why it's wrong:** Maintenance nightmare. Every new component needs RTL overrides. Icons, animations, and spacing all break.
**Do this instead:** Use CSS logical properties from the start (shadcn/ui supports this with `rtl: true` in components.json). Set `dir` attribute on `<html>`. Use `rtl:rotate-180` for directional icons. Test Arabic layout from day one of RTL phase.

## Integration Points: External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| ZATCA Fatoora Portal | REST API with CSD certificate auth | Sandbox available for testing. CSD cert must be obtained from ZATCA-approved providers (Geotrust, Digicert). NOT Let's Encrypt. |
| Peppol ASP (UAE) | REST API via chosen ASP provider | Must select an accredited ASP. Options TBD when UAE publishes approved list (expected mid-2026). |
| ECB Exchange Rates | Daily XML feed from ECB | Free, no auth. `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml` |
| KSeF (refactored) | Existing REST API, moves under einvoicing package | No new integration -- architectural refactor only |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `packages/api` <-> `packages/einvoicing` | Direct import | tRPC routers call einvoicing engine functions directly |
| `packages/einvoicing` <-> `packages/integrations` | Adapter delegates to profile | ZATCA/Peppol adapters import from einvoicing for XML work |
| `packages/einvoicing` <-> `packages/db` | Prisma client via import | XML storage, submission status, hash chain lookups |
| `packages/api` <-> QStash | HTTP (existing pattern) | Government API calls enqueued as QStash jobs |
| QStash -> Next.js API routes -> `packages/einvoicing` | HTTP callback | Background job handler calls einvoicing engine |

## Suggested Build Order

The build order respects dependency chains: infrastructure first, then features that depend on it.

| Phase | What | Why This Order | Dependencies |
|-------|------|----------------|-------------|
| 1 | Multi-currency schema + exchange rate service | Foundation for all Gulf monetary operations. Invoice, payment, contractor models need currency support before anything else. | None -- additive schema changes |
| 2 | Multi-tier tax engine (VAT rules DB, WHT calculator) | Tax calculation is needed by e-invoicing XML generation and payment processing. | Phase 1 (currency) |
| 3 | `packages/einvoicing` core (UBL builder, EN 16931 validator, profile interface) | The abstract engine must exist before any country profile. KSeF refactor validates the architecture. | None (parallel with 1-2 possible) |
| 4 | KSeF profile refactor | Migrate existing KSeF XML parsing into the new einvoicing engine. Proves the profile pattern works with real production code. | Phase 3 (einvoicing core) |
| 5 | ZATCA profile + API client | Highest-complexity government integration. ZATCA is mandatory NOW in Saudi. | Phases 2 (tax), 3 (einvoicing core) |
| 6 | Peppol PINT-AE profile + ASP client | UAE e-invoicing. Depends on ASP provider selection. Can start once core engine exists. | Phase 3 (einvoicing core) |
| 7 | SWIFT payment export + purpose codes | Gulf payment infrastructure. | Phase 1 (currency) |
| 8 | Arabic RTL + i18n | Can be built in parallel with backend work. shadcn RTL mode + next-intl Arabic locale. | None (frontend-only) |
| 9 | Country-specific contractor fields + PDPL consent | UAE/Saudi contractor profiles, freelance permits, data protection consent. | Phase 1 (for currency fields) |
| 10 | Multi-region infrastructure | Deployment optimization. Least urgent -- Gulf latency is acceptable from Frankfurt. | All above stable |

**Critical path:** Phases 1 -> 2 -> 3 -> 5 (multi-currency -> tax -> einvoicing core -> ZATCA)

**Parallelizable:** Phases 7, 8, 9 can run alongside phases 4-6.

## Sources

- [ZATCA E-Invoicing Official Portal](https://zatca.gov.sa/en/E-Invoicing/Pages/default.aspx)
- [ZATCA E-Invoicing Detailed Technical Guidelines (PDF)](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-invoicing-Detailed-Technical-Guideline.pdf)
- [ZATCA Roll-out Phases](https://zatca.gov.sa/en/E-Invoicing/Introduction/Pages/Roll-out-phases.aspx)
- [UAE Electronic Invoicing Guidelines V1.0 (Feb 2026)](https://mof.gov.ae/wp-content/uploads/2026/02/UAE-Electronic-Invoicing-Guidelines_V-1.0-23Feb2026.pdf)
- [Avalara: UAE e-invoicing mandate 2026 ASP and PINT AE](https://www.avalara.com/blog/en/europe/2026/03/uae-e-invoicing-mandate-2026-readiness-asp-pint-ae.html)
- [Peppol BIS Billing 3.0 Syntax](https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/)
- [Neon Regions Documentation](https://neon.com/docs/introduction/regions)
- [shadcn/ui RTL Support (January 2026)](https://ui.shadcn.com/docs/changelog/2026-01-rtl)
- [shadcn/ui RTL Documentation](https://ui.shadcn.com/docs/rtl)
- [next-intl RTL Usage](https://next-intl.dev/docs/usage/translations)
- [EN 16931 Validation Artefacts (GitHub)](https://github.com/ConnectingEurope/eInvoicing-EN16931)
- [Adyen Currency Codes and Minor Units](https://docs.adyen.com/development-resources/currency-codes)
- Existing codebase: `packages/integrations/src/adapters/base-adapter.ts`, `ksef-adapter.ts`, `ksef-api-client.ts`, `registry.ts`
- Existing codebase: `packages/db/prisma/schema/invoice.prisma`, `payment.prisma`, `organization.prisma`, `contractor.prisma`, `integration.prisma`

---
*Architecture research for: v4.0 International Foundation & Gulf Expansion*
*Researched: 2026-04-11*
