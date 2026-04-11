# Phase 46: Multi-Currency Foundation & SWIFT Payment Export - Research

**Researched:** 2026-04-11
**Status:** Complete

## Domain Research

### Dinero.js v2 Integration Pattern

Dinero.js v2 (2.0.2) is a pure-function money library. Key characteristics:

- **Import pattern:** `import { dinero, add, subtract, multiply, allocate, toSnapshot, toDecimal } from 'dinero.js'`
- **Currency definition:** `import { USD, EUR, GBP, PLN } from '@dinero.js/currencies'` provides ISO 4217 metadata including `exponent` (minor unit count)
- **Creation:** `dinero({ amount: 1500, currency: PLN })` — always integer minor units
- **Arithmetic is pure:** `add(a, b)` returns new Dinero, never mutates
- **Serialization:** `toSnapshot(d)` returns `{ amount: number, currency: { code: string, base: number, exponent: number }, scale: number }` — store `amount` in DB, reconstruct with currency metadata
- **Formatting:** `toDecimal(d)` returns string like `"15.00"` — use with `Intl.NumberFormat` for locale-aware display
- **Currency-aware:** Prevents adding different currencies at compile time (TypeScript generics)
- **Custom currencies:** Can define `AED` and `SAR` if not in `@dinero.js/currencies` — `{ code: 'AED', base: 10, exponent: 2 }`

### Missing Currencies in @dinero.js/currencies

`@dinero.js/currencies` ships all ISO 4217 currencies including AED and SAR. No custom definitions needed.

### Money Utility Module Location

Create `packages/shared/src/money.ts` (or a new `packages/money/` package) as the single import point:
- Re-exports Dinero.js functions
- Provides `fromMinor(amount: number, currencyCode: string): Dinero<number>` — lookup currency from code string, construct Dinero
- Provides `toMinor(d: Dinero<number>): number` — extract integer for DB storage
- Provides `formatMoney(d: Dinero<number>, locale?: string): string` — locale-aware formatting
- Provides `currencyOf(code: string): Currency<number>` — ISO 4217 lookup by code string (needed because Prisma stores `String @db.Char(3)`, not a Dinero Currency type)

### SWIFT pain.001.001.09 vs pain.001.001.03

Key differences from existing SEPA XML:

| Aspect | SEPA pain.001.001.03 | SWIFT pain.001.001.09 |
|--------|----------------------|----------------------|
| Namespace | `urn:iso:std:iso:20022:tech:xsd:pain.001.001.03` | `urn:iso:std:iso:20022:tech:xsd:pain.001.001.09` |
| Service level | `<SvcLvl><Cd>SEPA</Cd></SvcLvl>` | `<SvcLvl><Cd>URGP</Cd></SvcLvl>` or omitted |
| Charge bearer | `SLEV` (SEPA-mandated) | `SHAR`, `OUR`, or `BEN` (configurable) |
| Purpose code | Optional | `<Purp><Cd>{PURPOSE}</Cd></Purp>` in each CdtTrfTxInf |
| Creditor agent | BIC only | BIC or ClearingSystemMemberId |
| Regulatory reporting | Not present | `<RgltryRptg>` optional block for Gulf banks |
| Currency | EUR only | Any ISO 4217 |
| Debtor address | Optional | Required by some Gulf banks (`<PstlAdr>`) |

### Purpose Code Mapping

ISO 20022 External Purpose Code Set (ExternalPurpose1Code). Relevant codes for contractor payments:

| Service Category | Purpose Code | Description |
|-----------------|-------------|-------------|
| Software Development | SCVE | Services |
| Consulting | COMC | Commercial |
| Design / Creative | OTHR | Other |
| Legal | LGAS | Legal Services |
| Accounting | ACCT | Account Management |
| Marketing | ADVE | Advertising |
| Construction | BLDG | Building Maintenance |
| Education / Training | EDUC | Education |
| Default | SUPP | Supplier Payment |

Store in a `purposeCodeMap` table or config, keyed by contract service category.

### ECB Exchange Rate API

ECB provides free XML feed, no API key required:
- **URL:** `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`
- **Format:** XML with `<Cube currency="USD" rate="1.0836"/>` elements
- **Base currency:** EUR (all rates are X per 1 EUR)
- **Update schedule:** ~16:00 CET, weekdays only
- **Currencies included:** ~32 currencies including USD, GBP, PLN. AED and SAR are NOT directly listed.
- **AED derivation:** AED is pegged to USD at 3.6725. Calculate: `AED_per_EUR = USD_per_EUR * 3.6725`
- **SAR derivation:** SAR is pegged to USD at 3.75. Calculate: `SAR_per_EUR = USD_per_EUR * 3.75`
- **Fallback:** If ECB feed is down, use previous day's rate. Log warning via OutboxEvent.

### ExchangeRate Table Design

```prisma
model ExchangeRate {
  id        String   @id @default(cuid())
  date      DateTime @db.Date
  base      String   @db.Char(3) // Always "EUR" for ECB
  target    String   @db.Char(3)
  rate      Decimal  @db.Decimal(18, 8)
  source    String   @default("ECB") // "ECB" or "DERIVED"
  createdAt DateTime @default(now())

  @@unique([date, base, target])
  @@index([date])
  @@index([target, date])
}
```

Retention: Keep all historical rates (cheap storage, needed for audit). No auto-purge.

### Payment Format Auto-Detection

Logic for choosing SEPA vs SWIFT:
1. If currency is EUR AND IBAN starts with EU country code → SEPA
2. If currency is not EUR → SWIFT
3. If IBAN starts with non-EU country code → SWIFT
4. Manual override always available

EU IBAN country codes: AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE (plus EEA: IS, LI, NO).

### Schema Changes Summary

**Organization model:**
- `defaultCurrency` already exists as `String? @db.Char(3)` — rename conceptually to "homeCurrency" in app layer, but DB field name stays `defaultCurrency` to avoid migration. Just use it as the home currency.

**PaymentExportFormat enum:**
- Add `SWIFT_XML` to existing enum values: `CSV | BANK_FILE | SEPA_XML | MT940 | XML | API_PUSH | SWIFT_XML`

**PaymentRun model:**
- `currency` field already exists as `String? @db.Char(3)` — already supports per-run currency

**PaymentRunItem model:**
- `currency` field already exists as `String @db.Char(3)` — already has per-item currency

**Invoice model:**
- `currency` field already exists as `String @db.Char(3)` — already has per-record currency

**Contract model:**
- `currency` field already exists as `String @db.Char(3)` — already has per-record currency

**New model:** ExchangeRate (see above)

### Validator Schema Changes

- `paymentExportFormatEnum`: Add `"SWIFT_XML"` to the z.enum array
- `paymentRunCreateSchema`: Already has `groupByCurrency` and `currency` — no changes needed

### Files to Modify (Complete Inventory)

1. **`packages/db/prisma/schema/payment.prisma`** — Add SWIFT_XML to PaymentExportFormat enum, add ExchangeRate model
2. **`packages/validators/src/payment.ts`** — Add SWIFT_XML to paymentExportFormatEnum
3. **`packages/api/src/services/payment-export.ts`** — Add generateSwiftXml(), refactor minorToDecimal() to use Dinero
4. **`packages/api/src/routers/payment.ts`** — Wire SWIFT_XML format in export endpoint
5. **`packages/shared/src/money.ts`** (NEW) — Dinero.js wrapper utilities
6. **`packages/einvoice/src/engine/xml-utils.ts`** — Update toMinorUnits to use money utility
7. **`packages/api/src/services/report-export.ts`** — Add exchange rate conversion for home currency display
8. **`packages/api/src/services/exchange-rate.ts`** (NEW) — ECB fetch, derivation, cron job
9. **`packages/api/src/routers/exchange-rate.ts`** (NEW) — tRPC router for rate queries
10. **`packages/validators/src/exchange-rate.ts`** (NEW) — Zod schemas for rate queries

### Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ECB feed downtime | No fresh rates | Use previous day's rate, log warning, retry in 1 hour |
| AED/SAR peg drift | Incorrect cross-rates | Pegs have been stable for decades; log if USD rate changes >1% |
| Dinero.js different-currency addition | Runtime error | TypeScript generics catch at compile time; add runtime guard in money utility |
| SWIFT XML rejection by bank | Payment failure | Validate against XSD before export; include required postal address fields |
| Minor unit mismatch (e.g., BHD has 3 decimals) | Off-by-factor amounts | Dinero.js handles this via currency exponent; BHD not in scope but architecture supports it |

### Validation Architecture

**Approach:** Unit tests for money utility, SWIFT XML generator, exchange rate derivation. Integration test for payment export format selection. Snapshot tests for SWIFT XML output structure.

**Key test scenarios:**
1. Money utility: create, arithmetic, serialize/deserialize for each currency (PLN, EUR, AED, SAR, GBP)
2. SWIFT XML: valid structure, correct namespace, purpose codes, charge bearer
3. Exchange rate: ECB parsing, AED/SAR cross-rate derivation, missing rate fallback
4. Format auto-detection: EUR+EU→SEPA, AED→SWIFT, GBP→SWIFT
5. Report conversion: amounts displayed in home currency using stored rates

## RESEARCH COMPLETE
