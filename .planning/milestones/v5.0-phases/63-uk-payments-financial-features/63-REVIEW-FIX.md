---
phase: 63-uk-payments-financial-features
fixed_at: 2026-04-25T22:57:48Z
review_path: .planning/phases/63-uk-payments-financial-features/63-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 63: Code Review Fix Report

**Fixed at:** 2026-04-25T22:57:48Z
**Source review:** `.planning/phases/63-uk-payments-financial-features/63-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (Critical: 2, Warning: 8)
- Fixed: 10
- Skipped: 0
- Info-level findings (6) intentionally out of scope per the `critical_warning` configuration.

After all fixes, the BACS router test suite went from 10 → 14 passing tests
(`pnpm --filter @contractor-ops/api vitest run src/routers/__tests__/bacs.test.ts`),
with new regression coverage for CR-01 (CJK contractor name guard), CR-02
(non-GBP rejection), WR-05 (DRAFT run rejection), and WR-06 (missing org row
NOT_FOUND).

## Fixed Issues

### CR-01: Defense-in-depth unmappable-character guard never fires (server + client)

**Files modified:** `packages/api/src/routers/bacs.ts`, `apps/web/src/components/payments/bacs/bacs-preview-card.tsx`, `packages/api/src/routers/__tests__/bacs.test.ts`
**Commit:** c6f54fd2
**Applied fix:** Switched both server and client guards from `replaced.includes('?')` (a false signal — `transliterateToBacs` records the ORIGINAL Unicode characters in `replaced`, never the literal `'?'`) to `replaced.length > 0` (the actual signal that an unmappable substitution occurred). Added a regression test driving `generateExport` with a CJK contractor name (`日本商事`) asserting `BAD_REQUEST` is thrown and that `putObjectAndSignDownload` / `document.create` / `paymentExport.create` are never called. Documented the trap with a comment explaining why `includes('?')` was wrong.

### CR-02: BACS export ignores payment run currency — non-GBP items can be exported as BACS

**Files modified:** `packages/api/src/routers/bacs.ts`, `packages/api/src/routers/__tests__/bacs.test.ts`
**Commit:** 2bc3b611
**Applied fix:** Added a defence-in-depth precondition in `loadRunWithBacsItems`: select item-level `currency`, refuse the run when its run-level `currency` is set to anything other than `'GBP'`, and refuse the run when any item's `currency` is not `'GBP'`. Throws `PRECONDITION_FAILED` with a descriptive message identifying the offending currency and contractor. Added a regression test covering an EUR run rejected with `PRECONDITION_FAILED` before any R2 upload occurs.

### WR-01: R2 upload happens before DB transaction — failed transaction leaves orphan blobs

**Files modified:** `packages/api/src/routers/bacs.ts`
**Commit:** 425331a1
**Applied fix:** Wrapped the `Document` + `PaymentExport` `$transaction` in a try/catch. On failure, best-effort `deleteObject(r2Key)` cleans up the orphan R2 blob; cleanup errors are logged via `log.warn` but never mask the original transaction error surfaced to the caller. Imported `deleteObject` from `../services/r2.js`. A nightly reaper of unreferenced `payment-exports/{org}/{run}/...` keys remains a sensible backstop (noted in the inline comment).

### WR-02: BoE poller upserts under `todayUtc` instead of the rate's actual `effectiveFrom`

**Files modified:** `packages/integrations/src/services/boe-base-rate-poller.ts`
**Commit:** 5d0222a8
**Applied fix:** Switched the upsert key from a derived `todayUtc` to `latest.date` (the BoE-published date already parsed from the CSV row). The MPC-published date is the legally-significant key for LPCDA §4(1) reference-date lookups; using the cron-run day distorted the historical record on delayed polls and could pick the wrong rate for entire 6-month statutory windows around 30 Jun / 31 Dec. The log line on success now reflects the correct `effectiveFrom`.

### WR-03: BoE poller's update branch silently overwrites a manually-entered rate

**Files modified:** `packages/integrations/src/services/boe-base-rate-poller.ts`
**Commit:** 81765ee1
**Applied fix:** Replaced the `upsert` with a guarded `findUnique`-then-`create` flow. When a row already exists for the target `effectiveFrom` (manual admin entry per D-10, duplicate same-day cron run, or BoE re-publishing the same date), log the existing source and return without writing. Manual overrides are now safe under repeated cron runs.

### WR-04: Pervasive `as any` casts on the encrypted-field boundary

**Files modified:** `packages/api/src/routers/bacs.ts`
**Commit:** eb890e82
**Applied fix:** Introduced typed `BacsTenantDb = Pick<PrismaClient, 'organization' | 'paymentRun' | 'document' | 'paymentExport' | '$transaction'>` and `BacsTenantTx = Pick<PrismaClient, 'document' | 'paymentExport'>` adapters. Updated all helpers (`loadDecryptedSubmitterConfig`, `loadRunWithBacsItems`, `getBacsSubmitterMasks`) to take `BacsTenantDb` instead of `unknown`, removing every `db as any` / `tx as any` cast and the inline `run.items as Array<...>` cast (Prisma now infers the include shape correctly). Each call site uses a single `ctx.db as unknown as BacsTenantDb` narrowing — the unavoidable bridge between the extended tenant-scope client and the narrow Pick subset; everything inside the helpers is properly typed and `tsc --noEmit` is clean for `bacs.ts`. A typo in any encrypted-field name is now a compile-time error rather than a silent `undefined`.

### WR-05: `loadRunWithBacsItems` does not check payment run status (DRAFT runs can be exported)

**Files modified:** `packages/api/src/routers/bacs.ts`, `packages/api/src/routers/__tests__/bacs.test.ts`
**Commit:** 40b2b4bc
**Applied fix:** Added `status` to the `loadRunWithBacsItems` return type and gated `generateExport` to require `LOCKED` or `EXPORTED`. `EXPORTED` stays allowed so re-downloading a previously exported run remains idempotent (matches the payment router's lock-and-export contract). `previewExport` is intentionally unrestricted so admins can review file shape on a DRAFT run. Added a regression test asserting a DRAFT run is rejected with `PRECONDITION_FAILED` before any R2 upload occurs.

### WR-06: `getBacsSubmitterMasks` returns `configured: false` when the row is missing

**Files modified:** `packages/api/src/routers/bacs.ts`, `packages/api/src/routers/__tests__/bacs.test.ts`
**Commit:** 6d104c70
**Applied fix:** When `findUnique` returns `null` (org soft-deleted, mid-deletion, or a tenant-context bug pointing at the wrong region), throw `TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' })` with a structured `log.error` line so ops can trace the bad context. Added a regression test asserting the throw on a `null` org lookup.

### WR-07: Race condition on rapid sort-code validation clicks

**Files modified:** `apps/web/src/components/contractors/billing-profile/sort-code-validator.tsx`
**Commit:** 10d623a7
**Applied fix:** Added a monotonic `useRef<number>` request-id ratchet. Each `handleValidate` invocation increments and captures its own id; the `setOutcome` / `setPending` updates inside `then`/`catch`/`finally` only fire when `myId === requestIdRef.current`. Stale responses are dropped silently, so the most-recent input always wins.

### WR-08: `BacsSubmitterForm` resets the entire form when the submitterName mask loads

**Files modified:** `apps/web/src/components/payments/bacs/bacs-submitter-form.tsx`
**Commit:** 4b241af3
**Applied fix:** Added an `isDirty` guard to the masks-sync `useEffect`: only call `reset()` when the form is pristine. A late-arriving masks query no longer wipes user input on first load, and the post-save `invalidateQueries` refetch no longer re-clears inputs as an accidental side effect (the user is responsible for explicitly clearing the form on success if desired).

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-04-25T22:57:48Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
