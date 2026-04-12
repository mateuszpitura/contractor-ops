---
phase: 47-vat-engine-wht-calculator-country-fields
verified: 2026-04-11T17:30:00Z
status: passed
score: 9/9 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 6/9
  gaps_closed:
    - "Reverse charge auto-detection wired into submitForMatching and manualMatch mutations (applyReverseCharge now called in both)"
    - "All UI components integrated into parent pages (VatRateSelector in invoice form, ReverseChargeBanner on invoice detail, WhtSummaryCard in payment panel, TaxObligationsWidget on dashboard, CountryComplianceSection in contractor compliance tab)"
    - "Duplicate singular-directory component files removed (invoice/, contractor/, payment/ directories deleted)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verify VatRateSelector renders correct grouped rates in the invoice form"
    expected: "Dynamic dropdown shows country-specific VAT rates grouped into Standard Rates, Reduced Rates, and Exempt sections"
    why_human: "Visual rendering and API data population require browser and live DB"
  - test: "Verify WHT calculation in a real Saudi payment run"
    expected: "Saudi org payment to UK-resident contractor shows 5% WHT deducted, whtTreatyApplied=true, treaty reference 'Saudi-UK DTA Article 12'"
    why_human: "Requires live DB with seed data and a test organization"
---

# Phase 47: VAT Engine, WHT Calculator, and Country Fields — Verification Report

**Phase Goal:** Configuration-driven multi-tier VAT, Saudi WHT with certificate generation, and country-specific contractor profiles

**Verified:** 2026-04-11T17:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure via plans 47-06 and 47-07

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | VAT rates exist in DB for PL (6), AE (2), SA (2) per country rules | VERIFIED | `packages/db/prisma/seed/tax-rates.ts` — 10 entries with correct codes, rates, effectiveFrom dates |
| 2 | Tax router returns country-specific VAT rates to org | VERIFIED | `packages/api/src/routers/tax.ts` — `getRates` queries org's countryCode, calls `getTaxRatesForCountry` service |
| 3 | Reverse charge is auto-detected and applied when invoice is matched to a contractor | VERIFIED | `packages/api/src/routers/invoice.ts` — `applyReverseCharge` called at lines 578 and 686 in `submitForMatching` and `manualMatch` mutations respectively |
| 4 | Saudi WHT is calculated for cross-border payments | VERIFIED | `packages/api/src/routers/payment.ts` line 26 imports `calculateWht`; line 305 integrates WHT into payment run assembly |
| 5 | WHT certificates are generated and stored per org | VERIFIED | `packages/api/src/services/wht-certificate.service.ts` — `createWhtCertificate` wired to `tax.generateWhtCertificate` mutation with tenant isolation |
| 6 | Contractor profiles capture UAE/Saudi compliance fields | VERIFIED | `packages/db/prisma/schema/contractor.prisma` has `countryFields Json?`; `packages/api/src/routers/contractor.ts` has all four country-field endpoints |
| 7 | Country-specific TIN validation runs server-side | VERIFIED | `validateTin` in `country-fields.ts` wired via `contractor.validateTin` tRPC procedure |
| 8 | Compliance dashboard shows VAT/WHT obligations | VERIFIED | `TaxObligationsWidget` imported and rendered at `apps/web/src/app/[locale]/(dashboard)/page.tsx` line 22 and 135 |
| 9 | UI surfaces VAT, reverse charge, and WHT data to users | VERIFIED | All five UI components are wired: VatRateSelector in invoice metadata form, ReverseChargeBanner in invoice detail, WhtSummaryCard in payment run panel, TaxObligationsWidget on dashboard, CountryComplianceSection in contractor compliance tab |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/db/prisma/schema/tax.prisma` | VERIFIED | TaxRate, WithholdingTaxRate, WhtCertificate models with constraints |
| `packages/db/prisma/seed/tax-rates.ts` | VERIFIED | 10 entries (PL: 6, AE: 2, SA: 2); exports `seedTaxRates` |
| `packages/db/prisma/seed/wht-rates.ts` | VERIFIED | 14 entries (SA source, residency GB/DE/PL/AE/XX, 4 service types); exports `seedWhtRates` |
| `packages/db/prisma/seed/index.ts` | VERIFIED | Calls both `seedTaxRates` and `seedWhtRates` |
| `packages/validators/src/tax.ts` | VERIFIED | Exports `taxRateCodeSchema`, `whtServiceTypeEnum`, `whtCalculationSchema` |
| `packages/validators/src/country-fields.ts` | VERIFIED | UAE schema, Saudi schema, TIN validators, `countryFieldsSchemaMap`, `validateTin` |
| `packages/validators/src/index.ts` | VERIFIED | Named exports from `tax.js` and `country-fields.js` present |
| `packages/validators/src/invoice.ts` | VERIFIED | `vatRate: z.string().max(10).optional()` — no hardcoded enum; `isReverseCharge`, `reverseChargeOverride` fields present |
| `packages/api/src/services/tax-rate.service.ts` | VERIFIED | `getTaxRatesForCountry`, `validateVatRateCode`, `calculateWht` exported; WHT returns null for non-SA orgs |
| `packages/api/src/services/reverse-charge.service.ts` | VERIFIED | `detectReverseCharge` and `applyReverseCharge` exported; EU_MEMBER_STATES (27) and GCC_MEMBER_STATES (6) sets present |
| `packages/api/src/services/wht-certificate.service.ts` | VERIFIED | `createWhtCertificate` and `listWhtCertificates` exported; tenant isolation check present |
| `packages/api/src/routers/tax.ts` | VERIFIED | All procedures: `getRates`, `getRatesByCountry`, `validateRate`, `calculateWht`, `generateWhtCertificate`, `listWhtCertificates`, `getWhtCertificate`, `taxSummary` |
| `packages/api/src/routers/invoice.ts` | VERIFIED | `applyReverseCharge` called in both `submitForMatching` (line 578) and `manualMatch` (line 686); `toggleReverseCharge` mutation present |
| `packages/api/src/routers/contractor.ts` | VERIFIED | `getCountryFieldsConfig`, `getCountryFields`, `updateCountryFields`, `validateTin` all present and tenant-scoped |
| `packages/api/src/root.ts` | VERIFIED | `tax: taxRouter` registered |
| `packages/db/prisma/schema/invoice.prisma` | VERIFIED | `isReverseCharge Boolean @default(false)` and `reverseChargeOverride Boolean?` present |
| `packages/db/prisma/schema/payment.prisma` | VERIFIED | PaymentRunItem has `whtAmountMinor`, `whtRate`, `whtTreatyApplied`, `whtTreatyReference`, `whtServiceType`, `grossAmountMinor` |
| `packages/db/prisma/schema/contractor.prisma` | VERIFIED | `countryFields Json?` present |
| `apps/web/src/components/invoices/vat-rate-selector.tsx` | WIRED | Fetches `trpc.tax.getRates`; imported and rendered in `invoice-metadata-form.tsx` |
| `apps/web/src/components/invoices/reverse-charge-banner.tsx` | WIRED | Imported and conditionally rendered in `invoices/[id]/page.tsx` |
| `apps/web/src/components/payments/wht-summary-card.tsx` | WIRED | Imported and rendered in `payment-run-side-panel.tsx` |
| `apps/web/src/components/payments/wht-certificate-preview-dialog.tsx` | VERIFIED | Exists with correct imports (`formatMinorUnits` from `@/lib/format-currency`) |
| `apps/web/src/components/dashboard/tax-obligations-widget.tsx` | WIRED | Imported and rendered in `(dashboard)/page.tsx` |
| `apps/web/src/components/contractors/country-compliance-section.tsx` | WIRED | Imported and rendered in `contractor-profile/tab-compliance.tsx` |
| `apps/web/src/components/wht/wht-certificate-template.tsx` | VERIFIED | React-PDF template present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tax.ts` router | `tax-rate.service.ts` | Direct import | WIRED | All service functions imported and called |
| `tax.ts` router | `wht-certificate.service.ts` | Direct import | WIRED | `createWhtCertificate`, `listWhtCertificates` imported and called |
| `payment.ts` router | `tax-rate.service.ts` calculateWht | Import line 26 | WIRED | Line 305 shows WHT integration in payment run creation |
| `invoice.ts` router (submitForMatching) | `reverse-charge.service.ts` | `applyReverseCharge` at line 578 | WIRED | Called with organizationId, contractorId, reverseChargeOverride |
| `invoice.ts` router (manualMatch) | `reverse-charge.service.ts` | `applyReverseCharge` at line 686 | WIRED | Called with organizationId and contractorId |
| `invoice-metadata-form.tsx` | `vat-rate-selector.tsx` | Import line 52 + JSX line 412 | WIRED | Replaces hardcoded VAT dropdown |
| `invoices/[id]/page.tsx` | `reverse-charge-banner.tsx` | Import line 25 + JSX line 314 | WIRED | Conditionally rendered when isReverseCharge is true |
| `payment-run-side-panel.tsx` | `wht-summary-card.tsx` | Import line 50 + JSX line 254 | WIRED | Renders above items list |
| `(dashboard)/page.tsx` | `tax-obligations-widget.tsx` | Import line 22 + JSX line 135 | WIRED | Renders in dashboard right column |
| `tab-compliance.tsx` | `country-compliance-section.tsx` | Import line 10 + JSX lines 63, 83 | WIRED | Renders at top of compliance tab |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `VatRateSelector` | `ratesQuery.data` | `trpc.tax.getRates` → `getTaxRatesForCountry` → `prisma.taxRate.findMany` | Yes — DB query | FLOWING |
| `TaxObligationsWidget` | `summaryQuery.data` | `trpc.tax.taxSummary` → `prisma.invoice.aggregate` + `prisma.whtCertificate.findMany` | Yes — DB queries | FLOWING |
| `WhtSummaryCard` | `items` prop | PaymentRunItem WHT fields populated by `calculateWht` in payment router | Yes — DB-backed calculation | FLOWING (items passed from parent panel) |
| `CountryComplianceSection` | `fieldsQuery.data` | `trpc.contractor.getCountryFields` → `prisma.contractor.findUnique` | Yes — DB query | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running server. All API endpoints require live DB connection. Components require browser rendering.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TAX-01 | 47-01, 47-05, 47-07 | Per-country VAT rates (5% UAE, 15% SA, PL rates) | SATISFIED | Seed data; `getTaxRatesForCountry` service; `VatRateSelector` integrated in invoice metadata form |
| TAX-02 | 47-02, 47-06, 47-07 | Reverse charge flagged on cross-border B2B invoices | SATISFIED | `detectReverseCharge` service; `applyReverseCharge` called in `submitForMatching` and `manualMatch`; `ReverseChargeBanner` wired to invoice detail page |
| TAX-03 | 47-01, 47-03 | WHT calculator based on contractor residency, service type, treaty rates | SATISFIED | `calculateWht` with treaty lookup; seed data for SA WHT rates; integrated into payment run creation |
| TAX-04 | 47-03, 47-05 | WHT certificates generated for Saudi cross-border payments | SATISFIED | `createWhtCertificate` service; `WhtCertificate` model; `generateWhtCertificate` endpoint; `WhtSummaryCard` in payment run panel |
| TAX-05 | 47-05, 47-07 | VAT and WHT obligations on compliance dashboard | SATISFIED | `taxSummary` API endpoint; `TaxObligationsWidget` renders in dashboard right column |
| PROF-01 | 47-04 | UAE contractor profiles include freelance permit and trade license fields | SATISFIED | `uaeCountryFieldsSchema`; UAE fields in `CountryComplianceSection` wired to contractor compliance tab |
| PROF-02 | 47-04 | Saudi contractor profiles include Freelance.sa license and CR fields | SATISFIED | `saudiCountryFieldsSchema`; Saudi fields in `CountryComplianceSection` |
| PROF-03 | 47-04 | Country-specific fields activated per org country setting | SATISFIED | `getCountryFieldsConfig` returns `hasCountryFields: false` for unsupported countries; component self-hides |
| PROF-04 | 47-04 | Contractor tax ID supports per-country formats | SATISFIED | `validateUaeTin` (15 digits), `validateSaudiTin` (13 digits, starts with 3), `validatePolishNip` (checksum); `validateTin` procedure in contractor router |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No blockers or warnings found in re-verification |

Previously-flagged duplicate component files (invoice/, contractor/, payment/ singular directories) have been removed. No remaining duplicates.

---

### Human Verification Required

#### 1. Verify VatRateSelector renders correct grouped rates in the invoice form

**Test:** Open the invoice edit form in a browser (for a PL, AE, or SA organization). Click the VAT rate dropdown.
**Expected:** Dynamic dropdown populated from the TaxRate table, grouped into "Standard Rates", "Reduced Rates", and "Exempt" sections with country-appropriate options.
**Why human:** Visual rendering and API data population require browser and live DB with seed data applied.

#### 2. Verify WHT calculation in a real Saudi payment run

**Test:** Create a payment run from a Saudi org to a UK-resident contractor. Check the payment run items after creation.
**Expected:** `whtAmountMinor > 0`, `whtTreatyApplied = true`, `whtTreatyReference = "Saudi-UK DTA Article 12"`, net amount equals gross minus 5% WHT.
**Why human:** Requires live DB with seed data applied and a test organization configured with `countryCode = "SA"`.

---

### Gaps Summary — Re-verification

**All three gaps from the initial verification are closed:**

**Gap 1 — Reverse charge auto-detection (was dead code, now FIXED):**
Plans 47-06 wired `applyReverseCharge` into both `submitForMatching` (commit `1804c0e`) and `manualMatch` mutations. Grep confirms 3 occurrences of `applyReverseCharge(` in `invoice.ts` (1 import + 2 calls). TAX-02 is now fully satisfied.

**Gap 2 — Orphaned UI components (were orphaned, now FIXED):**
Plan 47-07 fixed broken tRPC and format imports, then wired all five components into their parent pages (commit `457c354` and `ee0c9b0`). All five integration points confirmed via grep.

**Gap 3 — Duplicate component files (were present, now FIXED):**
Plan 47-06 Task 2 (commit `9d926ff`) removed all 5 duplicate files from singular directories. The `invoice/`, `contractor/`, and `payment/` directories no longer exist.

**No regressions detected** across the 9 previously-passing truths.

---

_Verified: 2026-04-11T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Mode: Re-verification after gap closure (plans 47-06 and 47-07)_
