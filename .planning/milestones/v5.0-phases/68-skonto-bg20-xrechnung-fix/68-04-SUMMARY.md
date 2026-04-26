---
phase: 68-skonto-bg20-xrechnung-fix
plan: 04
subsystem: einvoice
tags: [zugferd, skonto, bg-20, embedded-cii, pdf-a3]

requires:
  - phase: 68-skonto-bg20-xrechnung-fix
    provides: Widened EInvoiceProfile.generate signature (Plan 68-01)
  - phase: 62-zugferd-e-invoicing
    provides: ZugferdDEProfile + generateZugferdPdf + extractCiiXml test helper
  - phase: 63-uk-payments-financial-features
    provides: SkontoTermInput type + buildPaymentTerms BG-20 emission helper
provides:
  - GenerateZugferdInput.skontoTerm field
  - ZugferdDEProfile.generate(invoice, opts?) symmetric DE profile contract
  - End-to-end embedded-CII BG-20 emission proof via PDF extract
  - comfort-skonto.json fixture
affects: [68-05]

tech-stack:
  added: []
  patterns:
    - Symmetric DE-profile generate(invoice, opts) contract across XRechnung + ZUGFeRD
    - End-to-end PDF generate → CII extract → BG-20 grep test pattern

key-files:
  created:
    - packages/einvoice/src/profiles/zugferd-de/__fixtures__/comfort-skonto.json
  modified:
    - packages/einvoice/src/profiles/zugferd-de/profile.ts
    - packages/einvoice/src/profiles/zugferd-de/generator.ts
    - packages/einvoice/src/profiles/zugferd-de/__tests__/generator.test.ts

key-decisions:
  - "D-05 honored: opts type inline (anonymous) with leitwegId + skontoTerm — symmetric with XRechnungDEProfile"
  - "End-to-end test extracts factur-x.xml from real PDF and asserts BG-20 substrings — no mocking at boundary"

patterns-established:
  - "ZUGFeRD path: PDF/A-3 generation → CII extraction via existing extractCiiXml helper → BG-20 grep"
  - "Inline anonymous opts type for ZugferdDEProfile.generate (no ZugferdGenerateOptions extracted)"

requirements-completed:
  - EINV-02
  - EINV-04
  - PAY-04

duration: 5 min
completed: 2026-04-26
---

# Phase 68 Plan 04: Wire Skonto Through ZugferdDEProfile + generateZugferdPdf Summary

**Plumbed `skontoTerm` opt through `ZugferdDEProfile.generate` and `generateZugferdPdf` so ZUGFeRD PDF/A-3 documents emitted with a Skonto opt contain the structured `#SKONTO#TAGE=…#PROZENT=…#BASISBETRAG=…#` BG-20 extension in their embedded factur-x.xml — proven end-to-end by extracting the CII bytes from a generated PDF and grepping the BG-20 substrings.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-26T13:14:30Z
- **Completed:** 2026-04-26T13:20:00Z
- **Tasks:** 5
- **Files modified:** 4

## Accomplishments
- `GenerateZugferdInput.skontoTerm?: SkontoTermInput | null` field added (D-05)
- `generator.ts:82` 3-arg call: `generateXRechnungCii(input.invoice, leitwegId, input.skontoTerm ?? null)` — threads Skonto into the embedded CII
- `ZugferdDEProfile.generate(invoice, opts?: { leitwegId?, skontoTerm? })` symmetric with `XRechnungDEProfile.generate` (D-05)
- `comfort-skonto.json` fixture (structural copy of `comfort-minimal.json`; differs only in `id` and `paymentReference`)
- 2 new end-to-end tests in `zugferd-de/__tests__/generator.test.ts`: Skonto path extracts CII and asserts `#SKONTO#TAGE=7` + `#PROZENT=3.00` + `#BASISBETRAG=`; no-Skonto path asserts `not.toContain('#SKONTO#')`
- Full einvoice test suite green: 504/504 (502 prior + 2 new)
- tsc clean across einvoice

## Task Commits

1. **Tasks 1-5 (atomic): wire Skonto through ZugferdDEProfile + generateZugferdPdf** - `c0aa3a9d` (fix)

## Files Created/Modified
- `packages/einvoice/src/profiles/zugferd-de/profile.ts` - Added `SkontoTermInput` import; widened `generate` signature with opts forwarding
- `packages/einvoice/src/profiles/zugferd-de/generator.ts` - Added `SkontoTermInput` import; added `skontoTerm?` to `GenerateZugferdInput`; threaded through to `generateXRechnungCii`
- `packages/einvoice/src/profiles/zugferd-de/__tests__/generator.test.ts` - Added `comfortSkonto` let + load + 2 new it() blocks
- `packages/einvoice/src/profiles/zugferd-de/__fixtures__/comfort-skonto.json` - NEW Skonto-bearing EInvoice fixture (Skonto term itself supplied at call time, not in fixture)

## Decisions Made
- Followed D-05/D-08 verbatim for the symmetric DE profile contract + end-to-end test
- The end-to-end test is the deeper end of D-08 Layer C — it generates a REAL PDF, extracts the embedded CII via the existing `extractCiiXml` helper, and asserts the BG-20 substrings. This is byte-level proof that the Skonto cascade reaches the embedded factur-x.xml end-to-end (the router half — Plan 05 — only asserts call shape against a mocked generator)

## Deviations from Plan

None — plan executed exactly as written. The 4 acceptance grep checks all pass on first execution. tsc clean on first execution. All 8 tests pass on first execution (no fixture iteration required).

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- **Plan 68-05 (router cascade) is unblocked.** `GenerateZugferdInput.skontoTerm?` is the receiver Plan 05's `routers/einvoice.ts:generateZugferdPdf` cascade resolves into.
- **The ZUGFeRD half of audit I-1 is provably closed** at the embedded-CII byte level. Plan 05 closes the router-boundary half (call-shape proof against mocked generator).

---
*Phase: 68-skonto-bg20-xrechnung-fix*
*Completed: 2026-04-26*
