---
phase: 63-uk-payments-financial-features
plan: 02
subsystem: payments
tags: [bacs, std18, ascii-transliteration, vocalink, modulus-check, gbp, uk, fixed-width, payment-export, format-detection]

requires:
  - phase: 63-uk-payments-financial-features
    provides: BACS validators, VOCALINK_MODULUS_TABLE_V840, BACS_STD18 enum value (Plan 63-01)
provides:
  - transliterateToBacs pure function (packages/shared)
  - TRANSLITERATION_TABLE map covering German, Polish, French, Nordic, Italian/Spanish diacritics
  - generateBacsStandard18 BACS Std 18 Direct Credit fixed-width file generator
  - BacsExportItem, BacsOrgBankInfo, BacsGenerateResult type exports
  - detectFormatForDestination format auto-detection (GBP+UK -> BACS_STD18 before IBAN rules)
  - Destination type with optional UK encrypted bank fields
  - ExportFormat union extended with BACS_STD18
affects: [63-03, 63-04, 63-05, 63-06, 63-07]

tech-stack:
  added: []
  patterns:
    - "Pure-function file generators with aggregated warnings (transliteration + modulus check)"
    - "Detection layered around legacy detectFormat to keep PLN/EUR/SWIFT routing untouched"

key-files:
  created:
    - packages/shared/src/ascii-transliterate.ts
    - packages/shared/src/ascii-transliterate-table.ts
    - packages/shared/src/__tests__/ascii-transliterate.test.ts
  modified:
    - packages/shared/src/index.ts
    - packages/api/src/services/payment-export.ts
    - packages/api/src/services/payment-format-detection.ts
    - packages/api/src/services/__tests__/payment-export.test.ts
    - packages/api/src/services/__tests__/payment-format-detection.test.ts

key-decisions:
  - "Transliteration treats unmappable characters as warnings (replaced[]), NOT hard errors — UI per D-06 must block download until resolved"
  - "Added detectFormatForDestination as a NEW function rather than modifying detectFormat signature — preserves existing PLN/EUR/SWIFT call sites; old function delegates from new"
  - "BACS detail record processing-date field is 6 chars (5-char YYDDD + 1 padding space) per Pay.UK Std 18 spec — tests trim before equality check"
  - "Modulus warnings are surfaced (not blocked) per D-01 — exception-category sort codes can produce false negatives"
  - "Amount overflow check uses < 100_000_000_000 (max 11-digit pence = 99_999_999_999 = GBP 999,999,999.99); 0-padding via padStart"
  - "toJulianDate uses UTC to avoid timezone drift across regions"

patterns-established:
  - "transliterateToBacs: code-point-iterating Unicode -> BACS-safe ASCII with replaced[] warning surface"
  - "buildDetailRecord: explicit 12-field 106-char concatenation with hard length-check guard"

requirements-completed: [PAY-01]

duration: 11min
completed: 2026-04-25
---

# Phase 63 Plan 02: BACS Std 18 Generator + ASCII Transliteration Summary

**Pure-function BACS Standard 18 Direct Credit file generator with VocaLink modulus check warnings, deterministic European-diacritic transliteration, and GBP+UK account format auto-detection routing to BACS_STD18 before IBAN rules**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-04-25T21:28:51Z
- **Completed:** 2026-04-25T21:39:46Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 5

## Accomplishments

- `transliterateToBacs(input): { output, replaced[] }` covers German (ä/ö/ü/ß), Polish (ą/ć/ę/ł/ń/ó/ś/ź/ż), French (é/è/ê/ë/á/à/â/ç), Nordic (ø/å), Italian/Spanish (í/ì/î/ï/ñ/ú/ù/û/ô/ò) — uppercase + lowercase variants — with `replaced[]` tracking for unmappable CJK/Arabic/emoji characters surfaced to the UI.
- `generateBacsStandard18(items, orgBank, runRef, processingDate)` produces a fixed-width Pay.UK Standard 18 Direct Credit file: VOL1 + HDR1 + HDR2 + UHL1 + N detail records (each EXACTLY 106 chars) + EOF1 + EOF2 + UTL1, joined with CR/LF, no BOM. Transaction code `99`, YYDDD Julian processing date, amount in pence zero-padded to 11 digits.
- VocaLink modulus check (v8.40 weights) runs per item; warnings aggregated into `modulusWarnings[]` for UI display per D-01 (warn, do not block — exception sort codes can false-negative).
- Transliteration warnings aggregated into `transliterationWarnings[]` with the original contractor name + the list of replaced characters so the UI can block download until resolved (per threat model).
- 11-digit pence overflow throws — `amountMinor >= 100_000_000_000` (>= GBP 1B) is rejected; the maximum representable amount is GBP 999,999,999.99 (99_999_999_999 pence).
- Format detection: NEW `detectFormatForDestination(currency, destination)` checks GBP + UK encrypted sort code/account BEFORE IBAN rules (D-04). Existing `detectFormat(currency, iban)` and PLN/Elixir, EUR/SEPA, default-SWIFT routing left untouched.
- `BACS_STD18` added to the `ExportFormat` union; `ExportFormat` and `Destination` types now exported.
- `transliterateToBacs` re-exported from `@contractor-ops/shared` package root.

## Task Commits

Each task was committed atomically:

1. **Task 1: ASCII transliteration utility** — `9d4103c1` (feat)
2. **Task 2: BACS Std 18 generator + GBP+UK format detection** — `7b7cf344` (feat)

_Both tasks followed the TDD cycle in a single commit each: tests written first (RED), implementation second (GREEN), verified before commit._

## Files Created/Modified

- `packages/shared/src/ascii-transliterate-table.ts` — `TRANSLITERATION_TABLE: Map<string, string>` with European diacritic mappings (NEW)
- `packages/shared/src/ascii-transliterate.ts` — `transliterateToBacs` pure function with code-point iteration + BACS-allowed-character set (NEW)
- `packages/shared/src/__tests__/ascii-transliterate.test.ts` — 25 unit tests covering diacritics, BACS punctuation, CJK/Arabic/emoji unmappable, real-world contractor names (NEW)
- `packages/shared/src/index.ts` — re-exports `transliterateToBacs`, `TransliterateResult`, `TRANSLITERATION_TABLE`
- `packages/api/src/services/payment-export.ts` — `generateBacsStandard18`, `BacsExportItem`, `BacsOrgBankInfo`, `BacsGenerateResult`, plus internal `toJulianDate`, `padField`, `padZero`, `bacsField`, `buildDetailRecord` helpers
- `packages/api/src/services/payment-format-detection.ts` — `BACS_STD18` added to `ExportFormat`, `Destination` interface exported, `detectFormatForDestination(currency, destination)` added (delegates to legacy `detectFormat` for non-BACS paths)
- `packages/api/src/services/__tests__/payment-export.test.ts` — 22 new BACS generator tests (8-line file shape, 106-char detail length, transaction code 99, field-position assertions, Julian date, transliteration warnings, modulus warnings, amount overflow, originator field)
- `packages/api/src/services/__tests__/payment-format-detection.test.ts` — 8 new `detectFormatForDestination` tests (GBP+UK -> BACS_STD18, BACS-before-IBAN precedence, missing-field guards, currency mismatches, fallback paths)

## Decisions Made

- **Layered new detection over old.** `detectFormatForDestination` is a NEW function; the legacy `detectFormat(currency, iban)` is preserved as-is and is delegated to from the new function for non-BACS paths. This keeps existing payment-router call sites stable while giving the BACS path a typed `Destination` argument.
- **Transliteration is non-blocking at the generator layer.** The function never throws on unmappable characters; it surfaces them via `replaced[]` so the UI per D-06 can block download. Only amount overflow throws — that is a hard correctness guard (a malformed amount would produce a silently-rejected file at the bank).
- **YYDDD Julian uses UTC.** Avoids timezone drift when the same input date is processed from different regions.
- **Detail record processing-date field is 6 chars.** The 5-char YYDDD plus 1 padding space, per the Pay.UK Standard 18 spec (positions 101-106). Tests assert `.trimEnd()` against the expected Julian value to make this explicit.
- **Buffer encoding is 'ascii'.** BACS Std 18 is strictly ASCII; using Buffer.from(text, 'ascii') makes any non-ASCII leak (which would have been a transliteration bug) immediately detectable.

## Deviations from Plan

None — plan executed exactly as written.

The plan called out `destination` type extension but did not specify whether to modify the existing `detectFormat(currency, iban)` signature or add a new function. I chose to add `detectFormatForDestination(currency, destination)` and keep `detectFormat` untouched — this preserves all existing call sites in `groupItemsByFormat` and other consumers. The new function and the `Destination` type are exported for downstream plans (63-04 router will consume them).

## Issues Encountered

- **`@contractor-ops/shared` dist was stale at first test run.** The `payment-export.ts` test failed with `transliterateToBacs is not a function` because the API package consumes shared via `dist/index.js` (per `package.json` `main`), not `src/`. Resolved by running `pnpm --filter @contractor-ops/shared run build` once before the API tests can resolve the new export. Future iterations on `@contractor-ops/shared` exports will need the same rebuild step (or a `tsc --watch` running in the background).
- **Pre-existing unrelated test failures in the api package.** Tests like `invoice.test.ts`, `ksef-sync.test.ts`, etc. fail when running the full api test suite — these are mock-pattern issues from prior commits (`17e69875` — "test(api): repair 10 mock-pattern failures") and are unrelated to Phase 63 Plan 02. Out of scope per the deviation rules' SCOPE BOUNDARY.

## User Setup Required

None — no external service configuration required.

## Threat Flags

None — surface introduced is fully covered by the plan's `<threat_model>`:
- Field overflow: mitigated by `padField`/`padZero` with hard 106-char length check
- Non-ASCII bank rejection: mitigated by `transliterateToBacs` + UI must block when `replaced[]` non-empty
- Amount overflow: mitigated by explicit `< 100_000_000_000` check that throws

## Known Stubs

None — `generateBacsStandard18` is fully wired and `detectFormatForDestination` is ready for the tRPC router (Plan 63-04) to consume.

## Next Phase Readiness

- Plan 63-04 (BACS tRPC router) can import `generateBacsStandard18`, `BacsExportItem`, `BacsOrgBankInfo`, `BacsGenerateResult` from `payment-export.js` and `detectFormatForDestination` + `Destination` from `payment-format-detection.js` directly.
- Plan 63-05/63-06 UI surfaces have the warning structures (`transliterationWarnings`, `modulusWarnings`) shaped exactly as required by D-06's "Preview BACS file" action.
- The shared package's `transliterateToBacs` is generally available — Plan 63-04 can also use it for live preview in the BACS submitter form's name field (D-02 max-18-ASCII-chars constraint).

## Self-Check: PASSED

- All created files verified on disk at project-root paths (no `.claude/worktrees/...` prefix):
  - `packages/shared/src/ascii-transliterate.ts` ✓
  - `packages/shared/src/ascii-transliterate-table.ts` ✓
  - `packages/shared/src/__tests__/ascii-transliterate.test.ts` ✓
- Both task commits verified in git log on `v2`: `9d4103c1`, `7b7cf344`
- Plan grep assertions:
  - `grep generateBacsStandard18 packages/api/src/services/payment-export.ts` -> 2 matches ✓
  - `grep BACS_STD18 packages/api/src/services/payment-format-detection.ts` -> 5 matches ✓
  - `grep transliterateToBacs packages/shared/src/index.ts` -> 1 match ✓
- Test verification:
  - `@contractor-ops/shared` 42 tests pass (incl. 25 transliterate tests) ✓
  - `@contractor-ops/api` payment-export.test.ts + payment-format-detection.test.ts: 92 tests pass (22 new BACS + 8 new detection + 62 legacy) ✓

---
*Phase: 63-uk-payments-financial-features*
*Completed: 2026-04-25*
