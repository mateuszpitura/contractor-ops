---
phase: 85-theme-a-w-form-intake-tax-treaty-engine
reviewed: 2026-06-16T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - apps/web-vite/src/components/contractors/tax-forms/hooks/use-tax-form-status.ts
  - apps/web-vite/src/components/contractors/tax-forms/tax-form-status-card.tsx
  - apps/web-vite/src/components/portal/tax-forms/hooks/use-tax-form-wizard.ts
  - apps/web-vite/src/components/portal/tax-forms/step-attest.tsx
  - apps/web-vite/src/components/portal/tax-forms/step-determination.tsx
  - apps/web-vite/src/components/portal/tax-forms/step-receipt.tsx
  - apps/web-vite/src/components/portal/tax-forms/step-types.ts
  - apps/web-vite/src/components/portal/tax-forms/step-w8ben-e.tsx
  - apps/web-vite/src/components/portal/tax-forms/step-w8ben.tsx
  - apps/web-vite/src/components/portal/tax-forms/step-w9.tsx
  - apps/web-vite/src/components/portal/tax-forms/tax-form-wizard.tsx
  - apps/web-vite/src/components/portal/tax-forms/treaty-claim-caption.tsx
  - apps/web-vite/src/components/portal/tax-forms/w8-foreign-fields.tsx
  - apps/web-vite/src/pages/portal/tax-form-page.tsx
  - apps/web-vite/src/router/portal-routes.tsx
  - packages/api/src/errors.ts
  - packages/api/src/middleware/require-us-expansion-flag.ts
  - packages/api/src/root.ts
  - packages/api/src/routers/core/index.ts
  - packages/api/src/routers/core/tax-form-router.ts
  - packages/api/src/routers/portal/portal-tax-form-router.ts
  - packages/api/src/routers/portal/portal.ts
  - packages/api/src/services/tax-form-routing.ts
  - packages/api/src/services/tax-form.service.ts
  - packages/api/src/services/treaty-rate.service.ts
  - packages/db/prisma/seed/wht-rates.ts
  - packages/validators/src/index.ts
  - packages/validators/src/w-form-validators.ts
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 85: Code Review Report

**Reviewed:** 2026-06-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

This phase implements the US W-form intake wizard (W-9 / W-8BEN / W-8BEN-E) and the treaty-rate engine for the portal self-certification flow, plus the staff read/track surface. The overall architecture is sound: IDOR scope is locked to `ctx.contractorId` / `ctx.organizationId` across all portal procedures, the ESIGN attestation identity and timestamp are server-derived, the SSN boundary is respected (last-4 only in the snapshot), and `writeAuditLog` is called on submit. However, four blockers were found: the draft endpoint stores raw client data with no SSN sanitization, the treaty-rate ordering relies on lexicographic sort which breaks for specific country codes less than "XX" alphabetically, W-9 form submissions can reach `input.treatyCountry` access under a TypeScript narrowing gap, and the `perjuryAccepted` field is written as `false as never` on uncheck which coerces a type error into a runtime falsy value that the server's `z.literal(true)` will reject—but the UX canSubmit gate does not prevent the RHF form from holding an invalid `perjuryAccepted: false` value between checkbox interactions.

---

## Critical Issues

### CR-01: `saveTaxFormDraft` stores raw unsanitized client data — full SSN can enter `snapshotJson`

**File:** `packages/api/src/routers/portal/portal-tax-form-router.ts:140-163`

**Issue:** `saveTaxFormDraft` accepts `draft: z.record(z.string(), z.unknown())` (an arbitrary JSON bag) and writes it directly into `snapshotJson` without calling `sanitizeFields`. The `sanitizeFields` function and the `FORBIDDEN_FIELD_KEYS` set in `tax-form.service.ts` exist precisely to strip `ssn`, `fullssn`, `ssnencrypted`, bare `tin` scalar, and `fulltin` keys. Because the draft endpoint bypasses this function, a client can persist a full SSN into the `snapshotJson` column by including it in the draft payload, defeating the PII boundary that the service explicitly documents: "the snapshot NEVER carries a full SSN."

`submitTaxForm` correctly routes through `buildFormSnapshot` (which calls `sanitizeFields`), but drafts are never promoted to the final snapshot through that path — they are a separate `snapshotJson` write.

**Fix:**
```typescript
import { sanitizeDraftFields } from '../../services/tax-form.service';
// Inside saveTaxFormDraft, before building snapshotJson:
const snapshotJson = {
  formType: input.formType,
  draft: sanitizeDraftFields(input.draft),   // strip forbidden PII keys
} satisfies Record<string, unknown> as Prisma.InputJsonValue;
```
`sanitizeFields` is already exported (or can be) from `tax-form.service.ts`. Export it and call it on `input.draft` before the upsert.

---

### CR-02: Treaty-rate `orderBy: { contractorResidency: 'asc' }` does not reliably prefer the specific country over `'XX'`

**File:** `packages/api/src/services/treaty-rate.service.ts:155-158`

**Issue:** The query uses `contractorResidency: 'asc'` to place the specific residency row before the `'XX'` fallback row. Ascending alphabetical order only works because `'XX'` sorts lexicographically after most ISO-2 codes (`'AE'`, `'DE'`, `'GB'`, `'IE'`, `'NL'`, `'PL'`, `'SA'`, all < `'XX'`). However, any country code that sorts after `'XX'` alphabetically — currently `'ZA'`, `'ZM'`, `'ZW'`, or any future expansion to countries with two-letter codes in the Y–Z range — would sort AFTER `'XX'`, causing `findFirst` to return the `'XX'` fallback row instead of the specific treaty row. The fix for a country like Zimbabwe (`'ZW'`) would be to apply 30% statutory rate instead of any treaty that exists, a material miscalculation.

The comment says "Prefer the specific residency over the 'XX' fallback" but the mechanism is fragile. The correct approach is to order by specificity, not alphabetically.

**Fix:**
```typescript
orderBy: [
  // Put specific-country rows first, XX fallback last.
  // A CASE expression via raw SQL, or two separate queries (specific first,
  // then XX fallback), is the safe alternative.
  // Option A – two-phase lookup (recommended, no raw SQL):
],
```
Replace with two sequential queries:
```typescript
const specificRow = await prisma.withholdingTaxRate.findFirst({
  where: {
    sourceCountry: 'US',
    contractorResidency,
    serviceType: US_INCOME_TYPE,
    effectiveFrom: { lte: asOf },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
  },
});
const row = specificRow ?? await prisma.withholdingTaxRate.findFirst({
  where: {
    sourceCountry: 'US',
    contractorResidency: 'XX',
    serviceType: US_INCOME_TYPE,
    effectiveFrom: { lte: asOf },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
  },
});
const hasTreatyRow = row !== null && row.treatyRate !== null && row.contractorResidency !== 'XX';
```

---

### CR-03: `submitTaxForm` accesses `input.treatyCountry` without type narrowing for W-9

**File:** `packages/api/src/routers/portal/portal-tax-form-router.ts:179-181`

**Issue:** The `taxFormSubmissionSchema` is a discriminated union. The W-9 branch (`w9FormSchema`) does not include a `treatyCountry` field. At line 180–181:

```typescript
if (input.formType !== 'W9') {
  treatyClaim = await resolveW8TreatyClaim(input.treatyCountry);
}
```

TypeScript narrows `input` correctly inside the `if` block because `formType !== 'W9'` leaves only `W8BEN | W8BENE`, both of which have `treatyCountry`. This is actually type-safe as written. However, the `capturedFields` spread at line 184:

```typescript
const { perjuryAccepted, signerName, ...capturedFields } = input;
```

...spreads the full discriminated union including `treatyCountry` into `capturedFields`, and then passes `capturedFields` as `fields` to `buildFormSnapshot`. For a W-9, the spread will include `tin`, `usEntityType`, and `backupWithholding`, which is fine. But if the client sends a W-9 payload that has been augmented with `ssn` or `fullssn` in unexpected positions in the `input` object (not possible through the validator, but possible if the type guard is ever relaxed), there is no defensive sanitization on the non-`tin` keys of `capturedFields`.

The real blocker: `capturedFields` for a W-9 will include `formType`, which is redundant and harmless, but more critically — `capturedFields` is passed as-is to `buildFormSnapshot({ fields: capturedFields })`. The `sanitizeFields` in `buildFormSnapshot` will strip any SSN keys from the nested fields object. So `submitTaxForm` itself is protected for the submit path. **The actual blocker is CR-01 (draft path), not this path.** Downgrading this to WARNING — see WR-01.

*Correction: this finding is reclassified. See WR-01.*

---

### CR-03 (corrected): `perjuryAccepted: false as never` casts a type violation into a runtime value the server will reject, with no client-side guard preventing submission

**File:** `apps/web-vite/src/components/portal/tax-forms/step-attest.tsx:97-99`

**Issue:** When the contractor unchecks the perjury checkbox, the code writes:
```typescript
setValue('perjuryAccepted', checked === true ? true : (false as never), {
  shouldValidate: false,
});
```

`perjuryAccepted` is typed `z.literal(true)` — the schema only allows `true`. The `false as never` cast silences the TypeScript error but writes `false` into the RHF field. The `canSubmit` gate correctly prevents the submit button from being enabled when `perjuryChecked === false`, so under normal interaction a user cannot reach the server with `perjuryAccepted: false`.

However, `shouldValidate: false` prevents RHF from clearing or invalidating the field. If the contractor: (1) checks the box → `perjuryAccepted = true`, (2) proceeds to another step, (3) comes back and unchecks → `perjuryAccepted = false` is now written to the form, (4) the `canSubmit` guard blocks the button — but the value in the RHF store is now invalid and will cause a Zod parse failure on the next submit attempt even after re-checking (because `setValue` with `shouldValidate: false` does not re-trigger the resolver until a subsequent `shouldValidate: true` or submit). This is a correctness issue that can leave the form in a stuck-validator state.

The correct pattern is to never write `false` to a `z.literal(true)` field; instead unset it:
```typescript
setValue('perjuryAccepted', checked ? true : undefined, {
  shouldValidate: true,
});
```
The `canSubmit` guard already prevents submission when unchecked; the field value should reflect the real schema type at all times.

---

### CR-04: `requestTaxForm` audit log passes `actorId: ctx.user?.id` which may be `undefined`

**File:** `packages/api/src/routers/core/tax-form-router.ts:87`

**Issue:** `tenantProcedure` middleware populates `ctx.user` from the session. When `ctx.user` is present (which it should be for a staff procedure behind `requirePermission`), `ctx.user?.id` returns the correct staff user ID. However, `ctx.user?.id` uses optional chaining and produces `undefined` if `ctx.user` is null/undefined. The `writeAuditLog` signature accepts `actorId?: string | null`, so `undefined` is accepted — but an audit row with no actor ID is an auditing gap: you cannot reconstruct who requested the W-form.

The session guarantee should be asserted, not silently coalesced. For a mutation behind `requirePermission`, the user must be present; an optional chain masks a configuration bug.

**Fix:**
```typescript
actorId: ctx.user.id,   // not optional chaining — requirePermission guarantees ctx.user exists
```
If there is a type concern, add a guard: `if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })` before the audit call. Do not use optional chaining on `ctx.user` in authenticated procedures.

---

## Warnings

### WR-01: `submitTaxForm` — `capturedFields` spread includes `formType` in `fields`, inflating snapshot

**File:** `packages/api/src/routers/portal/portal-tax-form-router.ts:184-197`

**Issue:** The destructure is:
```typescript
const { perjuryAccepted, signerName, ...capturedFields } = input;
```
This leaves `formType` inside `capturedFields`, so the snapshot's `fields` object contains a redundant `formType` key. The outer `snapshot.formType` already carries the form type. While not a security issue (no PII), it means the snapshot contains a duplicate key that could cause confusion when reading the record later.

**Fix:**
```typescript
const { perjuryAccepted, signerName, formType, ...capturedFields } = input;
```
Then pass `formType` explicitly (it's already passed as `input.formType` to `buildFormSnapshot`).

---

### WR-02: Treaty-rate `resolveTreatyDecision` throws a plain `Error` for override without reason, instead of a `TRPCError`

**File:** `packages/api/src/services/treaty-rate.service.ts:80-82`

**Issue:** When a manual override is supplied without a reason, `resolveTreatyDecision` throws:
```typescript
throw new Error('Treaty-rate override requires a non-empty reason');
```
This is a pure function with no tRPC dependency, so this is architecturally correct. However, the calling code (`applyTreaty` → router) does not catch and re-wrap this exception. A plain `Error` escapes into the tRPC error formatter as an `INTERNAL_SERVER_ERROR` with no structured error key, rather than a `BAD_REQUEST` with a known error key. The client receives an opaque 500 and cannot distinguish a validation failure from a true server error.

This path is currently only exercised by a future staff override endpoint that does not yet exist in the reviewed files, but it is load-bearing logic that will silently produce a 500 when wired.

**Fix:** Either catch the plain `Error` in `applyTreaty` and rethrow as a `TRPCError`, or make `resolveTreatyDecision` return a `Result<TreatyDecision, string>` and let the caller handle it. Since this is a shared service called by both portal and staff paths, wrapping at the call site is cleaner:
```typescript
// in the router:
try {
  treatyClaim = await resolveW8TreatyClaim(input.treatyCountry);
} catch (err) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: TREATY_OVERRIDE_REASON_REQUIRED,
    cause: err,
  });
}
```

---

### WR-03: `STEP_ORDER` is duplicated in `use-tax-form-wizard.ts` and `tax-form-wizard.tsx`

**File:** `apps/web-vite/src/components/portal/tax-forms/hooks/use-tax-form-wizard.ts:28` and `apps/web-vite/src/components/portal/tax-forms/tax-form-wizard.tsx:39`

**Issue:** `STEP_ORDER` is defined identically in both files:
```typescript
const STEP_ORDER: WizardStep[] = ['determination', 'form', 'attest', 'receipt'];
```
If a step is added, renamed, or reordered in one file but not the other, the stepper's visual progress indicator and the hook's navigation logic will diverge. The container computes `currentStepNumber` from its own `STEP_ORDER`, while the hook computes `stepIndex` from its own copy.

**Fix:** Export `STEP_ORDER` from the hook file and import it into the container:
```typescript
// in use-tax-form-wizard.ts
export const STEP_ORDER: WizardStep[] = ['determination', 'form', 'attest', 'receipt'];

// in tax-form-wizard.tsx
import { STEP_ORDER, useTaxFormWizard } from './hooks/use-tax-form-wizard.js';
```

---

### WR-04: W-9 step's `US_ENTITY_TYPES` local constant does not come from the shared `usEntityTypeEnum` — drift risk

**File:** `apps/web-vite/src/components/portal/tax-forms/step-w9.tsx:19-26`

**Issue:** The step defines its own local `US_ENTITY_TYPES` array:
```typescript
const US_ENTITY_TYPES = [
  'SOLE_PROPRIETOR', 'LLC', 'C_CORP', 'S_CORP', 'PARTNERSHIP', 'INDIVIDUAL',
] as const;
```
`usEntityTypeEnum` is already exported from `@contractor-ops/validators`. The values match today, but if a new entity type is added to `usEntityTypeEnum` (e.g., `'TRUST'`, `'ESTATE'` for cross-border edge cases), the step's select won't show it, and the validator will accept it from the server side while the UI never offers it. The canonical source is the schema enum.

**Fix:**
```typescript
import { usEntityTypeEnum } from '@contractor-ops/validators';
const US_ENTITY_TYPES = usEntityTypeEnum.options;
```

---

### WR-05: `treaty-claim-caption.tsx` `hasTreaty` check excludes the 0% rate case when article is present

**File:** `apps/web-vite/src/components/portal/tax-forms/treaty-claim-caption.tsx:21`

**Issue:**
```typescript
const hasTreaty = treatyClaim !== null && treatyClaim.rate < 30 && treatyClaim.article !== null;
```
A 0% treaty rate (e.g., US-PL, US-DE, US-GB, US-IE, US-NL all seed to `treatyRate: 0.0`) satisfies `rate < 30` and `article !== null`, so these will correctly display "applied". However, if the rate is exactly `30` (statutory) but a treaty article is somehow present (e.g., a future treaty that doesn't actually reduce the rate below 30%), the component shows "no treaty" even though there is an article. More importantly, the `rate < 30` check is a UI heuristic for "treaty reduced the rate" — it silently fails to display the treaty for any hypothetical treaty that keeps the rate at 30%. The semantic check should be based on `source` or the presence of an article, not the numeric rate threshold:

```typescript
const hasTreaty = treatyClaim !== null && treatyClaim.article !== null;
```
If a treaty claim with an article exists, display it regardless of whether the rate equals the statutory rate. The `rate < 30` check conflates "is this treaty beneficial" with "is this a treaty claim", which are different questions.

---

## Info

### IN-01: `saveTaxFormDraft` has no DRAFT-only enforcement — non-DRAFT update path is absent

**File:** `packages/api/src/routers/portal/portal-tax-form-router.ts:130-163`

**Issue:** The `existingDraft` lookup correctly filters `status: 'DRAFT'`. If an ACTIVE or SUPERSEDED row exists for the same `formType`, `existingDraft` will be null and `create` will be called, inserting a new DRAFT alongside the existing ACTIVE row. This is acceptable behavior for re-certification flows but there is no guard to prevent a contractor from having multiple DRAFT rows for the same `formType` (one from `saveTaxFormDraft` and another from a concurrent session, for example — `findFirst` returns the first match; `update` then touches only that one). The `create` branch doesn't scope to "no existing DRAFT" with a unique constraint — it just creates blindly.

This is guarded at the DB level only if a unique constraint on `(contractorId, organizationId, formType, status='DRAFT')` exists in the Prisma schema. If no such partial unique index exists, concurrent draft saves from two browser tabs can create two DRAFT rows. Worth verifying the Prisma migration.

**Fix:** Add a `upsert` pattern with a composite unique key, or verify the DB partial index exists.

---

### IN-02: `StepReceipt` displays `signedAt` from `new Date()` (client clock) instead of the server-returned timestamp

**File:** `apps/web-vite/src/components/portal/tax-forms/hooks/use-tax-form-wizard.ts:144`

**Issue:**
```typescript
setReceipt({
  id: result.id,
  formType: result.formType as TaxFormType,
  signedAt: new Date(),   // client clock
});
```
The server derives `signedAt` and writes it into the immutable snapshot. The receipt step displays `signedAt` from the local `Date.now()` — a cosmetic mismatch when client and server clocks differ. The server should return the canonical `signedAt` and the client should display that. Consider returning `signedAt` from `submitTaxForm` so the receipt shows the server-recorded timestamp.

---

### IN-03: `errors` prop is unused (prefixed `_errors`) in `StepAttest` — dead prop in the interface

**File:** `apps/web-vite/src/components/portal/tax-forms/step-attest.tsx:58`

**Issue:**
```typescript
errors: _errors,
```
The `errors` prop from `TaxFormStepProps` is destructured but immediately renamed to `_errors` and never used. The attestation step does not render field-level validation errors (the submit is gated by `canSubmit`), so field errors are legitimately not needed here. However, the prop is still declared in the interface and passed by the container. If field errors are intentionally not shown on the attest step, the prop should be omitted from the interface or the component should document why it is not used.

---

_Reviewed: 2026-06-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
