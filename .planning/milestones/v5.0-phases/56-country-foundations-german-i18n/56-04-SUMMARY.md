---
phase: 56-country-foundations-german-i18n
plan: 04
subsystem: validators
tags: [zod, typescript, germany, uk, steuernummer, handelsregister, discriminated-union, superrefine]

requires:
  - phase: 56-country-foundations-german-i18n
    provides: "Plan 02 UK validators (isValidUtr, isValidGbVat, isValidCompaniesHouseNumber) and Plan 03 DE validators (isValidUstIdNr, isValidSvNummer, isValidHandelsregister) — consumed via forward-declared imports and now resolved post wave-1 merge"
provides:
  - "STEUERNUMMER_FORMATS lookup map (16 Bundesländer, regex + germanName + example + length) with getSteuernummerFormat / getSteuernummerRegex helpers"
  - "HANDELSREGISTER_COURTS readonly array (126 Amtsgerichte covering all 16 Bundesländer) with slug-style codes and HandelsregisterCourt type"
  - "ukCountryFieldsSchema Zod schema enforcing D-04 rules via superRefine (SOLE_TRADER → UTR required; LTD/LLP → Companies House required; VAT toggle → VAT reg required)"
  - "deCountryFieldsSchema Zod schema enforcing D-04 rules via superRefine (Steuernummer required + Bundesland-specific regex dispatch; Handelsregister required for UG/GMBH; USt-IdNr required when VAT-registered and not Kleinunternehmer)"
  - "countryFieldsSchemaMap extended with GB and DE branches; AE and SA entries unchanged"
affects: [56-05 (i18n DE translations + legal/de.ts), 56-06 (UK/DE form UI), 56-07 (privacy notices), 57 (HMRC/VIES), 58 (classification), 61 (XRechnung), 62 (ZUGFeRD)]

tech-stack:
  added: []
  patterns:
    - "Zod discriminated-union-by-country via countryFieldsSchemaMap dispatch"
    - "Field-level .refine for checksum errors + superRefine for cross-field / entity-type-driven conditional required-field rules"
    - "Per-Bundesland data module (STEUERNUMMER_FORMATS) as single source of truth — consumed by both the DE Zod schema and (future) the UI masked input"
    - "Court-whitelist via inline .refine against HANDELSREGISTER_COURTS to prevent arbitrary free-text injection at schema boundary"

key-files:
  created:
    - "packages/validators/src/steuernummer-formats.ts"
    - "packages/validators/src/handelsregister-courts.ts"
    - "packages/validators/src/__tests__/steuernummer-formats.test.ts"
    - "packages/validators/src/__tests__/country-fields.test.ts"
  modified:
    - "packages/validators/src/country-fields.ts"
    - "packages/validators/src/index.ts"

key-decisions:
  - "Added Hessen leading-zero regex (^0\\d{2}...) reflecting Wikipedia's documented Hessen-specific quirk — retained verbatim from RESEARCH Code Example 6"
  - "Handelsregister court picker backed by a typed slug (machine-readable) rather than free-form court name — enables threat T-56-14 mitigation via inline .refine against HANDELSREGISTER_COURTS code set"
  - "Error messages include both the Bundesland germanName AND the example for the Steuernummer format-mismatch case, matching UI-SPEC §Copywriting error states exactly ('Steuernummer format does not match {Bundesland germanName}. Example: {example}.')"
  - "LLP treated as requiring Companies House number (per UI-SPEC §Interaction 1 matrix — LLPs file with Companies House same as Ltds)"
  - "isValidHandelsregister (Plan 03) accepts a single object argument — superRefine passes data.handelsregister directly; matches Plan 03's signature without defensive repacking"

patterns-established:
  - "Forward-declared cross-plan imports within a wave: Plan 04 imports from ./uk-validators and ./de-validators, which are provided by sibling same-wave plans 02/03. Wave merge closes the loop."
  - "Readonly data-module pattern for reference lookups (STEUERNUMMER_FORMATS, HANDELSREGISTER_COURTS) with header comments declaring source + last-verified date + review cadence"

requirements-completed: [FOUND-01, FOUND-02]

duration: 12m
completed: 2026-04-12
---

# Phase 56 Plan 04: UK/DE Country-Fields Zod Schemas & German Reference Data Summary

**Extended countryFieldsSchemaMap with UK + DE discriminated-union Zod schemas enforcing D-04 conditional required-field rules via superRefine, backed by a 16-Bundesland Steuernummer lookup and a 126-court Handelsregister reference list.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-12T18:46:00Z
- **Completed:** 2026-04-12T18:54:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (2 created src modules, 2 created test modules, 2 modified: country-fields.ts + index.ts)

## Accomplishments

- Shipped the canonical per-Bundesland Steuernummer regex/example map verbatim from RESEARCH Code Example 6; every regex self-consistently matches its example both in slash-separated and raw-digit form (verified by 32 self-consistency assertions).
- Shipped `HANDELSREGISTER_COURTS` with 126 Amtsgerichte covering all 16 Bundesländer (BW: 12, BY: 21, BE: 1, BB: 4, HB: 1, HH: 1, HE: 9, MV: 4, NI: 13, NW: 31, RP: 8, SL: 1, SN: 3, ST: 3, SH: 9, TH: 5) — target ≥100; delivered 126. All codes unique, all names prefixed `Amtsgericht `, all slugs lowercase ASCII.
- Extended `ukCountryFieldsSchema` with entity-type-driven D-04 rules. SOLE_TRADER/LTD/LLP + isVatRegistered toggle drive conditional required fields via `.superRefine`; field-level `.refine` surfaces checksum errors (UTR, CH, GB-VAT) before the conditional check.
- Extended `deCountryFieldsSchema` with Steuernummer dispatch (per-Bundesland regex lookup with user-friendly error including `germanName` + `example`), Handelsregister composite (court whitelist + HRB/HRA + 1-7-digit number), USt-IdNr conditional (required when VAT-registered AND not Kleinunternehmer).
- `countryFieldsSchemaMap.GB` / `.DE` dispatch correctly through to respective schemas; `AE` / `SA` references are byte-identical to the Phase 47 baseline (verified by reference-equality test).
- 34 country-fields tests GREEN, 50 steuernummer-formats tests GREEN, 43 de-validators tests GREEN (plan 03 tests previously blocked by missing plan 04 data modules now pass).

## Task Commits

Each task was committed atomically using `git commit --no-verify` (parallel worktree convention):

1. **Task 1 RED: Steuernummer + Handelsregister failing tests** — `9c66d6b` (test)
2. **Task 1 GREEN: Steuernummer formats + Handelsregister courts data modules** — `7384a62` (feat)
3. **Task 2 RED: UK/DE country-fields failing tests** — `42c7b1b` (test)
4. **Task 2 GREEN: UK/DE Zod schemas + D-04 superRefine** — `5d2edba` (feat)

_TDD per `type="auto" tdd="true"`: RED then GREEN for each task._

## Files Created/Modified

- `packages/validators/src/steuernummer-formats.ts` — **NEW.** 16-Bundesland format lookup map with typed `BundeslandCode`, `SteuernummerFormat` interface, `STEUERNUMMER_FORMATS` readonly array, and `getSteuernummerFormat` / `getSteuernummerRegex` helpers. Header cites Wikipedia Steuernummer article + review cadence.
- `packages/validators/src/handelsregister-courts.ts` — **NEW.** 126-entry readonly `HANDELSREGISTER_COURTS` array typed with `HandelsregisterCourt { code, name, state, city }`. Header cites Wikipedia `Liste_deutscher_Registergerichte` + Gemeinsames Registerportal cross-reference + review cadence.
- `packages/validators/src/country-fields.ts` — **MODIFIED.** Added `ukEntityTypeEnum`, `deEntityTypeEnum`, `ukCountryFieldsSchema`, `deCountryFieldsSchema`, `UkCountryFields`, `DeCountryFields`, and internal `handelsregisterSchema`. Extended `countryFieldsSchemaMap` with `GB` + `DE`. Imports forwarded to sibling plan modules (`./uk-validators`, `./de-validators`) and to plan 04's own data modules.
- `packages/validators/src/index.ts` — **MODIFIED.** Re-exports the new types/values: `ukCountryFieldsSchema`, `deCountryFieldsSchema`, entity-type enums, `UkCountryFields`, `DeCountryFields`, `HANDELSREGISTER_COURTS`, `HandelsregisterCourt`, `STEUERNUMMER_FORMATS`, `SteuernummerFormat`, `BundeslandCode`, `getSteuernummerFormat`, `getSteuernummerRegex`.
- `packages/validators/src/__tests__/steuernummer-formats.test.ts` — **NEW.** 50 assertions including 32 self-consistency checks (regex ↔ example) + Handelsregister coverage/uniqueness/slug/16-state.
- `packages/validators/src/__tests__/country-fields.test.ts` — **NEW.** 34 assertions covering every D-04 rule for UK and DE (positive + negative), plus `countryFieldsSchemaMap` dispatch and AE/SA reference-equality invariants.

## UK schema D-04 rule coverage (per entity type)

| Entity type   | UTR rule                     | Companies House rule                  | VAT rule (isVatRegistered=true)          |
| ------------- | ---------------------------- | ------------------------------------- | ---------------------------------------- |
| SOLE_TRADER   | Required (superRefine)       | —                                     | Required (superRefine)                   |
| LTD           | Optional (field-level .refine on checksum when present) | Required (superRefine) | Required (superRefine) |
| LLP           | Optional                     | Required (superRefine)                | Required (superRefine)                   |

Field-level `.refine` catches invalid-checksum values for `utr`, `companiesHouseNumber`, `vatRegistrationNumber` before the superRefine conditional runs (per plan behaviour spec).

## DE schema D-04 rule coverage (per entity type)

| Entity type         | Steuernummer                     | Handelsregister   | USt-IdNr (if VAT+not-Klein)   | SV-Nummer           |
| ------------------- | -------------------------------- | ----------------- | ----------------------------- | ------------------- |
| EINZELUNTERNEHMEN   | Required + Bundesland regex      | —                 | Required                      | Optional            |
| GBR                 | Required + Bundesland regex      | —                 | Required                      | —                   |
| OHG / KG            | Required + Bundesland regex      | Optional          | Required                      | —                   |
| UG / GMBH           | Required + Bundesland regex      | **Required**      | Required                      | —                   |
| AG                  | Required + Bundesland regex      | Optional (not required — only UG/GMBH trigger per D-04 / UI-SPEC §Interaction 1) | Required | — |

Field-level `.refine`: `ustIdNr` (MOD-11-10), `sozialversicherungsnummer` (DRV structural). Composite `handelsregister.court` is constrained to `HANDELSREGISTER_COURTS` slugs (threat T-56-14 mitigation).

## Steuernummer regex/example consistency check

All 16 rows from RESEARCH Code Example 6 copied verbatim. Self-consistency verified:

- `regex.test(example)` → true for all 16 (slash-separated form)
- `regex.test(example.replace(/\//g, ''))` → true for all 16 (raw-digit form)
- NRW regex uniquely shaped (`\d{3}/\d{4}/\d{4}`) and rejects BY-style inputs
- Hessen regex enforces leading zero on the BUFA triplet (`0\d{2}...`) and rejects inputs without it

## Handelsregister court list size + distribution

**Total: 126 courts across all 16 Bundesländer.**

| State | Count | State | Count | State | Count | State | Count |
|-------|-------|-------|-------|-------|-------|-------|-------|
| BW    | 12    | BY    | 21    | BE    | 1     | BB    | 4     |
| HB    | 1     | HH    | 1     | HE    | 9     | MV    | 4     |
| NI    | 13    | NW    | 31    | RP    | 8     | SL    | 1     |
| SN    | 3     | ST    | 3     | SH    | 9     | TH    | 5     |

Distribution reflects Bundesland size + Landgerichtsbezirk structure (single courts for city-states HB/HH/BE/SL; many for NW, BY, NI — mirrors population density).

## Decisions Made

See frontmatter `key-decisions`. Summary:

- Used `isValidHandelsregister` with the single-object signature per Plan 03 (not unpacked positional args — matches the live Plan 03 API).
- LLP treated as CH-required per UI-SPEC §Interaction 1; plan 04 behaviour spec aligns (mandates the error on `['companiesHouseNumber']`).
- Duplicate `Companies House number is required for limited companies` message for LTD and LLP cases — acceptable per plan wording (LLP message is stated in behaviour spec as the same error path; the copy trade-off is acceptable vs. a more specific LLP-distinct string, since UI-SPEC §Copywriting error states does not differentiate).

## Deviations from Plan

None - plan executed exactly as written.

No Rule 1-4 auto-fixes were required. The only cross-plan integration point (`isValidHandelsregister` signature) was discovered to be an object-argument function in Plan 03's live implementation; my superRefine call site was already structured to pass `data.handelsregister` (not unpacked args), so no code change was needed — the plan's action text showed unpacked args as an illustrative pattern, which I deviated from to match the actual Plan 03 signature. Documenting here for traceability, but this is API alignment, not a rule-1 deviation.

## Sources + Next Review Date

- **Steuernummer formats:** https://de.wikipedia.org/wiki/Steuernummer (last verified 2026-04-12). Next review: **2027-04-12** (annual Steuerberater check; Finanzamt reorganisations are rare but possible).
- **Handelsregister courts:** https://de.wikipedia.org/wiki/Liste_deutscher_Registergerichte + https://www.handelsregister.de (Gemeinsames Registerportal cross-reference). Last verified 2026-04-12. Next review: **2027-04-12** (annual; consolidations like the 2009 BW mergers do happen).
- **UI-SPEC copywriting:** `.planning/phases/56-country-foundations-german-i18n/56-UI-SPEC.md` §Copywriting error states (used verbatim for `superRefine` messages).
- **D-04 rules:** `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` §Implementation Decisions (rules copied verbatim).

## Issues Encountered

None. Wave 1 cross-plan integration worked as designed — by the time this worktree ran its final verification, Plans 02 and 03 had landed in the parent branch, so forward-declared imports resolved immediately and the full cross-plan test suite (Plan 03's `de-validators` tests depending on Plan 04's `STEUERNUMMER_FORMATS` + `HANDELSREGISTER_COURTS`) closed GREEN: 34 + 50 + 43 = 127 relevant tests passing.

Pre-existing failures in `packages/validators/src/__tests__/invoice.test.ts` (3 failures) are **out of scope** for plan 56-04 per scope-boundary rule — they were failing before this plan's changes (stash-based pre-image check confirmed the overall count went from 41 failing / 391 passing before plan 04 to 3 failing / 429 passing after, i.e. plan 04 + sibling wave merges fixed 38 failures and introduced none).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `countryFieldsSchemaMap.GB` / `.DE` + `STEUERNUMMER_FORMATS` + `HANDELSREGISTER_COURTS` exposed via `@contractor-ops/validators` barrel — ready for:
  - **Plan 05** (DE i18n): consume `STEUERNUMMER_FORMATS` for localised `germanName` strings in the Bundesland dropdown; translate error-message placeholders for `messages/de.json` under `ContractorProfile.CountryCompliance.DE`.
  - **Plan 06** (UI): bind `countryFieldsSchemaMap.GB` / `.DE` to React Hook Form via `zodResolver`; consume `STEUERNUMMER_FORMATS` for the per-state masked input; consume `HANDELSREGISTER_COURTS` for the court `Combobox`.
  - **Plan 07** (privacy): no direct dependency, but organization's `countryCode` continues to drive privacy-notice jurisdiction via the same pattern.

Wave 1 closes GREEN: Plans 02 + 03 + 04 integrated; `de-validators` tests (previously blocked on plan 04's missing data modules) now pass; `country-fields.test.ts` covers the full D-04 matrix.

## Self-Check: PASSED

Verified via Bash:

- `packages/validators/src/steuernummer-formats.ts` — FOUND
- `packages/validators/src/handelsregister-courts.ts` — FOUND
- `packages/validators/src/country-fields.ts` — FOUND (modified)
- `packages/validators/src/index.ts` — FOUND (modified)
- `packages/validators/src/__tests__/steuernummer-formats.test.ts` — FOUND
- `packages/validators/src/__tests__/country-fields.test.ts` — FOUND

Commit hashes verified in `git log`:

- `9c66d6b` (test RED — Task 1) — FOUND
- `7384a62` (feat GREEN — Task 1) — FOUND
- `42c7b1b` (test RED — Task 2) — FOUND
- `5d2edba` (feat GREEN — Task 2) — FOUND

Build: `pnpm --filter @contractor-ops/validators build` → clean (no TS errors).
Tests: `country-fields` 34/34 · `steuernummer-formats` 50/50 · `de-validators` 43/43 all GREEN.

---
*Phase: 56-country-foundations-german-i18n · Plan 04*
*Completed: 2026-04-12*
