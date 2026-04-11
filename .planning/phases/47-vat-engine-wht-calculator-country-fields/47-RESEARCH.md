# Phase 47: VAT Engine, WHT Calculator & Country Fields — Research

**Researched:** 2026-04-11
**Phase Goal:** Organizations see correct VAT applied per country rules, Saudi WHT is calculated and certified for cross-border payments, and contractor profiles capture country-specific compliance fields
**Requirements:** TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, PROF-01, PROF-02, PROF-03, PROF-04

## Executive Summary

This phase adds three interconnected tax/compliance subsystems: (1) a DB-driven VAT rate engine replacing the hardcoded `vatRate` enum, (2) a Saudi WHT calculator with certificate PDF generation, and (3) country-specific contractor profile fields activated by organization country. All build on existing Prisma schema, Zod validators, tRPC routers, and the Phase 46 Dinero.js v2 money infrastructure.

---

## 1. Current State Analysis

### Invoice Tax Infrastructure
- **`packages/validators/src/invoice.ts`**: `vatRate` is a hardcoded `z.enum(["23", "8", "5", "0", "ZW", "NP"])` — Polish-only rates
- Invoice model has `vatRate: String?`, `vatAmountMinor: Int?`, `withholdingMinor: Int?` fields
- Amount validation refine already handles: `totalMinor === subtotalMinor + vatAmountMinor - withholdingMinor`
- `amountToPayMinor` enforced equal to `totalMinor` (second refine)

### Organization Model
- `Organization` has `countryCode: String? @db.Char(2)` and `defaultCurrency: String? @db.Char(3)`
- `settingsJson: Json?` available for additional config (could store tax settings)

### Contractor Model
- `Contractor` has `countryCode: String @db.Char(2)`, `taxId: String?`, `vatId: String?`
- `customFieldsJson: Json?` exists but is for user-defined fields — `countryFields` should be a separate JSONB column (D-06)
- `ContractorBillingProfile` has `countryCode`, `taxId`, `vatId`

### Payment Infrastructure
- `PaymentRunItem` has `amountMinor: Int` and `currency: String` — no WHT fields yet
- `PaymentExport` handles file generation — WHT certificate is a separate document type

### E-Invoice Package
- `EInvoiceTaxSubtotal` already has `taxCategory: string` with values S/Z/E/AE — "AE" = reverse charge
- `EInvoice.taxBreakdown` array supports multiple tax categories per invoice

### Existing PDF Generation
- `react-pdf` (v10.4.1) already installed in `apps/web` — use for WHT certificate
- React-PDF renders on the server via Node.js `renderToBuffer()` or on client

---

## 2. VAT Rate Engine Design

### TaxRate Prisma Model

```prisma
model TaxRate {
  id            String    @id @default(cuid())
  countryCode   String    @db.Char(2)
  code          String    @db.VarChar(10)   // e.g., "23", "8", "5", "0", "ZW", "NP", "AE-5", "SA-15"
  description   String    @db.VarChar(100)  // e.g., "Standard rate", "Reduced rate"
  ratePercent   Decimal   @db.Decimal(5, 2) // 23.00, 5.00, 15.00, 0.00
  isDefault     Boolean   @default(false)   // Default rate for the country
  isReverseCharge Boolean @default(false)   // Reverse charge indicator
  isExempt      Boolean   @default(false)   // Tax exempt (ZW, NP equivalents)
  effectiveFrom DateTime  @db.Date
  effectiveTo   DateTime? @db.Date          // NULL = still active
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([countryCode, code, effectiveFrom])
  @@index([countryCode])
  @@index([countryCode, effectiveFrom, effectiveTo])
}
```

### Seed Data
- **Poland (PL):** 23% standard, 8% reduced, 5% reduced, 0% zero-rate, ZW exempt, NP not-applicable
- **UAE (AE):** 5% standard (since Jan 2018), 0% zero-rate
- **Saudi Arabia (SA):** 15% standard (since Jul 2020), 0% zero-rate

### Validator Migration
Replace `z.enum(["23", "8", "5", "0", "ZW", "NP"])` with `z.string().max(10)` in invoice validators.
The frontend fetches available rates from a tRPC endpoint filtered by org country.
Validation at creation time checks the provided vatRate code exists in TaxRate for the org's country.

### Reverse Charge Detection Logic

```typescript
function shouldApplyReverseCharge(
  sellerCountry: string,
  buyerCountry: string,
  buyerHasVatId: boolean,
  invoiceType: "B2B" | "B2C"
): boolean {
  // Cross-border B2B within supported countries
  if (sellerCountry === buyerCountry) return false;
  if (invoiceType !== "B2B") return false;
  if (!buyerHasVatId) return false;
  
  // EU reverse charge: cross-border B2B with valid VAT ID
  const euCountries = ["PL", "DE", "FR", /* ... */];
  if (euCountries.includes(sellerCountry) && euCountries.includes(buyerCountry)) {
    return true;
  }
  
  // GCC: No standardized reverse charge between GCC states yet
  // but allow override per invoice (D-03)
  return false;
}
```

Key: Engine auto-detects and sets `isReverseCharge` flag + overridable per invoice.

---

## 3. WHT Calculator Design

### WithholdingTaxRate Prisma Model

```prisma
model WithholdingTaxRate {
  id                    String   @id @default(cuid())
  sourceCountry         String   @db.Char(2)    // Country imposing WHT (e.g., "SA")
  contractorResidency   String   @db.Char(2)    // Contractor's tax residency
  serviceType           String   @db.VarChar(50) // e.g., "technical_services", "management_fees", "royalties"
  standardRate          Decimal  @db.Decimal(5, 2) // Without treaty (e.g., 20%)
  treatyRate            Decimal? @db.Decimal(5, 2) // With treaty (e.g., 5%, 10%)
  treatyReference       String?  @db.VarChar(100)  // e.g., "Saudi-UK DTA Article 12"
  effectiveFrom         DateTime @db.Date
  effectiveTo           DateTime? @db.Date
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([sourceCountry, contractorResidency, serviceType, effectiveFrom])
  @@index([sourceCountry])
  @@index([sourceCountry, contractorResidency])
}
```

### Saudi WHT Rates (Seed Data)
Saudi Arabia applies WHT on payments to non-residents:
- **Technical services/consultancy:** 5% standard, treaty rates vary (e.g., UK=5%, Germany=5%, Poland=5%)
- **Management fees:** 20% standard, treaty rates vary
- **Royalties:** 15% standard, treaty rates vary
- **Rent (equipment):** 5% standard

### Calculator Service

```typescript
interface WhtCalculation {
  grossAmountMinor: number;
  whtRate: Decimal;
  whtAmountMinor: number;
  netAmountMinor: number;
  treatyApplied: boolean;
  treatyReference: string | null;
  rateSource: "treaty" | "standard";
}

async function calculateWht(
  orgCountry: string,
  contractorResidency: string,
  serviceType: string,
  grossAmountMinor: number,
  paymentDate: Date
): Promise<WhtCalculation | null> {
  // Only Saudi currently imposes WHT in our system
  // Returns null if no WHT applicable
}
```

Integration point: During payment run creation, WHT is calculated per item and populates `withholdingMinor` on the invoice / payment run item.

### WHT Certificate PDF

Using `react-pdf` (already in `apps/web`), create a server-rendered PDF with:
- Organization branding (logo, colors from existing branding system)
- Certificate number (auto-generated: `WHT-{orgId}-{year}-{seq}`)
- Payment details: gross amount, WHT rate, WHT amount, net paid
- Contractor details: name, tax ID, residency country
- Treaty reference if applicable
- Payment date and organization signature block

Store as a `Document` record with type extension, linked to the payment run item.

---

## 4. Country-Specific Profile Fields

### countryFields JSONB Column

Add `countryFields Json?` to `Contractor` model. Zod schema validates per country:

```typescript
const uaeCountryFieldsSchema = z.object({
  freelancePermitNumber: z.string().optional(),
  tradeLicenseNumber: z.string().optional(),
  freeZone: z.boolean().optional(),
  tradeLicenseExpiry: z.string().date().optional(),
});

const saudiCountryFieldsSchema = z.object({
  freelanceSaLicense: z.string().optional(),
  commercialRegistration: z.string().optional(),
  commercialRegistrationExpiry: z.string().date().optional(),
});

// Per-country TIN validation (TAX-04 / PROF-04)
const tinValidators: Record<string, (tin: string) => boolean> = {
  AE: (tin) => /^\d{15}$/.test(tin),           // UAE TRN: 15 digits
  SA: (tin) => /^3\d{9}3\d{3}$/.test(tin),     // Saudi TIN: starts with 3, 13 digits, position 11 is 3
  PL: (tin) => isValidNip(tin),                  // Reuse existing NIP validator
};
```

### UI Integration
- Conditional "Country Compliance" section within existing contractor profile tabs (D-07)
- Show/hide based on org `countryCode`
- Uses existing 8-tab layout — no new tab

---

## 5. Compliance Dashboard Extension

Extend Phase 45's compliance dashboard widget (D-08) with VAT/WHT summary:
- VAT collected/owed per period (aggregated from invoices by status)
- WHT withheld totals (aggregated from payment run items)
- Upcoming tax obligations
- Single compliance surface combining e-invoicing status + tax obligations

tRPC endpoint: `compliance.taxSummary` — returns aggregated figures.

---

## 6. Integration Points & Dependencies

### Phase 45 (E-Invoicing Engine)
- `EInvoiceTaxSubtotal.taxCategory` "AE" = reverse charge — VAT engine sets this
- Compliance dashboard widget from D-08 — extend with tax data

### Phase 46 (Multi-Currency)
- Dinero.js v2 for all monetary calculations (WHT amounts, VAT amounts)
- `homeCurrency` on Organization — determines which TaxRate country to use
- Per-record currency on invoices — VAT calculation uses invoice currency

### Existing Infrastructure
- `withholdingMinor` field already on Invoice — WHT calculator populates this
- Amount validation refine already handles WHT deduction
- `react-pdf` already available for certificate generation
- `Document` model for storing generated PDFs

---

## 7. Key Technical Decisions

1. **TaxRate as separate model** (not enum extension) — allows admin visibility, date-ranged rates, future country additions via seed data only
2. **WHT on payment creation, not invoice creation** — WHT applies when the org pays, not when the invoice is received. Invoice `withholdingMinor` gets populated during payment run assembly.
3. **countryFields separate from customFieldsJson** — structured, validated, country-specific vs. freeform user fields. Different governance.
4. **Server-side PDF generation** — WHT certificates need org branding and are regulatory documents. Generate via API endpoint, store in Document table.
5. **Reverse charge is auto-detected but overridable** — engine flags it, user can toggle per invoice.

---

## 8. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| VAT rate changes mid-fiscal year | Wrong tax on invoices | `effectiveFrom`/`effectiveTo` date ranges on TaxRate |
| Treaty rate lookup misses edge cases | Wrong WHT deduction | Standard rate as fallback, manual override on payment items |
| Country field schema evolution | Migration complexity | JSONB column + Zod validation = schema changes without DB migration |
| PDF generation performance | Slow payment exports | Generate async via QStash, store result in Document |
| Reverse charge false positives | Tax compliance issues | Auto-detect with override + audit log of manual overrides |

---

## Validation Architecture

### Dimension 1: Functional Correctness
- VAT rate lookup returns correct rate for org country + rate code
- Reverse charge detection matches expected outcomes for all country pairs
- WHT calculation matches treaty/standard rates with correct arithmetic
- Country fields validate per Zod schema and reject invalid shapes

### Dimension 2: Data Integrity
- TaxRate seed data matches official government rates
- WithholdingTaxRate treaty data matches published DTA documents
- countryFields JSONB validates on write, never stores invalid shapes
- WHT certificate amounts match payment run item calculations

### Dimension 3: Integration Contracts
- Invoice validator accepts dynamic vatRate codes (not just hardcoded enum)
- Payment run assembly correctly calculates WHT per item
- Compliance dashboard endpoint returns combined e-invoicing + tax data
- Country fields render in contractor profile based on org country

### Dimension 4: Security
- TaxRate and WithholdingTaxRate are read-only (seed data, no admin CRUD)
- WHT certificates are scoped to organization (RLS)
- Country fields follow existing contractor RLS patterns
- PDF generation endpoint requires authentication + org membership

### Dimension 5: Performance
- TaxRate queries indexed by countryCode + date range
- WithholdingTaxRate queries indexed by sourceCountry + contractorResidency
- Compliance dashboard aggregations use materialized counts or cached queries
- PDF generation is async (QStash) to avoid blocking payment flow

---

## RESEARCH COMPLETE
