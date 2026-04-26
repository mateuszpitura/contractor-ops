---
phase: 68-skonto-bg20-xrechnung-fix
plan: 05
subsystem: api
tags: [zugferd, generate-zugferd-pdf, skonto, cascade, router, bg-20]

requires:
  - phase: 68-skonto-bg20-xrechnung-fix
    provides: GenerateZugferdInput.skontoTerm field (Plan 68-04) + finalize cascade pattern (Plan 68-03)
  - phase: 63-uk-payments-financial-features
    provides: SkontoTerm Prisma model + resolveSkontoTerm cascade (D-21)
  - phase: 62-zugferd-e-invoicing
    provides: generateZugferdPdf tRPC procedure
provides:
  - Eager-fetched SkontoTerm relations in generateZugferdPdf invoice load
  - Skonto cascade resolution wired into the generateZugferdPdf tRPC procedure
  - Layer C router test coverage (3 cascade branches)
affects: []

tech-stack:
  added: []
  patterns:
    - Inline Prisma → SkontoTermData mapper at the router boundary (matching the einvoice-finalize.ts pattern)

key-files:
  created: []
  modified:
    - packages/api/src/routers/einvoice.ts
    - packages/api/src/routers/__tests__/einvoice.generate-zugferd.test.ts

key-decisions:
  - "D-06 honored: cascade resolution lives inline in routers/einvoice.ts (NOT extracted to a wrapper service)"
  - "Inline 6-line ternary mapper per branch (matches Plan 03 + payment.ts:1239-1253; premature DRY guard at 3 call sites)"

patterns-established:
  - "Single-line cascade resolution at router boundary: resolveSkontoTerm(invoiceTerm, profileDefault)"
  - "Cast-type widening preserves Record<string, unknown> intersection so existing destructuring code keeps working"

requirements-completed:
  - EINV-02
  - EINV-04
  - PAY-04

duration: 5 min
completed: 2026-04-26
---

# Phase 68 Plan 05: Wire Skonto Cascade Through generateZugferdPdf Router Summary

**Plumbed the existing `resolveSkontoTerm` cascade into the `generateZugferdPdf` tRPC procedure so callers of the ZUGFeRD generation endpoint produce PDF/A-3 documents whose embedded factur-x.xml carries BG-20 Payment Terms when a Skonto term is configured — closing the audit I-1 ZUGFeRD-cascading wiring at the router boundary.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-26T13:20:00Z
- **Completed:** 2026-04-26T13:25:00Z
- **Tasks:** 4
- **Files modified:** 2

## Accomplishments
- Extended Prisma `include` in `generateZugferdPdf` procedure with `skontoTerms: { take: 1 }` on invoice + nested `contractor.billingProfiles[0].skontoTerms[0]` (verbatim mirror of Plan 03's `loadInvoiceWithRelations` extension)
- Widened the result-cast structural type to acknowledge the new array fields (preserving the `Record<string, unknown>` intersection)
- Added inline 6-line ternary mapper per branch (Decimal → number coercion per RESEARCH Pitfall 3)
- Cascade-resolution block calls existing `resolveSkontoTerm(invoiceSkonto, profileSkonto)` (no new helper)
- `generateZugferdPdf({ invoice: envelope, skontoTerm: effectiveSkonto })` (was: `{ invoice: envelope }`)
- Layer C router test (3 cascade branches) — all 10 tests pass (7 prior + 3 new)
- Full api test suite shows zero regression: 56 failed files / 36 failed tests baseline → identical 56 / 36 with +6 new passing tests across Plans 03 + 05

## Task Commits

1. **Tasks 1-4 (atomic): wire Skonto cascade through generateZugferdPdf router** - `0d67928a` (fix)

## Files Created/Modified
- `packages/api/src/routers/einvoice.ts` - Extended Prisma include + cast type; added cascade resolution + opts forwarding; added resolveSkontoTerm + SkontoTermData imports
- `packages/api/src/routers/__tests__/einvoice.generate-zugferd.test.ts` - Extended invoiceRow factory with cascade defaults; added "Skonto BG-20 cascade plumbing" describe with 3 tests

## Decisions Made
- Followed D-06/D-08 verbatim for the router cascade + Layer C test
- Did NOT add Leitweg-ID resolution (the existing procedure does NOT resolve one — out of scope per CONTEXT.md "Out of scope" §)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] einvoice dist needed rebuild after Plan 04**
- **Found during:** Task 2 acceptance criteria (`cd packages/api && npx tsc --noEmit` exits 0)
- **Issue:** TypeScript reported `Object literal may only specify known properties, and 'skontoTerm' does not exist in type 'GenerateZugferdInput'` because the api package consumes the einvoice **dist** (not source), and Plan 04 had updated `GenerateZugferdInput` in source but the dist was not yet rebuilt. Same root-cause class as Plan 03's `SkontoTermInput` re-export oversight.
- **Fix:** Ran `pnpm --filter @contractor-ops/einvoice build` to refresh `dist/profiles/zugferd-de/generator.d.ts`. tsc no longer reports the error.
- **Files modified:** None (build artifact regeneration only)
- **Verification:** `cd packages/api && npx tsc --noEmit` returns no Phase-68-related errors (only pre-existing baseline noise in `late-payment-interest.ts`, `onboarding-import.ts`, `auth/src/roles.ts`).
- **Committed in:** N/A — build artifact, not source

**2. [Rule 1 - Bug / Pre-existing scope-out] api package has 56 pre-existing failed test files**
- Same as Plan 68-03 deviation #2 — pre-existing baseline noise. Phase 68 Plan 05 introduces zero new failed files or failed tests; +3 new passing tests via the Layer C cascade additions.

---

**Total deviations:** 2 documented (1 build-artifact rebuild, 1 pre-existing scope-out)
**Impact on plan:** Plan 05 lands cleanly. The audit I-1 finding is fully closed at this point.

## Issues Encountered

**Build dist staleness between phase plans.** The api package consumes the einvoice **build output** (`dist/`), not the source. When a phase touches einvoice public types AND api callers in the same flow, the einvoice package must be rebuilt before api typecheck runs. Tracked as a follow-up: "Investigate moving the api package to consume einvoice source (workspace TS path mapping) to eliminate the rebuild step between cross-package edits in the same phase". Not urgent; current workaround (run `pnpm --filter @contractor-ops/einvoice build`) is documented in this summary.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness

**Phase 68 is COMPLETE.** All 5 plans shipped atomically:
- 68-01: shared interface widening (`f0876a2a`)
- 68-02: XRechnungDEProfile + Layer A test (`610e7057`)
- 68-03: finalizeEInvoice cascade + Layer B test + einvoice root re-export (`85bc636f`)
- 68-04: ZUGFeRD profile/generator + embedded-CII end-to-end test (`c0aa3a9d`)
- 68-05: generateZugferdPdf router cascade + Layer C router test (`0d67928a`) ← THIS PLAN

**Audit I-1 status:** RESOLVED. The DE invoice → XRechnung CII → ZUGFeRD embedded CII path now provably carries BG-20 Payment Terms whenever a Skonto term is configured on either the invoice or its contractor's default billing profile. The provability is layered:
- **Layer A (Plan 02):** `XRechnungDEProfile.generate({ skontoTerm })` produces XML containing `#SKONTO#TAGE=…#PROZENT=…#BASISBETRAG=…#`
- **Layer B (Plan 03):** `finalizeEInvoice` resolves the cascade and forwards the resolved term to `profile.generateAndValidate`
- **Layer C router (Plan 05):** `generateZugferdPdf` tRPC procedure resolves the cascade and forwards to the einvoice-package generator
- **Layer C deeper end (Plan 04):** end-to-end PDF generation + CII extraction + BG-20 grep on the actual extracted bytes

---
*Phase: 68-skonto-bg20-xrechnung-fix*
*Completed: 2026-04-26*
