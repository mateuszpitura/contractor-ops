---
phase: 63-uk-payments-financial-features
reviewed: 2026-04-25T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - packages/shared/src/ascii-transliterate.ts
  - packages/shared/src/ascii-transliterate-table.ts
  - packages/shared/src/index.ts
  - packages/shared/src/__tests__/ascii-transliterate.test.ts
  - packages/api/src/services/payment-export.ts
  - packages/api/src/services/payment-format-detection.ts
  - packages/api/src/services/__tests__/payment-export.test.ts
  - packages/api/src/services/__tests__/payment-format-detection.test.ts
  - packages/api/src/services/__tests__/late-payment-interest.test.ts
  - packages/api/src/services/cron-monitor.ts
  - packages/api/src/routers/bacs.ts
  - packages/api/src/routers/__tests__/bacs.test.ts
  - packages/api/src/root.ts
  - packages/integrations/src/services/boe-base-rate-poller.ts
  - apps/web/src/app/api/cron/boe-rate-poll/route.ts
  - apps/web/src/app/[locale]/(dashboard)/settings/payments/page.tsx
  - apps/web/src/components/payments/bacs/bacs-submitter-form.tsx
  - apps/web/src/components/payments/bacs/bacs-preview-card.tsx
  - apps/web/src/components/payments/bacs/bacs-preview-pre.tsx
  - apps/web/src/components/payments/bacs/modulus-check-warning-list.tsx
  - apps/web/src/components/payments/bacs/transliteration-warning-banner.tsx
  - apps/web/src/components/payments/bacs/__tests__/bacs-submitter-form.test.tsx
  - apps/web/src/components/contractors/billing-profile/sort-code-validator.tsx
  - apps/web/src/components/contractors/billing-profile/uk-bank-fields-section.tsx
findings:
  critical: 2
  warning: 8
  info: 6
  total: 16
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-04-25
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

The Phase 63 v2 re-execution (Plans 63-02, 63-03, 63-04) lands a substantial slice of the BACS Std 18 export pipeline plus the BoE base-rate poller. Code quality is overall high — pure-function generators, append-only audit shape, encrypted-plus-masked fields, structured Pino logging, no `console.*` violations, decent a11y on the preview surfaces, and the LPCDA statutory-rate test suite correctly encodes the §4(1) reference-date rule.

Two **critical** correctness defects undermine the BACS download safety net: the unmappable-character guards on both server (`bacsRouter.generateExport`) and client (`BacsPreviewCard`) check `replaced.includes('?')` but `transliterateToBacs.replaced` carries the **original** Unicode characters (e.g. `['日','本']`), never the literal `'?'`. The intended defense-in-depth blocker therefore never fires for non-ASCII names — a user with a CJK/Arabic contractor name would be allowed to download a BACS-rejecting file.

Other notable concerns: the R2 upload happens **before** the Document/PaymentExport transaction (orphaned-blob risk on transaction failure); `loadRunWithBacsItems` does not gate on payment run currency or status (a non-GBP run could be exported as BACS treating the amount as pence); `pollBoeBaseRate` keys upserts on `todayUtc` rather than the rate's actual `effectiveFrom` (correct rate, wrong date if a published change is observed late); and several `as any` escape hatches in the BACS router weaken the type contract at exactly the boundary that handles encrypted columns.

UI components are solid: the preview `<pre>` is keyboard-scrollable with proper `aria-label`, the destructive transliteration banner uses `role="alert"`, and encrypted fields are never shown in plaintext on the client. A few low-severity polish items (race condition on rapid validate clicks, an `useEffect` that wipes user input, missing `aria-live` on the preview, and pervasive `as any` on Prisma access) round out the warning list.

## Critical Issues

### CR-01: Defense-in-depth unmappable-character guard never fires (server + client)

**File:** `packages/api/src/routers/bacs.ts:300`
**Also affects:** `apps/web/src/components/payments/bacs/bacs-preview-card.tsx:115`
**Issue:** The server's mutation explicitly states it "duplicat[es] the UI gate" against unmappable characters that BACS would reject:

```typescript
const hasUnmappable = result.transliterationWarnings.some(w => w.replaced.includes('?'));
```

But `transliterateToBacs` in `packages/shared/src/ascii-transliterate.ts:104-106` pushes the **original** unmappable character into `replaced`, never the literal `'?'`:

```typescript
// 5. Unmappable — record and emit `?`.
replaced.push(char);   // pushes '日', '🎉', etc.
output += '?';
```

Tests at `packages/shared/src/__tests__/ascii-transliterate.test.ts:99,106,112,118` confirm this: `replaced` is e.g. `['日','本']`, never contains `'?'`. The router-level guard therefore evaluates to `false` for every realistic non-ASCII name, allowing the malformed BACS file to be uploaded to R2 and signed for download. The client-side gate in `BacsPreviewCard` has the identical bug, so neither layer of the documented defense-in-depth ever activates. A literal `?` in the input would be in the BACS-allowed character set and pass through unchanged — the only way the current code blocks download is if the user types `?` themselves, which is a false positive, not the intended protection.

This contradicts the threat model in `payment-export.ts:419-421` ("UI MUST block download when any `replaced` entries are present") and the plan's own threat documentation in `63-02-SUMMARY.md:128`.

**Fix:** Use `replaced.length > 0` (the real signal that an unmappable substitution happened) on both layers:

```typescript
// packages/api/src/routers/bacs.ts
const hasUnmappable = result.transliterationWarnings.some(w => w.replaced.length > 0);

// apps/web/src/components/payments/bacs/bacs-preview-card.tsx
const hasUnmappable = transliterationWarnings.some(w => w.replaced.length > 0);
```

Add a regression test in `packages/api/src/routers/__tests__/bacs.test.ts` covering `generateExport` with a CJK/Arabic contractor name and asserting `BAD_REQUEST` is thrown before `putObjectAndSignDownload` is called.

---

### CR-02: BACS export ignores payment run currency — non-GBP items can be exported as BACS

**File:** `packages/api/src/routers/bacs.ts:131-208`
**Issue:** `loadRunWithBacsItems` selects `paymentRun.items` without filtering on or asserting `currency === 'GBP'`. The downstream `BacsExportItem` carries `amountMinor` only; `generateBacsStandard18` then writes that integer into the 11-digit pence field. If the payment run mixes currencies — or is entirely non-GBP — the file will be assembled with foreign-currency minor units misinterpreted as pence by the recipient bank. BACS Std 18 has no currency field; the entire file is implicitly GBP. A €1000 invoice (`amountMinor=100000`) would produce a £1000 GBP detail record.

This is a financial correctness defect: a misuse of `bacs.previewExport` / `bacs.generateExport` against a non-GBP run, or a mixed run, generates a file that BACS will accept and process — paying contractors the wrong amount in the wrong currency. The format-detection layer (`detectFormatForDestination`) does check `currency === 'GBP'` before routing, but the BACS router does not re-verify this at the boundary.

**Fix:** Refuse non-GBP items at the router boundary before invoking the generator. Select `currency` (and the run-level currency if present on `PaymentRun`) in the Prisma include and assert in the loop:

```typescript
const nonGbp = items.find(i => (i as { currency?: string }).currency !== 'GBP');
if (nonGbp) {
  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: `BACS Std 18 requires GBP; payment run includes ${(nonGbp as { currency?: string }).currency ?? 'unknown'} items`,
  });
}
```

Add a unit test in `bacs.test.ts` for an EUR run rejected with `PRECONDITION_FAILED`.

## Warnings

### WR-01: R2 upload happens before DB transaction — failed transaction leaves orphan blobs

**File:** `packages/api/src/routers/bacs.ts:325-364`
**Issue:** `generateExport` uploads the file to R2 via `putObjectAndSignDownload(...)` (line 325) and only then opens `ctx.db.$transaction(...)` to write the `Document` + `PaymentExport` rows. If the DB transaction fails (constraint violation, connectivity blip, retry exhaustion) the R2 object remains, with no `Document` row referencing it, no GC path, and a signed URL already returned to the caller before the failure surfaces. Over time this accumulates unreferenced blobs and (worse) the caller may successfully download a file the system has no audit record of.

**Fix:** Either (a) write Document + PaymentExport rows first with `status: 'PENDING'` then upload, then mark `GENERATED` in a final update; or (b) implement a compensating delete on transaction failure:
```typescript
try {
  await ctx.db.$transaction(async tx => { /* writes */ });
} catch (err) {
  // Best-effort cleanup; do not let cleanup failure mask the original error.
  void deleteR2Object(r2Key).catch(e => log.warn({ err: e, r2Key }, 'BACS export cleanup failed'));
  throw err;
}
```
A nightly reaper of orphaned `payment-exports/{org}/{run}/...` keys without a matching `Document` would also be acceptable but is more infrastructure.

---

### WR-02: BoE poller upserts under `todayUtc` instead of the rate's actual `effectiveFrom`

**File:** `packages/integrations/src/services/boe-base-rate-poller.ts:341-356`
**Issue:** When a new rate is observed, the upsert keys on `todayUtc` (the day the cron ran), not on `latest.date` (the day BoE published the change). The MPC-published `effectiveFrom` is the legally-significant date for LPCDA §4(1) lookups; using the cron-run day distorts the historical record whenever a poll is delayed (e.g. cron skipped for a day, or the rate change is observed the morning after publication). Example: BoE publishes a rate change effective `2026-02-06`; if the cron runs at 06:00 UTC on `2026-02-07`, `BoEBaseRateHistory` records `effectiveFrom=2026-02-07` instead of `2026-02-06`.

The downstream `resolveStatutoryRate` lookup (exercised by tests in `late-payment-interest.test.ts`) compares `entry.effectiveFrom <= referenceDate`. A 1-day error around 30 Jun / 31 Dec is enough to pick the wrong rate for an entire 6-month statutory window.

**Fix:** Key the upsert on `latest.date`:
```typescript
await db.boEBaseRateHistory.upsert({
  where: { effectiveFrom: latest.date },
  create: { effectiveFrom: latest.date, ratePercent: fetchedRate, source: 'BOE_API' },
  update: { ratePercent: fetchedRate, source: 'BOE_API' },
});
```
Also add a unit test pinning the behaviour: when CSV reports a rate effective 2 days before `now`, the inserted row carries that same `effectiveFrom`, not `now`.

---

### WR-03: BoE poller's update branch silently overwrites a manually-entered rate

**File:** `packages/integrations/src/services/boe-base-rate-poller.ts:344-356`
**Issue:** Combined with WR-02 (or even on its own — if a cron runs twice on the same UTC day, or if an admin manually inserted a row for today), the poller's `upsert.update` block unconditionally rewrites `ratePercent` and forces `source: 'BOE_API'`. Per D-10, the admin manual-edit endpoint is explicitly the override path; a cron should not stomp on it. A super-admin who corrects a typo at 09:00 will see their fix reverted at 06:00 UTC the next day.

**Fix:** Make the upsert insert-only — when a row already exists for the target `effectiveFrom`, log and skip:
```typescript
const existing = await db.boEBaseRateHistory.findUnique({ where: { effectiveFrom: latest.date } });
if (existing) {
  log.info(
    { effectiveFrom: latest.date, existingSource: existing.source },
    'BoE rate row exists — skipping (manual override preserved)',
  );
  return { updated: false, currentRate: fetchedRate };
}
await db.boEBaseRateHistory.create({
  data: { effectiveFrom: latest.date, ratePercent: fetchedRate, source: 'BOE_API' },
});
```

---

### WR-04: Pervasive `as any` casts on the encrypted-field boundary

**File:** `packages/api/src/routers/bacs.ts:91-92, 139-140, 316-317, 335-337, 503-504`
**Issue:** Every Prisma access in this router goes through `db as any`, including the reads that pull `bacsServiceUserNumberEncrypted`, `ukSortCodeEncrypted`, etc. The biome ignores (`// biome-ignore lint/suspicious/noExplicitAny: tenant client typing varies`) acknowledge the type-safety hole but choose to live with it. CLAUDE.md mandates strong typing and avoiding unsafe shortcuts, and the encrypted-bank-fields surface is exactly where you most want a typed contract — a typo in `bacsSubmitterAccountNumberEncrypted` would silently return `undefined` and `loadDecryptedSubmitterConfig` would short-circuit to `null`, masking misconfiguration as "submitter not configured".

**Fix:** Either type the tenant client properly (the project already has `createTenantClient`/`getRegionalClient` in `@contractor-ops/db`; expose its `Prisma.PrismaClient`-derived type) or extract a typed adapter:
```typescript
type BacsTenantDb = Pick<Prisma.PrismaClient, 'organization' | 'paymentRun' | 'document' | 'paymentExport' | '$transaction'>;
// then accept BacsTenantDb where currently `unknown` + `as any` is used
```
This also replaces the `tx as any` cast at line 336.

---

### WR-05: `loadRunWithBacsItems` does not check payment run status (DRAFT runs can be exported)

**File:** `packages/api/src/routers/bacs.ts:141-208`
**Issue:** The query `paymentRun.findFirst({ where: { id, organizationId } })` returns the run regardless of `status`. The existing payment-run domain typically requires runs to be `LOCKED` or `EXPORTING` before export operations. Allowing a DRAFT run to produce a downloadable file lets a user generate and submit a file based on an unreviewed item set — the recipient list could change between preview and BACS submission. The `Document` audit row would point to a "version" that no longer exists in the payment-run state.

**Fix:** Inspect existing payment-run state machine (`packages/api/src/services/payment-run-state.ts` or similar) and gate `previewExport` to permit DRAFT for live previews while gating `generateExport` to require LOCKED+:
```typescript
if (run.status !== 'LOCKED' && run.status !== 'EXPORTED') {
  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: `Payment run must be locked before BACS export (current status: ${run.status})`,
  });
}
```

---

### WR-06: `getBacsSubmitterMasks` returns `configured: false` when the row is missing — masking the absence as "not configured"

**File:** `packages/api/src/routers/bacs.ts:514-523`
**Issue:** `findUnique({ where: { id: organizationId } })` returns `null` when the org row literally does not exist (e.g. soft-deleted, mid-deletion, or a tenant-context bug pointing at the wrong region). The fallback returns `{ configured: false, ... }` with no log line. From the UI's perspective this is indistinguishable from "submitter not configured" — the user sees the empty-state form, fills it in, and the subsequent `update` call fails with a much less actionable error. A missing organization row is a serious tenancy/region invariant violation and should surface as an error, not a silent empty state.

**Fix:**
```typescript
if (!org) {
  log.error({ organizationId }, 'getBacsSubmitterMasks: organization row not found');
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
}
```

---

### WR-07: Race condition on rapid sort-code validation clicks

**File:** `apps/web/src/components/contractors/billing-profile/sort-code-validator.tsx:47-62`
**Issue:** `handleValidate` is `async`, sets `pending=true`, awaits `queryClient.fetchQuery(...)`, and finally sets `outcome`. Pressing the button twice in quick succession (or paste-then-click then immediately edit) will fire two parallel queries; the slower one wins and overwrites the outcome of the more-recent input. The button is disabled while `pending` so the failure mode is bounded but still possible (clicks queued before disabled state is committed; fast double-click within React's batched update window).

**Fix:** Use a request-id ratchet to ignore stale responses:
```typescript
const requestIdRef = useRef(0);
const handleValidate = async () => {
  const myId = ++requestIdRef.current;
  setOutcome(null);
  setPending(true);
  try {
    const data = await queryClient.fetchQuery(/* ... */);
    if (myId === requestIdRef.current) setOutcome(data as ValidationOutcome);
  } catch (err) {
    if (myId === requestIdRef.current) setOutcome({ status: 'INVALID', warnings: [/* ... */] });
  } finally {
    if (myId === requestIdRef.current) setPending(false);
  }
};
```

---

### WR-08: `BacsSubmitterForm` resets the entire form when the submitterName mask loads — wipes user edits

**File:** `apps/web/src/components/payments/bacs/bacs-submitter-form.tsx:88-97`
**Issue:** The `useEffect` calls `reset({ ..., submitterName: masks.submitterName })` whenever `masks.submitterName` changes. If the masks query is in flight when the user has already typed into any of the three encrypted fields (SUN / sort code / account number) before the response lands, those edits are wiped to empty strings. React-Query caches will usually have it instantly on revisit, but on first load (no cache) the timing is observable. Worse: invalidating `getSubmitterMasks` after `saveSubmitterConfig` succeeds will trigger this effect again on a refetch, re-clearing inputs every save — which may or may not be the intent (success-clears-form is a reasonable UX, but deserves to be intentional rather than a side effect of the load gate).

**Fix:** Only reset when the form is pristine, or use `defaultValues` from a ready-state prop:
```typescript
useEffect(() => {
  if (masks?.submitterName && !isDirty) {
    reset({
      serviceUserNumber: '',
      submitterSortCode: '',
      submitterAccountNumber: '',
      submitterName: masks.submitterName,
    });
  }
}, [masks?.submitterName, reset, isDirty]);
```
Better: split the form into a wrapper that suspends until masks resolve, then renders `<BacsSubmitterForm initialName={masks.submitterName ?? ''} />` with `defaultValues` set once.

## Info

### IN-01: `BacsExportItem.amountMinor` typed `number` — no compile-time non-negative guarantee

**File:** `packages/api/src/services/payment-export.ts:537-541`
**Issue:** Runtime check throws on negative `amountMinor`, which is correct (BACS Direct Credit is positive amounts). The upstream router takes the value from `paymentRun.items[].amountMinor`, which Prisma types as `number`; nothing on the path forbids a negative refund-style amount, and the only protection is the throw. Also the combined error message conflates negative-amount and overflow into one cause.

**Fix:** Tighten the type via Zod at the router boundary or split the message:
```typescript
if (item.amountMinor < 0) throw new Error('BACS Std 18: negative amounts not supported');
if (item.amountMinor >= BACS_MAX_AMOUNT_PENCE) throw new Error(/* current message */);
```

### IN-02: `toJulianDate` produces wrong day-of-year if caller passes a local-TZ `Date`

**File:** `packages/api/src/services/payment-export.ts:446-453`
**Issue:** The function correctly uses `getUTCFullYear()` and `Date.UTC(...)` for the start-of-year baseline, but `date.getTime()` is a UTC-anchored ms value, while the intent is "the calendar day this Date represents". A `new Date(2026, 3, 15)` (local-TZ midnight) on a +05:00 host yields 23:00 UTC on 2026-04-14 → Julian `26104` instead of `26105`. Current callers (`bacs.ts:260,296`) use `new Date()` (UTC instant) and tests pass `Date.UTC(...)` constants, so the in-tree call sites are safe — but the contract is brittle for downstream callers.

**Fix:** Either rename the parameter and document the contract (`processingDate` must be a UTC-anchored instant), or normalise inside the function:
```typescript
function toJulianDate(date: Date): string {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  // ... compute from utcMidnight
}
```

### IN-03: `parseBoeCsv` silently skips unparseable rows — no telemetry on garbled responses

**File:** `packages/integrations/src/services/boe-base-rate-poller.ts:96-136`
**Issue:** Per the comment, BoE occasionally emits empty rows or footnotes; skipping them is correct. However, if every row is unparseable (BoE redesigns the CSV, breaks the `DD Mon YYYY` format, or returns HTML behind a 200), `parseBoeCsv` returns `[]` and the caller logs "No parseable rows" — but there is no count of *how many rows were attempted vs. parsed*, which would distinguish "BoE returned nothing for this date range" from "BoE format changed and we silently lost everything".

**Fix:** Return a richer structure:
```typescript
return { rows, attempted: lines.length - dataStartIndex, parsed: rows.length };
```
Surface `attempted - parsed` in the warning log. Bonus: alarm in Sentry when `attempted > 0 && parsed === 0`.

### IN-04: Late-interest test does not pin day-counting timezone semantics at boundaries

**File:** `packages/api/src/services/__tests__/late-payment-interest.test.ts:46-58, 217-247`
**Issue:** The test asserts `daysOverdue === 30` when `dueDate=2026-02-13` and `asOf=2026-03-15`. By calendar-day counting in 2026 (non-leap, Feb has 28 days): 13 → 28 = 15 days, +15 days of March = 30. This is correct, but the test does not pin down whether `daysOverdue` is "midnight-to-midnight calendar days" or "ms-floored 86_400_000-second buckets" — a UTC-vs-local-TZ subtlety the late-interest service must get right (the service is not in scope of this review, but the tests are).

**Fix:** Add a test asserting the day-counting boundary explicitly:
```typescript
it('counts a calendar day exactly once across midnight UTC', () => {
  const result = calculateLateInterest(
    makeInput({
      invoiceDueDate: new Date(Date.UTC(2026, 1, 13, 23, 59, 59)),
      asOf:           new Date(Date.UTC(2026, 1, 14, 0,  0,  1)),
    }),
  );
  expect(result.daysOverdue).toBe(1); // not 0, not 2
});
```
Document in the service whether the count is calendar-day-inclusive of `asOf` or exclusive.

### IN-05: `BacsPreviewPre` lacks `aria-busy` while loading and `aria-live` for content updates

**File:** `apps/web/src/components/payments/bacs/bacs-preview-pre.tsx`
**Issue:** Screen-reader users will not be notified when the preview content arrives or when it changes after a re-fetch (e.g. submitter config saved between visits). The `<section aria-label="...">` is good but static.

**Fix:** Add `aria-live="polite"` to the section so that the content changes are announced when the preview transitions from skeleton to text. Pair with `aria-busy={previewQuery.isFetching}` on the parent card (`BacsPreviewCard`) for the loading transitional state.

### IN-06: `formatSortCode` in `ModulusCheckWarningList` returns the input unchanged when length ≠ 6 — no warning on malformed data

**File:** `apps/web/src/components/payments/bacs/modulus-check-warning-list.tsx:30-33`
**Issue:** Defensive but silent: a 5-digit sort code (which would mean an upstream Zod failure leaked into the UI) renders as raw digits with no visual indicator. Low impact because Zod gates upstream, but if it ever happens it's a UX puzzle.

**Fix:** Either render the malformed value with a destructive badge, or surface a warning via the project's structured logger from a UI-side telemetry helper. Visual minimum: flag malformed sort codes with a subtle outline so QA notices.

---

_Reviewed: 2026-04-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
