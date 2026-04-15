---
phase: 63
slug: uk-payments-financial-features
status: issues_found
depth: standard
files_reviewed: 47
findings:
  critical: 3
  warning: 7
  info: 5
  total: 15
reviewed: 2026-04-15
---

# Phase 63 — UK Payments & Financial Features: Code Review

## Summary

Phase 63 adds BACS Standard 18 file export, VocaLink modulus checking, LPCDA late payment
interest calculation, Skonto early payment discount, BoE base rate history management, and
associated DB models. The core business logic (interest calculation, skonto eligibility, BACS
format detection) is sound. Three critical issues were found: a feature flag key mismatch that
would cause TypeScript build failures, an undefined field reference that would produce a
runtime error in the Skonto evaluation router, and a permission resource that is not registered
in the access control statement. Several lower-severity issues are documented below.

---

## Critical Findings

### CR-01 — Feature flag key mismatch: `'PAY_LATE_INTEREST_ENABLED'` not in registry

**File:** `packages/api/src/routers/late-payment-interest.ts`
**Lines:** 53, 182, 285, 345, 390, 560

The router uses `requireFeatureFlag('PAY_LATE_INTEREST_ENABLED')` throughout, but the flag
registry in `packages/feature-flags/src/registry.ts` defines the key as
`'payments.late-interest-enabled'`. `requireFeatureFlag` is typed as
`requireFeatureFlag<K extends FlagKey>(key: K)` where `FlagKey = keyof typeof FLAGS`. Since
`'PAY_LATE_INTEREST_ENABLED'` does not exist in `FLAGS`, every call is a TypeScript type error
and will fail to compile.

**Impact:** All six late-payment-interest procedures are unreachable at runtime; the build would
fail unless `tsconfig` is running with errors ignored.

**Suggested fix:**
```typescript
// Replace every occurrence of:
.use(requireFeatureFlag('PAY_LATE_INTEREST_ENABLED'))
// with:
.use(requireFeatureFlag('payments.late-interest-enabled'))
```

---

### CR-02 — `invoice.amountMinor` does not exist on the `Invoice` model

**File:** `packages/api/src/routers/skonto.ts`
**Line:** 284

```typescript
invoiceTotalMinor: invoice.amountMinor,
```

The Prisma `Invoice` model (`packages/db/prisma/schema/invoice.prisma`) does not have an
`amountMinor` field. The fields are `subtotalMinor`, `totalMinor`, and `amountToPayMinor`.
`amountMinor` belongs to the `InvoicePayment` model. At runtime this produces `undefined`,
causing `evaluateSkontoEligibility` to receive `NaN` for all monetary calculations (discount
amount, discounted amount). TypeScript would flag this as a property-not-found error.

**Suggested fix:** Use `invoice.amountToPayMinor` (the net payable amount after WHT, which is
the correct base for discount eligibility) or `invoice.totalMinor` if gross total is intended:
```typescript
invoiceTotalMinor: invoice.amountToPayMinor,
```

---

### CR-03 — `'admin:boe-rate'` is not a registered permission resource; `settings.write` does not exist

**Files:**
- `packages/api/src/routers/admin-boe-rate.ts` (lines 33, 46, 94, 136)
- `packages/api/src/routers/bacs.ts` (line 352)

The `accessControlStatement` in `packages/auth/src/permissions.ts` defines the complete set of
valid resources: `organization`, `member`, `invitation`, `contractor`, `contract`, `document`,
`invoice`, `workflow`, `payment`, `report`, `settings`, `integration`, `time`, `equipment`.

1. `requirePermission({ 'admin:boe-rate': ['write'] })` — `'admin:boe-rate'` is not a key in
   `accessControlStatement`. The `Permission` type is derived as `{ [R in Resource]?: ... }` so
   this is a TypeScript type error. At runtime Better Auth's `hasPermission` will receive an
   unknown resource and may return `false` (locked out) or silently succeed depending on
   implementation.

2. `requirePermission({ settings: ['write'] })` (bacs.ts:352) — `settings` is valid but its
   allowed actions are `['read', 'update']`. There is no `'write'` action, making this another
   type error. Effective behavior: all settings mutations in the BACS submitter config are
   blocked for every role.

**Suggested fixes:**
```typescript
// admin-boe-rate.ts: use an existing resource or add 'admin:boe-rate' to accessControlStatement
// Simplest short-term fix — gate on organization:update (owners only):
.use(requirePermission({ organization: ['update'] }))

// bacs.ts saveSubmitterConfig: use the correct action name
.use(requirePermission({ settings: ['update'] }))
```

Longer term, add `'admin:boe-rate': ['read', 'write']` to `accessControlStatement` and assign
it to the `owner` role in `roles.ts`.

---

## Warning Findings

### WR-01 — `console.warn` in `payment-export.ts` violates project logging policy

**File:** `packages/api/src/services/payment-export.ts`
**Lines:** 190–193

```typescript
console.warn(
  `[payment-export] Missing taxId (NIP) for contractor "${item.contractorName}" in Elixir export — using empty value`,
);
```

Project memory explicitly forbids `console.*` in source files; the `@contractor-ops/logger`
factory must be used instead.

**Suggested fix:**
```typescript
import { createLogger } from '@contractor-ops/logger';
const log = createLogger({ service: 'payment-export' });
// ...
log.warn(
  { contractorName: item.contractorName },
  'Missing taxId (NIP) for contractor in Elixir export — using empty value',
);
```

---

### WR-02 — `daysOverdue` calculation off-by-one relative to `overdueStartMs`

**File:** `packages/api/src/services/late-payment-interest.ts`
**Lines:** 190, 207

```typescript
const dueDateMs = new Date(invoiceDueDate).getTime();
const overdueStartMs = dueDateMs + 24 * 60 * 60 * 1000; // +1 day — correctly starts day after due
// ...
const daysOverdue = Math.floor((endDateMs - dueDateMs) / (24 * 60 * 60 * 1000)); // counts from due date
```

`overdueStartMs` is computed correctly (interest starts the day _after_ due date, per LPCDA).
However, `daysOverdue` is computed from `dueDateMs`, not `overdueStartMs`. This means a debt
paid exactly 1 day late shows `daysOverdue = 1` but with `accruedInterest = dailyInterest * 1`.
The math happens to be consistent because it produces the same total, but semantically
`daysOverdue` should be the number of days of actual interest accrual (i.e., counted from
`overdueStartMs`). The claim PDF shows `daysOverdue` as a labelled quantity to the debtor, so
the label mismatch could be contested legally.

**Suggested fix:** Compute `daysOverdue` from `overdueStartMs`:
```typescript
const daysOverdue = Math.floor((endDateMs - overdueStartMs) / (24 * 60 * 60 * 1000));
```
Ensure tests are updated accordingly. Net interest total is unchanged.

---

### WR-03 — SkontoTerm XOR constraint not enforced at DB level

**File:** `packages/db/prisma/schema/financial.prisma`
**Lines:** 32–36

`SkontoTerm` has `invoiceId String? @unique` and `billingProfileId String? @unique`. Both are
nullable, which means a row where both are `NULL` is currently valid (an orphan term). Prisma
does not support `CHECK` constraints natively. There is no migration-level constraint preventing
a `SkontoTerm` with neither `invoiceId` nor `billingProfileId` set, and the upsert router
procedures explicitly set the unused FK to `null`. An orphan row would accumulate silently and
waste space but, more critically, a future migration that adds a NOT-NULL constraint would fail.

**Suggested fix:** Add a raw `CHECK` constraint in the next migration:
```sql
ALTER TABLE skonto_term
  ADD CONSTRAINT skonto_term_xor_fk
  CHECK (
    (invoice_id IS NOT NULL AND billing_profile_id IS NULL)
    OR
    (invoice_id IS NULL AND billing_profile_id IS NOT NULL)
  );
```
Document in schema comments that Prisma cannot express this constraint.

---

### WR-04 — SEPA XML `CtrlSum` hard-codes `'EUR'` regardless of actual currency

**File:** `packages/api/src/services/payment-export.ts`
**Lines:** 256, 263

```typescript
<CtrlSum>${minorToDecimal(totalAmount, 'EUR')}</CtrlSum>
```

`generateSepaXml` hard-codes `'EUR'` for the `CtrlSum` decimal formatting even though SEPA
technically only applies to EUR transfers. The issue arises if `minorToDecimalStr` uses the
ISO 4217 exponent for decimal placement: for 2-decimal currencies this is fine, but for
zero-decimal currencies (e.g. JPY) a future extension could silently misprice amounts by a
factor of 100. This is a latent risk rather than an immediate bug, but `EUR` should be derived
from the actual payment currency or asserted.

**Suggested fix:** Pass `items[0]?.currency ?? 'EUR'` (consistent with the SWIFT variant) or
add an assertion that all items are EUR.

---

### WR-05 — VocaLink modulus table is a partial stub; missing ~1,050 sort-code ranges

**File:** `packages/validators/src/bacs-modulus-tables.ts`

The file explicitly documents: _"The full VocaLink table contains ~1100 entries. This file
encodes a representative subset…"_. With only ~34 range entries covering the largest banks,
the vast majority of UK sort codes fall through `matches.length === 0` and return
`{ valid: true }` (pass-through default). This means the modulus check is effectively a no-op
for ~95% of sort codes, defeating its purpose as a fraud/error filter.

**Suggested fix:** Import the complete `valacdos.txt` from VocaLink and parse it at build time
into the table. VocaLink publishes updates semi-annually; this should be a cron-refreshed asset
or a checked-in parsed JSON. The stub is appropriate for a v1 MVP but should be replaced before
production BACS submissions.

---

### WR-06 — `claim` mutation uses low-entropy ID for R2 key

**File:** `packages/api/src/routers/late-payment-interest.ts`
**Line:** 470

```typescript
const claimId = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
```

`Math.random()` is not cryptographically secure. The 6-character base-36 suffix provides only
~30.7 bits of entropy. Combined with a predictable millisecond timestamp, this could allow an
attacker who knows a claim was recently created to enumerate the R2 key and attempt to access
the signed PDF URL (if the URL somehow leaks). The proper approach is `crypto.randomUUID()` or
`randomBytes`.

**Suggested fix:**
```typescript
import { randomBytes } from 'node:crypto';
const claimId = `claim-${Date.now()}-${randomBytes(12).toString('hex')}`;
```

---

### WR-07 — Admin layout uses `prismaRaw` (non-tenant-scoped) client for membership lookup

**File:** `apps/web/src/app/admin/layout.tsx`
**Lines:** 7–8, 27–33

The layout imports `prisma` from `@contractor-ops/db` and queries `member` directly without
tenant scoping. Since `Member` is in the `globalModels` set (intentionally, for auth flows), the
Prisma client extension will pass through without injecting `organizationId`. The query does
include `organizationId: activeOrgId` in the `where` clause, so this is functionally correct.
However, using the raw `prisma` client (rather than a tenant-scoped client) in a server
component means any accidental query on a non-global model would bypass RLS. Prefer using the
auth-scoped db instance consistently.

This is a minor pattern inconsistency rather than an exploitable bug, but it creates a footgun
for future developers who extend this layout.

---

## Info Findings

### IR-01 — `resolveStatutoryRate` returns `0` silently when rate history is empty

**File:** `packages/api/src/services/late-payment-interest.ts`
**Lines:** 110–111

```typescript
// If no rate found, return 0 (should not happen with seeded data)
return 0;
```

Returning `0` causes the statutory rate to be `0 + 8 = 8%` (the +8 pp surcharge alone). This
is incorrect — the LPCDA base rate cannot be determined without BoE data. The comment
acknowledges this should not happen, but there is no observability hook. If the `BoEBaseRateHistory`
table is empty (fresh deployment, data corruption), claims would be computed with 8% instead
of the correct rate with no logging to alert operators.

**Suggested fix:** Add a `log.warn` or `log.error` call before returning `0`:
```typescript
log.error({ debtPeriodStart }, 'No BoE rate found for statutory period — defaulting to 0');
return 0;
```

---

### IR-02 — `SkontoTerm` in `Invoice` Prisma relation is named `skontoTerms` (plural) but schema has `@unique` FK

**File:** `packages/db/prisma/schema/invoice.prisma` (line 68), `financial.prisma` (line 32)

The `Invoice` relation is declared as `skontoTerms SkontoTerm[]` (array), but `SkontoTerm.invoiceId`
has `@unique`. Prisma allows this but the array type is misleading — only one `SkontoTerm` per
invoice can ever exist. The router correctly uses `skontoTerm: true` (singular) in its include,
but `invoice.skontoTerms` in a generic include would return an array. Consider renaming to
`skontoTerm SkontoTerm?` in the Invoice and ContractorBillingProfile relations for clarity and
to match the `@unique` constraint semantics.

---

### IR-03 — `skonto.evaluateForInvoice` fetches `invoice.amountMinor` (after CR-02 fix: `amountToPayMinor`) without specifying `select`

**File:** `packages/api/src/routers/skonto.ts`
**Lines:** 236–248

The `invoice.findFirst` includes the full `contractor` with nested `billingProfile` and
`skontoTerm`, loading more data than needed. The invoice itself is fetched with all fields. A
`select` clause scoping to `{ amountToPayMinor, issueDate, paidAt, skontoTerm, contractor: { ... } }`
would reduce payload. Minor performance issue only.

---

### IR-04 — `bacsSubmitterNameSchema` allows empty string

**File:** `packages/validators/src/bacs.ts`
**Lines:** 27–32**

```typescript
export const bacsSubmitterNameSchema = z
  .string()
  .max(18)
  .regex(/^[A-Z0-9 \-\.\'\/&\(\)\+,\:;\?=@"]*$/, ...)
```

The schema has no `.min(1)`, so an empty string passes validation. BACS Standard 18 requires a
non-empty submitter name. The form UI enforces a placeholder but does not add a required rule
beyond Zod at the API layer.

**Suggested fix:** Add `.min(1, 'Submitter name is required')`.

---

### IR-05 — `late-interest-card.tsx` renders a dead branch (B2C banner is unreachable)

**File:** `apps/web/src/components/invoices/late-interest/late-interest-card.tsx`
**Lines:** 104–111

```typescript
if (!isApplicable) return null;           // line 104

// B2C banner
if (isApplicable && !isBusinessCustomer) { // line 107 — always false (isApplicable already checks isBusinessCustomer)
  return ...
}
```

`isApplicable` is `featureEnabled && countryCode === 'GB' && isBusinessCustomer && currency === 'GBP'`.
The second guard `if (isApplicable && !isBusinessCustomer)` can never be `true` because
`isApplicable` requires `isBusinessCustomer === true`. The B2C banner is dead code.

**Suggested fix:** Remove the dead branch and rely solely on the `!isApplicable` early return,
or restructure the gate logic to show the B2C banner for GB GBP invoices that fail only the
`isBusinessCustomer` check.

---

## Files Not Found in Working Tree

The following files listed in the review spec exist only in the
`agent-af1af2f4` sparse worktree and were reviewed from that location. They are not committed
to the current `v2` branch at the time of review:

- `packages/shared/src/ascii-transliterate.ts`
- `packages/shared/src/ascii-transliterate-table.ts`
- `packages/integrations/src/services/boe-base-rate-poller.ts`
- `apps/web/src/app/api/cron/boe-rate-poll/route.ts`
- `apps/web/src/components/payments/bacs/*.tsx` (5 files — reviewed from worktree)
- `apps/web/src/components/contractors/billing-profile/uk-bank-fields-section.tsx`
- `apps/web/src/components/contractors/billing-profile/sort-code-validator.tsx`
- `apps/web/src/app/[locale]/(dashboard)/settings/payments/page.tsx`

The BACS router (`packages/api/src/routers/bacs.ts`) also lives only in `agent-af1af2f4`.
All three critical findings affected files that are in the main repo.

---

## Findings Summary Table

| ID    | Severity | File                                              | Issue                                                                         |
|-------|----------|---------------------------------------------------|-------------------------------------------------------------------------------|
| CR-01 | Critical | routers/late-payment-interest.ts                  | Feature flag key `'PAY_LATE_INTEREST_ENABLED'` not in registry → build error  |
| CR-02 | Critical | routers/skonto.ts:284                             | `invoice.amountMinor` does not exist on Invoice model → runtime undefined     |
| CR-03 | Critical | routers/admin-boe-rate.ts, routers/bacs.ts        | `'admin:boe-rate'` not a valid permission resource; `settings.write` invalid  |
| WR-01 | Warning  | services/payment-export.ts:190                    | `console.warn` violates project logging policy                                |
| WR-02 | Warning  | services/late-payment-interest.ts:207             | `daysOverdue` off-by-one relative to interest accrual start date              |
| WR-03 | Warning  | prisma/schema/financial.prisma                    | SkontoTerm XOR FK constraint not enforced at DB level                         |
| WR-04 | Warning  | services/payment-export.ts:256,263                | SEPA `CtrlSum` hard-codes `'EUR'` regardless of actual currency               |
| WR-05 | Warning  | validators/src/bacs-modulus-tables.ts             | Modulus table is a stub covering ~3% of UK sort codes                         |
| WR-06 | Warning  | routers/late-payment-interest.ts:470              | Low-entropy `Math.random()` for R2 claim key                                  |
| WR-07 | Warning  | apps/web/src/app/admin/layout.tsx                 | Uses raw `prisma` client in server component — footgun for future devs        |
| IR-01 | Info     | services/late-payment-interest.ts:110             | Silent `return 0` with no logging when rate history empty                     |
| IR-02 | Info     | prisma/schema/invoice.prisma:68                   | `skontoTerms[]` relation name misleading given `@unique` FK                   |
| IR-03 | Info     | routers/skonto.ts                                 | Missing `select` on invoice fetch causes overfetching                         |
| IR-04 | Info     | validators/src/bacs.ts:27                         | `bacsSubmitterNameSchema` allows empty string — no `.min(1)`                  |
| IR-05 | Info     | components/invoices/late-interest/late-interest-card.tsx:107 | Dead branch: B2C banner unreachable after `!isApplicable` early return |
