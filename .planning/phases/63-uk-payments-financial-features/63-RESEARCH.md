# Phase 63: UK Payments & Financial Features - Research

**Researched:** 2026-04-15
**Domain:** UK payment file generation (BACS), statutory late payment interest (LPCDA), German Skonto early-payment discount
**Confidence:** HIGH

## Summary

Phase 63 adds three financially distinct features on top of the existing PaymentRun / Invoice / ContractorBillingProfile infrastructure. All three are calculation-heavy, regulation-driven, and read-path intensive (live computation rather than stored aggregates). The existing codebase is well-positioned: the payment-export service already handles four export formats (CSV, Elixir, SEPA XML, SWIFT XML) via pure functions; adding BACS Standard 18 is a natural fifth. The XRechnung CII generator already emits a basic `SpecifiedTradePaymentTerms` block with `DueDateDateTime` -- extending it with Skonto structured data is a targeted modification. The cron infrastructure (`apps/web/src/app/api/cron/`) uses a consistent CRON_SECRET-authenticated GET handler + `withCronMonitor` + Sentry pattern, ready for a new BoE rate polling endpoint.

The biggest architectural change is `InvoicePayment` (D-14) which introduces partial-payment tracking. The existing `Invoice.paidAt` single-timestamp model must be augmented with an append-only payment-events table. This is a schema-level change that touches the core invoice domain and requires a data migration for existing paid invoices. All other models (`BoEBaseRateHistory`, `InvoiceInterestCompensation`, `InvoiceInterestWaiver`, `InvoiceInterestClaim`, `SkontoTerm`, `SkontoSnapshot`, `SkontoApplication`) are additive and isolated.

**Primary recommendation:** Split into 6-7 plans: (1) Prisma schema + migration for all new models; (2) BACS Std 18 generator + ASCII transliteration + modulus check validators; (3) BACS tRPC router + settings UI + feature flag; (4) BoE rate history + polling cron + late interest calculation service; (5) Late interest tRPC router + invoice detail UI + claim PDF; (6) Skonto term CRUD + XRechnung BG-20 extension + eligibility service; (7) Skonto UI surfaces + PaymentRun preview integration. Wave the plans to respect schema-first dependencies.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: UK bank fields as new encrypted columns on ContractorBillingProfile (ukSortCodeEncrypted/Masked, ukAccountNumberEncrypted/Masked) using existing bank-account-crypto AEAD pattern. Zod validation at tRPC boundary in packages/validators/src/bacs.ts.
- D-02: Organization-level BACS submitter fields (SUN, sort code, account, name) as encrypted columns on Organization. New settings page at /[locale]/(dashboard)/settings/payments/. Admin-only via requirePermission('org:settings:write').
- D-03: BACS Std 18 generator in packages/api/src/services/payment-export.ts. Fixed-width ASCII file with VOL + HDR1 + HDR2 + UHL1 + Detail Records (106 chars) + Contra + EOF1 + EOF2 + UTL1. CR/LF line endings, no BOM. Transaction code 99 for Direct Credit. Processing date YYDDD Julian. PaymentExportFormat enum extended with BACS_STD18.
- D-04: Format auto-detection extended with GBP+UK account -> BACS_STD18 (checked BEFORE IBAN rules).
- D-05: ASCII transliteration util at packages/shared/src/ascii-transliterate.ts. Deterministic mapping covering BACS character set. Upper-cases output.
- D-06: UI surfaces for BACS export: Preview BACS file action on payment-run detail, download button, PaymentExport row with R2 key + sha256 + downloadCount.
- D-07: Feature flag PAY_BACS_ENABLED via Unleash wrapper.
- D-08: BoEBaseRateHistory Prisma model (NOT multi-tenant, global reference data). Seed from 2021-01-01 through migration date.
- D-09: BoE API polling job: daily at 06:00 UTC, fetches IUDBEDR CSV series. Uses GovApiRateLimiter + audit logging.
- D-10: Admin tRPC router for BoE rate CRUD. Super-admin only (admin:boe-rate:write). New /admin/boe-rate/ page.
- D-11: B2B scope only. New isBusinessCustomer boolean on Contractor (default true).
- D-12: Accrual model -- live computation on read. Pure function calculateLateInterest(). Rate = BoE rate on last day of preceding 6-month statutory period (30 Jun / 31 Dec) + 8%. Daily simple interest.
- D-13: Fixed compensation tier (GBP40/70/100) -- snapshotted at first overdue via InvoiceInterestCompensation model.
- D-14: InvoicePayment model for partial payments. Invoice.paidAt + paymentStatus become derived. Migration creates InvoicePayment rows for existing paid invoices.
- D-15: InvoiceInterestWaiver model with waive/revoke lifecycle.
- D-16: UI surfaces for late interest: invoice detail section, invoices list column, dashboard tile.
- D-17: InvoiceInterestClaim + PDF letter + optional secondary invoice. New packages/validators/src/legal/gb.ts for GB locked phrases.
- D-18: PaymentRun stays payables-only. Late interest is receivables domain. No integration in v5.0.
- D-19: Feature flag PAY_LATE_INTEREST_ENABLED.
- D-20: SkontoTerm model with XOR constraint (invoice-level or billing-profile default). Validation 0 < percent <= 50, 1 <= discountDays < netDays <= 180.
- D-21: Default cascade: invoice-level term > billing-profile default > null.
- D-22: Single-tier Skonto for v5.0. German locked phrase SKONTO_DESCRIPTION_TEMPLATE_DE in packages/validators/src/legal/de.ts.
- D-23: XRechnung BG-20 Payment Terms integration. Modify xrechnung-de/generator.ts to emit ram:SpecifiedTradePaymentTerms with structured Skonto extension: #SKONTO#TAGE={days}#PROZENT={percent}#BASISBETRAG={amount}#
- D-24: Eligibility evaluation + snapshot on payment complete. SkontoSnapshot + SkontoApplication models.
- D-25: UI surfaces for Skonto: invoice create/edit, billing profile edit, invoice detail, payment-run preview, invoice list column.
- D-26: Feature flag PAY_SKONTO_ENABLED.
- D-27: New tRPC routers: bacs.ts, late-payment-interest.ts, skonto.ts, admin-boe-rate.ts. Extended payment.ts with format detection + Skonto application.

### Claude's Discretion
- Whether GovApiRateLimiter wraps non-HMRC gov calls (BoE) or needs a new wrapper -- reuse existing GovApiRateLimiter (it is API-name-parameterized, already supports arbitrary apiName strings).
- Exact VocaLink modulus weights table version -- use v8.40 (16 May 2025, most recent published).
- Whether to use Render scheduled job or existing cron mechanism -- use the existing Next.js cron route pattern (apps/web/src/app/api/cron/) with CRON_SECRET + withCronMonitor + Sentry, matching token-refresh/reminders/classification-economic-dependency pattern.
- Exact LPCDA claim-letter PDF layout -- implement in React-PDF matching ir35-sds.tsx palette and design tokens.
- Whether admin BoE rate UI needs its own nav section -- create a minimal /admin/ shell (first admin surface in the app).
- i18n strings for waiver revoke reasons -- free text (not enumerated).
- InvoicePayment migration timing -- same deploy (small data volume, local-only app).
- isBusinessCustomer default=true takes effect silently (no review step).

### Deferred Ideas (OUT OF SCOPE)
- BACS submission via BACSTEL-IP / Bankline / VocaLink APIs
- Standard 18 multi-day processing date
- CHAPS + Faster Payments formats
- Multi-tier Skonto
- Contract-level Skonto templates
- Consumer (B2C) debt late interest
- ReceivablesRun / AR payment tracking
- Statutory late-payment interest for non-UK jurisdictions
- Interest compounding
- Automated late-payment interest via e-invoice
- UI for editing historical InvoicePayment rows
- Admin dashboard for BoE rate poller health
- FX handling for GBP invoices
- Partial Skonto (prorated on partial payment)
- i18n of LPCDA claim letter into DE
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAY-01 | User can export UK contractor payments as BACS Standard 18 Direct Credit files with correct fixed-width formatting, sort code validation, and ASCII transliteration | BACS Std 18 format researched (record layout, field positions, character set). VocaLink modulus check approach confirmed. ASCII transliteration pure-function pattern established. Existing payment-export.ts infrastructure supports adding a fifth generator. |
| PAY-06 | User sees automatically calculated late payment interest on overdue UK invoices per LPCDA (BoE base rate + 8% + fixed compensation tiers) | LPCDA statutory rate mechanism confirmed (Section 4: rate on 30 Jun / 31 Dec of preceding period). BoE API endpoint for IUDBEDR series confirmed. Existing cron infrastructure supports daily polling. InvoicePayment model enables partial-payment interest accrual. |
| PAY-07 | User can configure Skonto early payment discount terms on German invoices with discount percentage and discount period, with automatic discounted amount calculation and eligibility tracking | XRechnung 3.0.2 structured Skonto extension syntax confirmed (#SKONTO#TAGE=n#PROZENT=n#BASISBETRAG=n#). Existing XRechnung generator's SpecifiedTradePaymentTerms block located (generator.ts line 306). SkontoTerm model + snapshot-on-payment pattern established. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI (Context7) for library documentation lookup
- Monorepo: pnpm + Turborepo
- No `console.log` -- use `@contractor-ops/logger` (Pino)
- Strong typing, Zod validation at all tRPC boundaries
- Schema validation for all external inputs
- Security: encrypted bank fields, least-privilege access, RBAC
- Performance: caching, efficient queries
- Accessibility: WCAG, keyboard nav, semantic HTML
- Feature flags: self-hosted Unleash OSS + typed registry wrapper
- App is local-only; legal sign-off deferred (post-deploy item)
- Production-grade code quality

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.x (project current) | Schema + migrations for 8 new models | Already the project ORM; multi-tenant extension reused |
| tRPC | v11 (project current) | 4 new routers + payment.ts extensions | Already the API layer; tenantProcedure + RBAC middleware |
| @react-pdf/renderer | (project current) | Late-payment claim letter PDF | Existing PDF template pattern (ir35-sds, drv-defense, gdpr) |
| Zod | (project current) | BACS validators, SkontoTerm schemas, InvoicePayment input | Project standard for all boundary validation |
| next-intl | (project current) | New Payments i18n namespace (en, en-GB, de) | Already used across the app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @upstash/ratelimit | (project current) | Rate-limit BoE API polling via GovApiRateLimiter | Already installed; reuse for boe-base-rate API name |
| dinero.js | (project current) | Minor-to-decimal currency formatting for BACS amounts | Already used via `minorToDecimalStr` in shared |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled modulus check | `@usecomma/modulus-check` (npm, v0.1.8) or `uk-modulus-checking` (v0.1.4) | npm packages are stale (last update 2020-2024). CONTEXT D-01 specifies shipping VocaLink modulus weights as a data table in `bacs-modulus-tables.ts`. Hand-rolling is the correct choice per decision -- it avoids a stale dependency and the algorithm is well-documented (3 check types: MOD10, MOD11, DBLAL). |
| BoE rate API | Manual-only entry | BoE has a public CSV endpoint; daily polling is cheap and removes human error. Manual override preserved via D-10 admin router. |

## Architecture Patterns

### Recommended Project Structure

```
packages/db/prisma/schema/
  payment.prisma            # EXTEND: PaymentExportFormat + BACS_STD18
  invoice.prisma            # EXTEND: InvoicePayment, InvoiceInterestCompensation,
                            #   InvoiceInterestWaiver, InvoiceInterestClaim
  contractor.prisma         # EXTEND: isBusinessCustomer on Contractor;
                            #   UK bank fields on ContractorBillingProfile
  organization.prisma       # EXTEND: BACS submitter fields on Organization
  financial.prisma          # NEW: BoEBaseRateHistory, SkontoTerm, SkontoSnapshot,
                            #   SkontoApplication (or split across existing files)
packages/db/prisma/seed-data/
  boe-base-rate-history.json  # NEW: BoE rate seed from 2021-01-01

packages/validators/src/
  bacs.ts                   # NEW: sort code + account number Zod schemas + modulus check
  bacs-modulus-tables.ts    # NEW: VocaLink modulus weights data table (v8.40)
  legal/gb.ts               # EXTEND: LPCDA locked phrases for claim letter
  legal/de.ts               # EXTEND: SKONTO_DESCRIPTION_TEMPLATE_DE

packages/shared/src/
  ascii-transliterate.ts          # NEW: transliterateToBacs() pure function
  ascii-transliterate-table.ts    # NEW: Map<string, string> mapping table

packages/api/src/
  services/
    payment-export.ts              # EXTEND: generateBacsStandard18()
    payment-format-detection.ts    # EXTEND: GBP+UK account -> BACS_STD18
    late-payment-interest.ts       # NEW: calculateLateInterest() + resolveStatutoryRate()
    skonto.ts                      # NEW: evaluateSkontoEligibility() + resolveSkontoTerm()
    bank-account-crypto.ts         # REUSE: for UK bank field encryption
  routers/
    bacs.ts                        # NEW: previewExport, generateExport, validateSortCode, saveSubmitterConfig
    late-payment-interest.ts       # NEW: getForInvoice, getForOrg, waive, revokeWaiver, claim, downloadClaim
    skonto.ts                      # NEW: upsertForInvoice/BillingProfile, deleteFor*, evaluateForInvoice
    admin-boe-rate.ts              # NEW: list, insert, update, delete (super-admin)
    payment.ts                     # EXTEND: getFormatDetection, applySkontoToItem
  pdf-templates/
    late-payment-claim.tsx         # NEW: LPCDA claim letter (React-PDF)

packages/integrations/src/services/  OR  packages/gov-api/src/
  boe-base-rate-poller.ts         # NEW: fetch IUDBEDR CSV, parse, upsert BoEBaseRateHistory

packages/feature-flags/src/
  registry.ts                     # EXTEND: PAY_BACS_ENABLED, PAY_LATE_INTEREST_ENABLED, PAY_SKONTO_ENABLED

apps/web/src/app/
  api/cron/boe-rate-poll/route.ts        # NEW: daily cron endpoint
  [locale]/(dashboard)/settings/payments/ # NEW: BACS submitter config page
  admin/boe-rate/                         # NEW: super-admin BoE rate history page
  [locale]/(dashboard)/invoices/          # EXTEND: late interest section + Skonto banner
  [locale]/(dashboard)/payments/          # EXTEND: BACS preview + Skonto in PaymentRun
```

### Pattern 1: Pure-Function Financial Calculations
**What:** All monetary calculations (late interest, Skonto eligibility, modulus check) are stateless pure functions.
**When to use:** Always for financial computation -- separates business logic from I/O.
**Example:**
```typescript
// packages/api/src/services/late-payment-interest.ts
export function calculateLateInterest({
  invoice,
  payments,
  rateHistory,
  asOf,
}: LateInterestInput): LateInterestResult {
  // 1. Determine due date from payment terms cascade
  // 2. Find applicable statutory rate via resolveStatutoryRate()
  // 3. Compute daily simple interest on outstanding balance
  // 4. Apply compensation tier (frozen at first overdue)
  // 5. Check for active waivers
  // Returns: { applicable, dailyInterestMinor, accruedInterestMinor, ... }
}
```

### Pattern 2: Append-Only Financial Events
**What:** Payment events, compensation snapshots, interest claims, and Skonto snapshots are append-only -- never updated, only created or soft-revoked.
**When to use:** Any financial audit trail.
**Why:** Immutability ensures auditability. InvoicePayment rows are append-only; corrections are compensating entries. InvoiceInterestWaiver uses soft revoke (sets revokedAt, preserves original).

### Pattern 3: Encrypted-Plus-Masked Bank Fields
**What:** Paired columns: `fieldEncrypted` (AES-256-GCM via bank-account-crypto.ts) + `fieldMasked` (last N digits for display). API never exposes encrypted values.
**When to use:** All new bank account fields (UK sort code, account number, BACS submitter fields).
**Example:**
```typescript
// Store
const encrypted = encryptBankAccount(sortCode);
const masked = `XX-XX-${sortCode.slice(-2)}`;
await db.contractorBillingProfile.update({
  data: { ukSortCodeEncrypted: encrypted, ukSortCodeMasked: masked },
});
// Read -- only return masked to client
return { ukSortCode: profile.ukSortCodeMasked };
// Decrypt only server-side for BACS file generation
const sortCode = decryptBankAccount(profile.ukSortCodeEncrypted!);
```

### Pattern 4: Cron Route with Monitor + Sentry
**What:** Next.js API route at `/api/cron/{job-name}/route.ts` authenticated via CRON_SECRET bearer token, wrapped in `withCronMonitor()` + `Sentry.withMonitor()`.
**When to use:** BoE rate polling job (and any future scheduled jobs).
**Example:**
```typescript
// apps/web/src/app/api/cron/boe-rate-poll/route.ts
import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { createCronLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';

const log = createCronLogger('boe-rate-poll');

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return Sentry.withMonitor('boe-rate-poll', () =>
    withCronMonitor('boe-rate-poll', async () => {
      // Poll BoE, parse CSV, upsert if rate changed
    }),
  );
}
```

### Anti-Patterns to Avoid
- **Storing accrued interest as a column:** Interest accrues daily; storing it creates stale data. Use live computation on read (D-12).
- **Compound interest for LPCDA:** The Act specifies simple interest (Section 3(3)). Never compound.
- **Using current BoE rate for LPCDA:** The Act specifies the rate on the last day of the preceding 6-month period (Section 4(1)). Using the current rate is a legal error.
- **Mutating InvoicePayment rows:** Corrections must be compensating entries (new rows with negative or adjusting amounts), not updates to existing rows.
- **Hard-blocking on modulus check failure:** Some VocaLink exception categories produce false negatives. Warn but do not block (D-01).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256-GCM encryption | Custom crypto wrapper | Existing `bank-account-crypto.ts` | Already handles IV generation, auth tag, format. Battle-tested. |
| Currency formatting | Manual division by 100 | `minorToDecimalStr()` from `@contractor-ops/shared` | ISO 4217-aware via Dinero.js. Handles non-2-decimal currencies. |
| Rate limiting | Custom sliding window | `GovApiRateLimiter` from `@contractor-ops/gov-api` | Upstash Redis-backed with fail-open design. |
| PDF generation | Raw PDF bytes | `@react-pdf/renderer` with existing template pattern | React components, design token sharing, consistent output. |
| Cron monitoring | Manual health checks | `withCronMonitor()` + Sentry + CronMonitors registry | Existing pattern handles heartbeats, timing, error reporting. |
| XML emission for XRechnung | String concatenation | Existing `fast-xml-parser` builder in xrechnung-de/generator.ts | Already handles namespaces, escaping, attribute serialization. |

**Key insight:** The codebase already has mature infrastructure for every cross-cutting concern this phase needs -- encryption, rate limiting, PDF generation, cron monitoring, XML building, R2 storage, feature flags. The phase is about financial domain logic, not infrastructure.

## Common Pitfalls

### Pitfall 1: LPCDA Statutory Rate Period Confusion
**What goes wrong:** Using the BoE rate on the date the debt becomes overdue instead of the rate on the last day of the preceding 6-month statutory period.
**Why it happens:** The LPCDA Section 4(1) rule is non-obvious. If a debt becomes overdue on 15 March 2026, the applicable rate is whatever was in effect on 31 December 2025 (not the rate on 15 March).
**How to avoid:** Encapsulate in `resolveStatutoryRate(rateHistory, debtStartDate)` -- a pure function that calculates the reference date (30 Jun or 31 Dec before the debt start), then looks up the BoE rate on that date.
**Warning signs:** Tests that use `rateHistory[rateHistory.length - 1]` instead of looking up the correct statutory period.

### Pitfall 2: BACS Character Set Violations
**What goes wrong:** Non-ASCII characters or lowercase letters in BACS file fields cause bank rejection (often silently, 2-3 days after submission).
**Why it happens:** BACS Std 18 character set is strictly uppercase A-Z, 0-9, plus 14 specific punctuation marks. European diacritics (e, o, u, ss) must be transliterated.
**How to avoid:** Run `transliterateToBacs()` on every name/reference field BEFORE fixed-width assembly. Surface warnings in the preview UI for unmappable characters.
**Warning signs:** Tests passing with ASCII-only names. Add test cases with Polish (ł, ś, ź), German (a, o, u, ss), and Arabic names.

### Pitfall 3: BACS Fixed-Width Field Overflow
**What goes wrong:** A field exceeds its fixed width, shifting all subsequent fields and producing an invalid file.
**Why it happens:** Names, references, or amounts are longer than expected. BACS fields are strictly fixed-width with no delimiters.
**How to avoid:** Truncate every field to its exact width. Pad with spaces to fill. Never exceed. Test with max-length inputs.
**Warning signs:** Buffer length assertions failing at record level (each detail record must be exactly 106 characters).

### Pitfall 4: Compensation Tier Mutation After Snapshot
**What goes wrong:** Invoice amount is edited after the compensation tier was snapshotted, and the tier recalculates to a different value.
**Why it happens:** Developer treats compensation as derived from current invoice amount.
**How to avoid:** `InvoiceInterestCompensation.tierMinor` is immutable once created. The tier is based on `invoiceTotalAtOverdueMinor` frozen at first overdue. Enforce via DB CHECK or application-level guard (no update procedure).
**Warning signs:** Tests that edit invoice amounts and expect compensation to change.

### Pitfall 5: InvoicePayment Migration Data Loss
**What goes wrong:** Existing invoices with `paidAt` set lose their payment history during migration.
**Why it happens:** Migration creates InvoicePayment rows for existing paid invoices. If the migration runs before the application code switches to reading from InvoicePayment, there is a window where both systems are active.
**How to avoid:** The migration creates InvoicePayment rows with `sourceKind = 'MANUAL'` and `amountMinor = invoice.totalMinor`. Keep `Invoice.paidAt` as a denormalized field (don't remove it in v5.0); derive from InvoicePayment but also write-through for backward compat.
**Warning signs:** Queries that read `Invoice.paidAt` directly instead of computing from InvoicePayment aggregation.

### Pitfall 6: XRechnung Skonto Description Encoding
**What goes wrong:** The structured Skonto extension string `#SKONTO#TAGE=10#PROZENT=3.00#` contains special characters that get XML-escaped incorrectly.
**Why it happens:** The `#` character and decimal numbers must appear literally in the `ram:Description` element text content.
**How to avoid:** The structured Skonto string goes in the TEXT content of `ram:Description`, not in an XML attribute. `fast-xml-parser` handles text content correctly via `#text` property. Verify with KoSIT validator.
**Warning signs:** KoSIT Schematron validation failures on BG-20 content.

## Code Examples

### BACS Standard 18 Detail Record Layout (106 characters)
```typescript
// Source: BACS Standard 18 MIG (Feb 2022) + FinDock documentation
// Verified against multiple public implementations

// Detail Record (Direct Credit) - 106 chars, CR/LF terminated
// Pos 1-6:    Destination sort code (6 digits, no hyphens)
// Pos 7-14:   Destination account number (8 digits)
// Pos 15:     Type of account (space = default)
// Pos 16-17:  Transaction code ('99' = Direct Credit)
// Pos 18-23:  Originator's sort code (6 digits)
// Pos 24-31:  Originator's account number (8 digits)
// Pos 32-35:  Free (spaces)
// Pos 36-46:  Amount in pence (11 digits, zero-padded)
// Pos 47-64:  Originator's name/reference (18 chars, space-padded, uppercase ASCII)
// Pos 65-82:  User's reference (18 chars, space-padded)
// Pos 83-100: Destination account name (18 chars, space-padded, uppercase ASCII)
// Pos 101-106: Processing date (YYDDD Julian) or spaces

function formatDetailRecord(
  destSortCode: string,     // 6 digits
  destAccount: string,      // 8 digits
  origSortCode: string,     // 6 digits
  origAccount: string,      // 8 digits
  amountPence: number,       // integer
  originatorRef: string,     // max 18 chars ASCII
  userRef: string,           // max 18 chars ASCII
  destName: string,          // max 18 chars ASCII
  processingDate: string,    // YYDDD or '      '
): string {
  return [
    destSortCode.padEnd(6),
    destAccount.padEnd(8),
    ' ',                                          // type of account
    '99',                                         // transaction code: Direct Credit
    origSortCode.padEnd(6),
    origAccount.padEnd(8),
    '    ',                                       // free
    String(amountPence).padStart(11, '0'),
    originatorRef.padEnd(18).slice(0, 18),
    userRef.padEnd(18).slice(0, 18),
    destName.padEnd(18).slice(0, 18),
    processingDate.padEnd(6),
  ].join('');
  // Total: 6+8+1+2+6+8+4+11+18+18+18+6 = 106
}
```

### LPCDA Statutory Rate Resolution
```typescript
// Source: Late Payment of Commercial Debts (Interest) Act 1998, Section 4(1)
// The Late Payment of Commercial Debts (Rate of Interest) (No. 3) Order 2002

export function resolveStatutoryRate(
  rateHistory: { effectiveFrom: Date; ratePercent: number }[],
  debtOverdueDate: Date,
): { referenceDate: Date; boeRate: number; statutoryRate: number } {
  // Step 1: Find the reference date (last day of preceding 6-month period)
  const year = debtOverdueDate.getFullYear();
  const month = debtOverdueDate.getMonth(); // 0-indexed

  let referenceDate: Date;
  if (month >= 0 && month <= 5) {
    // Jan-Jun: rate from 31 Dec of previous year
    referenceDate = new Date(year - 1, 11, 31); // Dec 31
  } else {
    // Jul-Dec: rate from 30 Jun of current year
    referenceDate = new Date(year, 5, 30); // Jun 30
  }

  // Step 2: Find the BoE rate in effect on the reference date
  const sorted = [...rateHistory].sort(
    (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime(),
  );
  let boeRate = 0;
  for (const entry of sorted) {
    if (entry.effectiveFrom <= referenceDate) {
      boeRate = entry.ratePercent;
    }
  }

  // Step 3: Statutory rate = BoE rate + 8%
  return {
    referenceDate,
    boeRate,
    statutoryRate: boeRate + 8,
  };
}
```

### XRechnung BG-20 Skonto Extension
```typescript
// Source: XRechnung 3.0.2 Anhang E (structured Skonto in BG-20 Description)
// Confirmed via: https://xeinkauf.de/xrechnung/xrechnung/ FAQ

// In xrechnung-de/generator.ts, modify the SpecifiedTradePaymentTerms block:
const paymentTerms: Record<string, unknown> = {};

if (skontoTerm) {
  // Structured Skonto in Description per XRechnung 3.0.2 Anhang E
  const germanDescription = SKONTO_DESCRIPTION_TEMPLATE_DE
    .replace('{percent}', skontoTerm.discountPercent.toFixed(2))
    .replace('{discountDays}', String(skontoTerm.discountPeriodDays))
    .replace('{netDays}', String(skontoTerm.netPeriodDays));

  const structuredSkonto =
    `#SKONTO#TAGE=${skontoTerm.discountPeriodDays}` +
    `#PROZENT=${skontoTerm.discountPercent.toFixed(2)}` +
    `#BASISBETRAG=${(totalMinor / 100).toFixed(2)}#`;

  paymentTerms['ram:Description'] = `${germanDescription}\n${structuredSkonto}`;
}

if (dueDate) {
  paymentTerms['ram:DueDateDateTime'] = {
    'udt:DateTimeString': { '@_format': '102', '#text': toCiiDate(dueDate) },
  };
}

// Emit only if there is content
if (Object.keys(paymentTerms).length > 0) {
  settlement['ram:SpecifiedTradePaymentTerms'] = paymentTerms;
}
```

### BACS Modulus Check Algorithm (VocaLink Standard)
```typescript
// Source: VocaLink "Validating Account Numbers" v8.40 (May 2025)
// Three check types: MOD10, MOD11, DBLAL (double alternate)

type ModulusEntry = {
  sortCodeRangeStart: string; // 6 digits
  sortCodeRangeEnd: string;   // 6 digits
  checkType: 'MOD10' | 'MOD11' | 'DBLAL';
  weights: number[];          // 14 integers (u, v, w, x, y, z, a, b, c, d, e, f, g, h)
  exception: number;          // 0 = no exception, 1-14 = exception rule
};

export function modulusCheck(
  sortCode: string,
  accountNumber: string,
  table: ModulusEntry[],
): { valid: boolean; warnings: string[] } {
  // 1. Find matching entries in table (may be 0, 1, or 2 matches)
  // 2. For each match, apply weights to combined 14-digit string (sortCode + accountNumber)
  // 3. Sum weighted digits, apply modulus (10 or 11), check remainder
  // 4. Handle exception rules (1-14) which modify the standard algorithm
  // 5. If 2 entries: both must pass (AND) unless exception says otherwise
  // Returns warnings for known exception categories that may produce false negatives
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BACS via ISO 20022 pain.001 | BACS still uses Standard 18 for bulk Direct Credits | Ongoing (ISO 20022 migration planned but not yet mandated for BACS Direct Credit) | Use Standard 18, not pain.001. Pay.UK published a translation guide but Std 18 remains the operational format. |
| VocaLink modulus weights v7.90 | v8.40 (16 May 2025) | May 2025 | Use v8.40 weights table. Check for updates quarterly. |
| BoE base rate 5.25% (2023 peak) | 3.75% (as of March 2026) | Feb 2025 rate cut cycle | Seed data must include the full rate history from 2021 onward. Current rate affects live interest calculations. |

**Deprecated/outdated:**
- `uk-modulus-checking` npm package (v0.1.4, last published 2020) -- do not use; hand-roll per CONTEXT D-01 with current VocaLink data.

## Open Questions

1. **BoE CSV API Access**
   - What we know: The BoE database exposes IUDBEDR series at a public URL with CSV download capability. The URL format is `https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?csv.x=yes&...&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y`.
   - What's unclear: The exact response format and whether it returns HTTP 403 for automated requests (our test got 403). The BoE may require specific User-Agent headers or have rate limits.
   - Recommendation: Implement with fallback to manual entry. If the CSV endpoint is unreachable, log a warning and rely on admin manual-edit (D-10). Test the endpoint during implementation and adjust headers/approach as needed. MPC meets ~8x/year so manual entry is viable.

2. **Admin Shell Architecture**
   - What we know: No `/admin/` route area exists yet. The BoE rate admin page (D-10) is the first super-admin surface.
   - What's unclear: Whether to create a full admin layout shell or a minimal single-page admin.
   - Recommendation: Create a minimal admin layout at `apps/web/src/app/admin/layout.tsx` with super-admin auth gate. Single page for BoE rates. Expandable later without refactoring.

3. **InvoicePayment vs Invoice.paidAt Coexistence**
   - What we know: D-14 introduces InvoicePayment for partial payments. Existing code reads `Invoice.paidAt` directly in many places.
   - What's unclear: How many code paths read `Invoice.paidAt` and need updating.
   - Recommendation: Keep `Invoice.paidAt` as a denormalized field. Update it via a Prisma middleware or post-payment hook that sets `paidAt = max(InvoicePayment.paidAt)` when fully paid. This preserves backward compatibility while the InvoicePayment model becomes the source of truth.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | `vitest.config.ts` (root) + per-package configs |
| Quick run command | `pnpm --filter @contractor-ops/api vitest run --reporter=verbose` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | BACS Std 18 file generation with correct fixed-width formatting | unit | `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/payment-export-bacs.test.ts -x` | Wave 0 |
| PAY-01 | Sort code modulus check validation | unit | `pnpm --filter @contractor-ops/validators vitest run src/__tests__/bacs.test.ts -x` | Wave 0 |
| PAY-01 | ASCII transliteration for BACS character set | unit | `pnpm --filter @contractor-ops/shared vitest run src/__tests__/ascii-transliterate.test.ts -x` | Wave 0 |
| PAY-01 | BACS format auto-detection (GBP + UK account) | unit | `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/payment-format-detection.test.ts -x` | Existing (extend) |
| PAY-01 | BACS tRPC router (preview, generate, validate) | integration | `pnpm --filter @contractor-ops/api vitest run src/routers/__tests__/bacs.test.ts -x` | Wave 0 |
| PAY-06 | Late interest calculation (simple interest, statutory rate lookup) | unit | `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/late-payment-interest.test.ts -x` | Wave 0 |
| PAY-06 | Statutory rate resolution (30 Jun / 31 Dec rule) | unit | Same file as above | Wave 0 |
| PAY-06 | Compensation tier snapshotting | unit | Same file as above | Wave 0 |
| PAY-06 | Late interest tRPC router (getForInvoice, waive, claim) | integration | `pnpm --filter @contractor-ops/api vitest run src/routers/__tests__/late-payment-interest.test.ts -x` | Wave 0 |
| PAY-06 | BoE rate polling and parsing | unit | `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/boe-base-rate-poller.test.ts -x` | Wave 0 |
| PAY-06 | Locked GB legal phrases CI guard | unit | `pnpm --filter @contractor-ops/validators vitest run src/__tests__/locked-phrases-guard.test.ts -x` | Existing (extend) |
| PAY-07 | Skonto eligibility evaluation | unit | `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/skonto.test.ts -x` | Wave 0 |
| PAY-07 | XRechnung BG-20 Skonto emission | unit | `pnpm --filter @contractor-ops/einvoice vitest run src/profiles/xrechnung-de/__tests__/generator.test.ts -x` | Existing (extend) |
| PAY-07 | Skonto tRPC router (upsert, delete, evaluate) | integration | `pnpm --filter @contractor-ops/api vitest run src/routers/__tests__/skonto.test.ts -x` | Wave 0 |
| PAY-07 | Locked DE Skonto phrase CI guard | unit | Same locked-phrases-guard.test.ts | Existing (extend) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/{api,validators,shared,einvoice} vitest run --reporter=verbose`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/services/__tests__/payment-export-bacs.test.ts` -- covers PAY-01 BACS generation
- [ ] `packages/api/src/services/__tests__/late-payment-interest.test.ts` -- covers PAY-06 calculation
- [ ] `packages/api/src/services/__tests__/boe-base-rate-poller.test.ts` -- covers PAY-06 polling
- [ ] `packages/api/src/services/__tests__/skonto.test.ts` -- covers PAY-07 eligibility
- [ ] `packages/validators/src/__tests__/bacs.test.ts` -- covers PAY-01 modulus check
- [ ] `packages/shared/src/__tests__/ascii-transliterate.test.ts` -- covers PAY-01 transliteration
- [ ] `packages/api/src/routers/__tests__/bacs.test.ts` -- covers PAY-01 router
- [ ] `packages/api/src/routers/__tests__/late-payment-interest.test.ts` -- covers PAY-06 router
- [ ] `packages/api/src/routers/__tests__/skonto.test.ts` -- covers PAY-07 router
- [ ] Extend `packages/einvoice/src/profiles/xrechnung-de/__tests__/generator.test.ts` with Skonto fixture
- [ ] Extend `packages/validators/src/__tests__/locked-phrases-guard.test.ts` with GB + Skonto DE phrases

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/api/src/services/payment-export.ts` -- established export generator pattern (CSV, Elixir, SEPA XML, SWIFT XML)
- Existing codebase: `packages/api/src/services/bank-account-crypto.ts` -- AES-256-GCM encryption pattern
- Existing codebase: `packages/api/src/services/payment-format-detection.ts` -- format auto-routing logic
- Existing codebase: `apps/web/src/app/api/cron/*/route.ts` -- cron job pattern (CRON_SECRET + withCronMonitor + Sentry)
- Existing codebase: `packages/gov-api/src/rate-limiter.ts` -- GovApiRateLimiter (Upstash, fail-open)
- Existing codebase: `packages/feature-flags/src/registry.ts` -- typed flag registry with jurisdiction
- Existing codebase: `packages/einvoice/src/profiles/xrechnung-de/generator.ts` line 306 -- existing SpecifiedTradePaymentTerms block
- Existing codebase: `packages/validators/src/legal/de.ts` -- locked phrase pattern
- Existing codebase: `packages/api/src/pdf-templates/ir35-sds.tsx` -- React-PDF template pattern

### Secondary (MEDIUM confidence)
- [LPCDA Section 4(1) rate rule](https://www.legislation.gov.uk/ukpga/1998/20) -- statutory rate = BoE rate on 30 Jun or 31 Dec of preceding period + 8%
- [LPCDA compensation tiers (2013 Regulations)](https://www.legislation.gov.uk/uksi/2013/395) -- GBP40/70/100 per debt
- [VocaLink Modulus Checking v8.40](https://www.vocalink.com/tools/modulus-checking/) -- weights table for sort code validation (May 2025)
- [XRechnung 3.0.2 Anhang E Skonto](https://xeinkauf.de/xrechnung/xrechnung/) -- structured extension syntax #SKONTO#TAGE=n#PROZENT=n#BASISBETRAG=n#
- [FinDock BACS Standard 18 documentation](https://docs.findock.com/docs/payment-processors/bacs-dd-collection-file) -- record layout with field positions
- [Bank of England Database](https://www.bankofengland.co.uk/boeapps/database/) -- IUDBEDR series for base rate history
- [Pay.UK Data Formats for Interchange (Oct 2018)](https://www.wearepay.uk/wp-content/uploads/2018/10/Pay.UK-Standard-Data-formats-for-Interchange-October18-1.pdf) -- Standard 18 interchange specification

### Tertiary (LOW confidence)
- BoE CSV API exact response format and accessibility from automated requests -- needs validation during implementation (403 response observed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in the project; no new dependencies needed except VocaLink weights data (shipped as static data, not an npm package)
- Architecture: HIGH -- extends established patterns (payment-export, cron, encrypted fields, React-PDF, feature flags); codebase already has infrastructure for every concern
- Pitfalls: HIGH -- LPCDA statutory rate rule, BACS character set, fixed-width overflow, compensation immutability all documented from authoritative legal/specification sources
- BACS Std 18 field positions: MEDIUM -- assembled from multiple public sources (FinDock, Modulr, HSBC MIG, Pay.UK interchange spec) since the full specification is proprietary. Cross-verified across sources.

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable domain; VocaLink weights table may update quarterly)
