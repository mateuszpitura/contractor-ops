---
phase: 68-skonto-bg20-xrechnung-fix
plan: 03
subsystem: api
tags: [einvoice-finalize, skonto, cascade, prisma-include, bg-20]

requires:
  - phase: 68-skonto-bg20-xrechnung-fix
    provides: XRechnungGenerateOptions.skontoTerm + SkontoTermInput re-export (Plan 68-02)
  - phase: 63-uk-payments-financial-features
    provides: SkontoTerm Prisma model + resolveSkontoTerm cascade (D-21)
  - phase: 61-xrechnung-e-invoicing
    provides: finalizeEInvoice mutation orchestration spine
provides:
  - Eager-fetched SkontoTerm relations in loadInvoiceWithRelations
  - Skonto cascade resolution wired into finalizeEInvoice via existing services/skonto.ts:resolveSkontoTerm
  - Inline toSkontoTermData(prismaRow) Prisma → SkontoTermData mapper
  - Layer B test coverage (3 cascade branches: invoice-wins, profile-default, neither)
  - Public einvoice package root re-export of SkontoTermInput
affects: [68-05]

tech-stack:
  added: []
  patterns:
    - Inline Prisma → SkontoTermData mapper at call sites (vs extracted helper) per RESEARCH Pitfall 2
    - Cascade resolution via existing single source-of-truth resolveSkontoTerm

key-files:
  created: []
  modified:
    - packages/api/src/services/einvoice-finalize.ts
    - packages/api/src/services/__tests__/einvoice-finalize.test.ts
    - packages/einvoice/src/index.ts

key-decisions:
  - "D-03 honored: extended Prisma include with skontoTerms + nested billingProfiles.skontoTerms (verbatim mirror of payment.ts:1213-1222)"
  - "D-04 honored: inline toSkontoTermData mapper with Number(row.discountPercent) coercion"
  - "Promoted SkontoTermInput from xrechnung-de subpath to package root re-export — required for api-side imports without subpath drilling"

patterns-established:
  - "Single-line cascade resolution at call sites: resolveSkontoTerm(invoiceTerm, profileDefault) — no per-caller wrapper"
  - "Inline Prisma → SkontoTermData mapper per call site — premature DRY guard at 3 call sites"

requirements-completed:
  - EINV-01
  - EINV-04
  - PAY-04

duration: 6 min
completed: 2026-04-26
---

# Phase 68 Plan 03: Wire Skonto Cascade Through finalizeEInvoice Summary

**Plumbed the existing `resolveSkontoTerm` cascade (Phase 63 D-21) into `finalizeEInvoice` so finalized DE invoices carrying an invoice-level or billing-profile-level Skonto term emit BG-20 `<ram:SpecifiedTradePaymentTerms>` in the persisted CII XML — closing the audit I-1 wiring gap at the finalize-service boundary.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-26T13:08:30Z
- **Completed:** 2026-04-26T13:14:30Z
- **Tasks:** 4
- **Files modified:** 3 (one additional vs the plan — see deviation #1 below)

## Accomplishments
- `loadInvoiceWithRelations` Prisma include extended with `skontoTerms: { take: 1 }` on the invoice + nested `contractor.billingProfiles[0].skontoTerms[0]` (verbatim mirror of the proven `payment.ts:1213-1222` pattern)
- Inline `toSkontoTermData(prismaRow)` helper added — explicit `Number(row.discountPercent)` coercion guards against Decimal-leak (RESEARCH Pitfall 3)
- Cascade resolution block placed between `resolvePreflightWarnings` and `mapPrismaInvoiceToEInvoice` — calls existing `resolveSkontoTerm(invoiceSkonto, profileSkonto)` (no new resolver helper)
- `profile.generateAndValidate` call now passes `{ leitwegId, skontoTerm: effectiveSkonto }` instead of `{ leitwegId }` only
- `SkontoTermInput` re-exported from the einvoice package root (`src/index.ts`) — Plan 02 only added the re-export at the `xrechnung-de` subpath; api-side consumers import from the package root
- Layer B test (3 cascade branches: invoice-wins / profile-default / both-null) — all 13 tests in einvoice-finalize.test.ts pass (10 prior + 3 new)
- Full api test suite shows zero regression: 56 failed files / 36 failed tests baseline → 56 failed files / 36 failed tests after Phase 68 (with +3 new passing tests)

## Task Commits

1. **Tasks 1-4 (atomic): wire Skonto cascade through finalizeEInvoice** - `85bc636f` (fix)

## Files Created/Modified
- `packages/api/src/services/einvoice-finalize.ts` - Extended Prisma include; added toSkontoTermData helper; cascade resolution + opts.skontoTerm forwarding
- `packages/api/src/services/__tests__/einvoice-finalize.test.ts` - Extended InvoiceRow shape + makeInvoice defaults; added "Skonto BG-20 cascade plumbing" describe with 3 tests
- `packages/einvoice/src/index.ts` - Promoted `SkontoTermInput` re-export to package root (alongside `XRechnungGenerateOptions`)

## Decisions Made
- Followed D-03/D-04/D-08 verbatim for the cascade wiring + Layer B fixtures
- Bundled the einvoice root re-export into the 68-03 commit (rather than spawning a 68-02 fix-up commit) — the change is small, atomic with the 68-03 wiring fix, and discovered while compiling 68-03's actual edits

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SkontoTermInput re-export missing from einvoice package root**
- **Found during:** Task 2 acceptance criteria (`cd packages/api && npx tsc --noEmit` exits 0)
- **Issue:** Plan 02 added `export type { SkontoTermInput }` only inside `packages/einvoice/src/profiles/xrechnung-de/index.ts`. The api-side import `import type { SkontoTermInput } from '@contractor-ops/einvoice'` (which Task 2 of this plan adds) failed with `Module '"@contractor-ops/einvoice"' has no exported member 'SkontoTermInput'` because the package's `dist/index.d.ts` (built before Phase 68) and the source `src/index.ts` only re-exported `XRechnungGenerateOptions`, not `SkontoTermInput`.
- **Fix:** One-line addition to `packages/einvoice/src/index.ts` line 224 — promote `SkontoTermInput` to the package root re-export alongside `XRechnungGenerateOptions`. Plus a `pnpm --filter @contractor-ops/einvoice build` to refresh `dist/index.d.ts`.
- **Files modified:** `packages/einvoice/src/index.ts` (1 export addition + 3-line comment)
- **Verification:** `grep "SkontoTermInput" packages/einvoice/dist/index.d.ts` returns the re-export; `cd packages/api && npx tsc --noEmit` no longer reports the import error.
- **Committed in:** `85bc636f` (Plan 03 atomic commit — bundled because the einvoice change is what unblocks the api change in this same plan)

**2. [Rule 1 - Bug / Pre-existing scope-out] api package has 56 pre-existing failed test files**
- **Found during:** Verification step "`pnpm --filter @contractor-ops/api test` exits 0"
- **Issue:** The plan acceptance criterion required the full api test suite to pass. Baseline measurement (with all Phase 68 changes stashed) shows: 225 test files / 56 failed (mostly "0 test" file-load failures rooted in pre-existing TypeScript errors and rbac/auth test scaffold breakage in `late-payment-interest.ts`, `onboarding-import.ts`, `auth/src/roles.ts`, and similar). My Phase 68 changes added +3 passing tests (2244 → 2247) and added zero new failed files or failed tests.
- **Fix:** Out of scope per Rule 4 (architectural / pre-existing scope) — fixing 56 unrelated test files would balloon the phase scope and conflict with the wiring-only intent of the audit I-1 fix.
- **Files modified:** None
- **Verification:** Stashed all Phase 68 changes, ran `pnpm --filter @contractor-ops/api test` → 56 failed files / 36 failed tests. Restored, re-ran → identical 56 / 36 with +3 passing. Diff is empty.
- **Committed in:** N/A — documented only

**3. [Rule 1 - Auto-fix / Cosmetic] biome reformatted `effectiveSkonto` declaration during pre-commit hook**
- **Found during:** Pre-commit hook (`biome check --write`)
- **Issue:** None substantive — biome may have realigned indentation / line length. Functional behavior unchanged.
- **Verification:** All 13 einvoice-finalize.test.ts tests pass post-commit.

---

**Total deviations:** 3 documented (1 blocking auto-fixed in scope, 2 pre-existing/cosmetic)
**Impact on plan:** The cascade wiring lands cleanly. Plan files-modified count went from 2 → 3 due to the einvoice root re-export, which was a real Plan 02 oversight discovered here.

## Issues Encountered

**Pre-existing api test suite breakage (56 failed files).** Many api test files fail at file-load (0 tests run) because of import / type errors in unrelated areas: `auth/src/roles.ts` permission DSL changes, `late-payment-interest.ts` strict-undefined errors, `onboarding-import.ts` validator export, `rbac-recipients.test.ts` undefined module imports, etc. These are independent of Phase 68 and should be triaged in a separate hardening phase. Tracked as a follow-up: "Audit and repair 56 baseline failing api test files unrelated to Phase 68".

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- **Plan 68-05 (router cascade) is unblocked.** The same Prisma include + inline `toSkontoTermData` + `resolveSkontoTerm` pattern can be lifted into `routers/einvoice.ts:generateZugferdPdf`. Plan 68-04's `GenerateZugferdInput.skontoTerm?` field (currently being implemented in parallel-style sequential execution) provides the receiver for Plan 05's resolved value.
- **The XRechnung happy-path (audit I-1's primary surface) is now provably wired end-to-end** at the finalize boundary — Layer A (profile wrapper, Plan 02) + Layer B (finalize service, Plan 03) form the locked test coverage.

---
*Phase: 68-skonto-bg20-xrechnung-fix*
*Completed: 2026-04-26*
