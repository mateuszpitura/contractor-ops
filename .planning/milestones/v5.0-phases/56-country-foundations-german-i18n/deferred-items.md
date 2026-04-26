# Phase 56 — Deferred Items

Items discovered during plan execution that are out of scope for the current plan
and must be resolved by a subsequent plan or the phase verifier.

## From 56-02 (UK Validators)

### Cross-plan barrel collision — packages/validators/src/index.ts

**Discovered during:** 56-02 Task 2 verification (`pnpm --filter @contractor-ops/validators build`).

**Issue:** `packages/validators/src/index.ts` re-exports symbols that do not yet exist in `country-fields.ts`:
- `DeCountryFields` (type)
- `UkCountryFields` (type)
- `deCountryFieldsSchema`
- `deEntityTypeEnum`
- `ukCountryFieldsSchema`
- `ukEntityTypeEnum`

Additionally, `handelsregister-courts.ts` and `steuernummer-formats.ts` are referenced by `index.ts` but not yet present on disk at the time of 56-02 execution.

**Cause:** A parallel wave-1 executor (likely 56-01 scaffold or 56-03/04 German validators) has pre-registered these exports in the barrel, but its source files have not yet landed in this branch's worktree.

**Impact on 56-02:** None for the uk-validators tests (`pnpm test --run uk-validators` passes 57/57). Only the package-wide `tsc` build is affected, and only because of symbols owned by other plans.

**Resolution owner:** The executor of the plan that introduced those barrel entries (56-01 / 56-03 / 56-04) must land the matching source files, OR the phase orchestrator must consolidate parallel-executor branches. The phase verifier should re-run `pnpm --filter @contractor-ops/validators build` once all wave-1 plans are merged.

**Do NOT** revert the index.ts additions — they are intentional per their owning plan.

## From 56-03 (German Validators & Locked Phrases)

### Pre-existing invoice.test.ts currency validation failures

**Discovered during:** 56-03 full-suite run (`pnpm --filter @contractor-ops/validators test --run`).

**Issue:** Three pre-existing failures in `packages/validators/src/__tests__/invoice.test.ts`:
- `invoiceCreateSchema > accepts valid input` — currency='EUR' rejected
- `invoiceCreateSchema > defaults currency to PLN`
- `invoiceCreateSchema > requires currency to be exactly 3 characters`

**Root cause:** Unrelated to Phase 56. Likely stems from a v4.0 currency enum tightening that now rejects previously-valid 3-letter codes like 'EUR', 'USD'. `invoice.ts` schema is unrelated to Phase 56 scope.

**Impact on 56-03:** None. `de-validators.test.ts` (43/43 green) and `locked-phrases-guard.test.ts` (10/10 green) are unaffected.

**Resolution owner:** Phase 50+ invoice-schema owner or the phase verifier at milestone close.

**Do NOT** fix in Phase 56 — out of scope.

