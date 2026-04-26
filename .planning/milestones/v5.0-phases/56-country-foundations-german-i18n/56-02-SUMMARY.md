---
phase: 56
plan: 02
subsystem: validators/uk
tags: [uk, tax-id, validators, checksum, foundations]
dependency-graph:
  requires:
    - "@contractor-ops/validators package (pre-existing)"
  provides:
    - "isValidUtr (HMRC mod-11 checksum) from @contractor-ops/validators"
    - "isValidGbVat (mod-97 + mod-9755 + GBGD/GBHA) from @contractor-ops/validators"
    - "isValidCompaniesHouseNumber (6 regional prefixes + digit-only) from @contractor-ops/validators"
  affects:
    - "Plan 56-04 (UK Zod schema) — consumes all three validators via .refine()"
    - "Plan 56-06 (UK field group component) — consumes validators in RHF resolver"
tech-stack:
  added: []
  patterns:
    - "Pure-function validator pattern (mirrors validatePolishNip in country-fields.ts)"
    - "Whitespace/hyphen normalization before regex + checksum evaluation"
    - "Anchored regex (^...$) — ReDoS-safe (mitigates T-56-03)"
    - "Dual-checksum acceptance for coexisting VAT variants (mitigates T-56-05)"
key-files:
  created:
    - "packages/validators/src/uk-validators.ts (136 lines)"
    - "packages/validators/src/__tests__/uk-validators.test.ts (354 lines, 57 tests)"
    - ".planning/phases/56-country-foundations-german-i18n/deferred-items.md"
  modified:
    - "packages/validators/src/index.ts (+5 lines — barrel re-exports for 3 new symbols)"
decisions:
  - "Whitespace + hyphens stripped pre-validation so users can paste VAT/UTR formatted the way HMRC presents them (e.g. 'GB 100 000 089')"
  - "Both mod-97 and mod-9755 VAT checksums accepted (HMRC never reissued numbers — both in active circulation; rejecting post-2010 numbers would reject ~20% of real UK VAT registrations)"
  - "Companies House: structural-only validation (no checksum) — CH does not publish one; Phase 57 adds live API lookup for existence verification"
  - "R0 historic prefix included in CH accept-list — pre-2009 registrations remain valid today"
  - "1-digit Companies House numbers accepted (CH pads internally to 8 digits — rejecting would block legitimate old registrations like Tesco '00000006')"
metrics:
  duration_minutes: 8
  completed: "2026-04-12"
  tests_added: 57
  test_files_added: 1
  source_files_added: 1
  barrel_entries_added: 3
  commits:
    - "040904b test(56-02): add failing UTR validator tests"
    - "74fdd8c feat(56-02): implement isValidUtr with HMRC mod-11 algorithm"
    - "8ef2b33 test(56-02): add failing GB VAT and Companies House tests"
    - "75fa4be feat(56-02): implement isValidGbVat and isValidCompaniesHouseNumber"
    - "1e36597 chore(56-02): log cross-plan barrel collision as deferred item"
---

# Phase 56 Plan 02: UK Tax Identifier Validators Summary

Three UK tax-ID validators (UTR, GB VAT, Companies House number) implemented per HMRC-authoritative checksum algorithms, exported from `@contractor-ops/validators` for use by Zod schemas (Plan 04), RHF resolvers (Plan 06), and tRPC input validation (cross-package).

## Functions Exported

| Function                           | Signature                        | Algorithm                                                             | Exports From                             |
| ---------------------------------- | -------------------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `isValidUtr`                       | `(raw: string) => boolean`       | HMRC mod-11 with weights `[6,7,8,9,10,5,4,3,2]` + lookup table        | `packages/validators/src/uk-validators.ts` |
| `isValidGbVat`                     | `(raw: string) => boolean`       | mod-97 OR mod-9755 checksum, plus GBGD/GBHA accept-lists              | `packages/validators/src/uk-validators.ts` |
| `isValidCompaniesHouseNumber`      | `(raw: string) => boolean`       | Structural regex (6 regional prefix variants + 1–8 digit E/W)         | `packages/validators/src/uk-validators.ts` |

All three also re-exported via the package barrel `packages/validators/src/index.ts`.

## Authoritative Test Vectors Committed

### UTR — 5 valid + 6 invalid + 5 normalization cases = 16 tests

| UTR           | Body        | Weighted Sum | mod 11 | Lookup | Check Digit |
| ------------- | ----------- | ------------ | ------ | ------ | ----------- |
| `5097172561`  | `097172561` | 248          | 6      | 5      | 5           |
| `1123456789`  | `123456789` | 230          | 10     | 1      | 1           |
| `2234567890`  | `234567890` | 264          | 0      | 2      | 2           |
| `9987654321`  | `987654321` | 310          | 2      | 9      | 9           |
| `9000000001`  | `000000001` | 2            | 2      | 9      | 9           |

Plus normalization: whitespace (`50 97 17 25 61`), hyphens (`5097-172-561`), K suffix (`5097172561K`), lowercase k, combined whitespace+K.

### GB VAT — 6 valid vectors across both checksum schemes = 27 tests

| Body        | Weighted | mod-97 check | mod-9755 check | VAT (mod-97)   | VAT (mod-9755) |
| ----------- | -------- | ------------ | -------------- | -------------- | -------------- |
| `1000000`   | 8        | 89           | 34             | `GB100000089`  | `GB100000034`  |
| `1234567`   | 112      | 82           | 27             | `GB123456782`  | `GB123456727`  |
| `9999999`   | 315      | 73           | 18             | `GB999999973`  | —              |
| `0000000`   | 0        | 0            | 42             | —              | `GB000000042`  |

12-digit branch variant: `GB100000089001`, `GB123456782999` (branch not checksummed). Plus GBGD/GBHA boundary vectors (500/999/499/1000 + 000/499/500/999), and 8 invalid / normalization cases.

### Companies House — 14 tests

- E/W digit-only: `00000006` (Tesco), `12345678`, `6`, `1234` — valid; `123456789` — invalid.
- Regional/LLP: `SC123456`, `NI123456`, `OC123456`, `SO123456`, `NC123456`, `R0123456` — all valid.
- Lowercase prefix `sc123456` normalized.
- Invalid: `AB123456`, empty string, `SC12345` (too short), `SC1234567` (too long), `!!!!!!!!`.

## mod-97 / mod-9755 / GBGD / GBHA Behavior Matrix

| Input Form                 | Validation                                                            | Accept Criterion                              |
| -------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| `GB` + 9 digits            | Dual checksum (mod-97 OR mod-9755)                                    | Either scheme matches on the 9-digit body     |
| `GB` + 12 digits           | Dual checksum on first 9 digits; last 3 (branch) ignored              | 9-digit body valid under either scheme        |
| `GBGD` + 3 digits (500–999)| No checksum; accept-list                                              | Digits in `[500..999]`                        |
| `GBHA` + 3 digits (000–499)| No checksum; accept-list                                              | Digits in `[000..499]`                        |
| Any other form             | Reject                                                                | —                                             |

Why dual checksum (T-56-05 mitigation): In 2010 HMRC began issuing new VAT numbers using mod-9755. Existing registrations kept their pre-2010 mod-97 numbers. Both variants remain in active circulation, so a validator that accepts only one scheme would false-reject roughly one fifth of real UK VAT registrations.

## FOUND-01 Coverage

FOUND-01: "User can add UK-specific contractor fields (UTR, Companies House, VAT reg)"

| Subpart                                         | Status in 56-02 | Remainder owner |
| ----------------------------------------------- | --------------- | --------------- |
| Checksum validation for UTR                     | Closed          | —               |
| Checksum validation for GB VAT (both variants)  | Closed          | —               |
| Structural validation for Companies House       | Closed          | —               |
| GBGD/GBHA government/health authority accept    | Closed          | —               |
| Zod schema wiring (`.refine()` callouts)        | Pending         | Plan 56-04      |
| UI field group rendering + RHF resolver         | Pending         | Plan 56-06      |
| Live HMRC/CH lookup (existence check)           | Pending         | Phase 57        |

## Threat Model Mitigations Delivered

| Threat ID | Mitigation                                                                                                            | Status |
| --------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| T-56-03   | Anchored regexes (`^...$`) with bounded quantifiers — ReDoS-safe. Inputs normalized via non-backtracking replacements. | Met    |
| T-56-05   | Both mod-97 and mod-9755 schemes accepted; GBGD/GBHA narrowed to documented numeric ranges; dedicated test coverage.  | Met    |
| T-56-04   | No internal implementation details surfaced from validators (they return `boolean` only). Error-message shaping is Plan 04's responsibility. | Met (nothing to leak from a pure boolean function) |

## Deviations from Plan

### Auto-fixed Issues

None.

### Deferred Issues

1. **[Out-of-scope] Package-wide `tsc` build fails due to other wave-1 plans' barrel entries.**
   - **Found during:** Task 2 verification (`pnpm --filter @contractor-ops/validators build`).
   - **Cause:** Parallel wave-1 executors (likely 56-01 / 56-03 / 56-04) have pre-registered `DeCountryFields`, `UkCountryFields`, `deCountryFieldsSchema`, `ukCountryFieldsSchema`, `handelsregister-courts.js`, `steuernummer-formats.js` etc. in `index.ts`, but the corresponding source files are not yet present in this worktree.
   - **Decision:** Not in 56-02 scope. `isValidUtr`, `isValidGbVat`, `isValidCompaniesHouseNumber` and their tests type-check in isolation and pass 57/57 tests.
   - **Logged at:** `.planning/phases/56-country-foundations-german-i18n/deferred-items.md`.
   - **Resolution owner:** Phase verifier once all wave-1 plans merge.

## Verification Results

- `pnpm --filter @contractor-ops/validators test --run uk-validators` → **57 tests, 57 passed** (UTR: 16, GB VAT: 27, Companies House: 14).
- `npx tsc --noEmit src/uk-validators.ts` — clean (isolated type-check).
- `packages/validators/src/index.ts` re-exports all three functions.
- No other Phase-56 source files modified.
- All regex patterns anchored; no backtracking-vulnerable constructs (ReDoS-safe).

## Self-Check: PASSED

- FOUND: `packages/validators/src/uk-validators.ts`
- FOUND: `packages/validators/src/__tests__/uk-validators.test.ts`
- FOUND: `.planning/phases/56-country-foundations-german-i18n/deferred-items.md`
- FOUND commit `040904b` (test RED UTR)
- FOUND commit `74fdd8c` (feat GREEN UTR)
- FOUND commit `8ef2b33` (test RED VAT + CH)
- FOUND commit `75fa4be` (feat GREEN VAT + CH)
- FOUND commit `1e36597` (chore deferred items)
- Barrel exports confirmed: `isValidUtr`, `isValidGbVat`, `isValidCompaniesHouseNumber` all present in `packages/validators/src/index.ts`.
- Test suite GREEN: 57/57.
