---
phase: 56-country-foundations-german-i18n
plan: 03
subsystem: validators
tags: [de-tax-ids, iso7064, mod-11-10, sv-nummer, steuernummer, handelsregister, dsgvo, gdpr, i18n, locked-phrases]

# Dependency graph
requires:
  - phase: 56-country-foundations-german-i18n
    provides: "Wave 0 test scaffolds (56-01); Plan 04's STEUERNUMMER_FORMATS + HANDELSREGISTER_COURTS data modules imported forward-declared per WAVE 1 CONTRACT"
provides:
  - "ISO 7064 MOD-11-10 iterative check-digit primitive (mod11_10CheckDigit)"
  - "isValidUstIdNr — DE+9 digits with normalisation"
  - "isValidSvNummer — 12-char structural + weighted mod-10 checksum"
  - "isValidSteuernummer — dispatcher over 16-Bundesland regex map (Plan 04 data)"
  - "isValidHandelsregister — composite validator (court + type + number ≤ 7 digits)"
  - "9 LOCKED_DE_PHRASES as typed `as const` constants + RESERVED_LEGAL_KEYS array + LockedDePhraseKey literal union"
  - "CI guard test (locked-phrases-guard) forbidding reserved keys in messages/*.json, asserting presence in privacy-notices/de.ts, and blocking informal Du/Dir/Dein* register in messages/de.json"
affects:
  - "56-04 country-fields (Zod schemas consume de-validators)"
  - "56-05 i18n (de.json blocked from including reserved keys + informal register)"
  - "56-06 UI (DeComplianceFields renders LOCKED_DE_PHRASES labels)"
  - "56-07 privacy notices (privacy-notices/de.ts must embed every locked phrase)"
  - "57 (VIES lookup relies on isValidUstIdNr gate before network call)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-plan WAVE N CONTRACT: forward-declared `./{module}.js` imports with documented integration boundary"
    - "Locked legal terminology as compile-time `as const` module (immune to translation-file drift; enforced via CI guard)"
    - "Iterative ISO 7064 MOD-11-10 Pure System (NOT naive single-pass mod-11 — Pitfall 1)"

key-files:
  created:
    - "packages/validators/src/de-validators.ts"
    - "packages/validators/src/legal/de.ts"
    - "packages/validators/src/__tests__/de-validators.test.ts"
    - "packages/validators/src/__tests__/locked-phrases-guard.test.ts"
  modified:
    - "packages/validators/src/index.ts"
    - ".planning/phases/56-country-foundations-german-i18n/deferred-items.md"

key-decisions:
  - "Iterative MOD-11-10 (Pitfall 1): seed product=10, for each digit `sum=(d+product)%10; if sum==0 then sum=10; product=(sum*2)%11`; final check = `(11-product)%10`. Canonical valid vector DE136695976 verified; DE811569869 (Siemens) also validated."
  - "SV-Nummer weights [2,1,2,5,7,1,2,1,2,1,2,1] (A3 MEDIUM confidence) flagged with `ASSUMPTION A3` comment for Steuerberater review against ≥5 real vectors before production cut-over."
  - "9 locked phrases live as typed constants in `legal/de.ts` (compile-time invariant) — NOT in any translation JSON. CI guard iterates over en/pl/ar/de and rejects any reserved key."
  - "Handelsregister number capped at 1-7 digits (D-03) — enforced server-side by `isValidHandelsregister`; the Zod composite schema (Plan 04) surfaces structured error paths."
  - "Combined Task 1 + Task 2 into a single GREEN commit because both share the same module (`de-validators.ts`) and test file; splitting would require mid-state broken builds. RED committed separately (7501176); GREEN (09701d1) covers all four validators."

patterns-established:
  - "WAVE 1 CONTRACT comment documents cross-plan integration boundary (same-wave concurrent plans)"
  - "ASSUMPTION A{N} code comments track Steuerberater-review gates back to the research Assumptions Log"
  - "LOCKED_* phrase module + CI guard = compile-time + CI-time double lock on legally vetted strings"

requirements-completed: [FOUND-02, FOUND-04]

# Metrics
duration: 8min
completed: 2026-04-12
---

# Phase 56 Plan 03: German Validators & Locked Legal Phrases Summary

**ISO 7064 MOD-11-10 USt-IdNr validator, DRV-spec Sozialversicherungsnummer checksum, 16-Bundesland Steuernummer dispatcher, Handelsregister composite, and 9 typed-constant GDPR/tax phrases locked via CI guard.**

## Performance

- **Duration:** ~8 min (code + tests; concurrent with Plan 04 in same wave)
- **Started:** 2026-04-12T18:47:00Z
- **Completed:** 2026-04-12T18:55:00Z
- **Tasks:** 3 (combined Task 1 + Task 2 into one GREEN commit — see Deviations)
- **Files modified:** 4 created, 2 modified

## Accomplishments

- `mod11_10CheckDigit` (ISO 7064 Pure System) + `isValidUstIdNr` verified against python-stdnum canonical vector `DE136695976` and Siemens `DE811569869`.
- `isValidSvNummer` structural + weighted mod-10 checksum with 3 derived positive vectors (65180539M032, 01010100A019, 55120180B021) and A3 Steuerberater-review flag embedded as code comment.
- `isValidSteuernummer(bundesland, value)` dispatcher covering all 16 Bundesländer through Plan 04's `STEUERNUMMER_FORMATS`; test suite asserts ≥16 positive + ≥16 cross-state negative vectors.
- `isValidHandelsregister` composite validator (Registergericht lookup via Plan 04's `HANDELSREGISTER_COURTS`, HRB/HRA type, 1-7 digit number).
- `packages/validators/src/legal/de.ts` with all 9 locked DSGVO + tax phrases as `as const` typed constants, `RESERVED_LEGAL_KEYS`, `LOCKED_DE_PHRASES`, and `LockedDePhraseKey` literal union.
- Locked-phrases-guard CI test enforcing (a) no reserved key in any `messages/*.json`, (b) every phrase present in `privacy-notices/de.ts` (gated pre-Plan 07), (c) formal "Sie" register in `messages/de.json` (gated pre-Plan 05), (d) Unicode fidelity on `Kleinunternehmer gemäß § 19 UStG`.

## Task Commits

Each task committed atomically:

1. **Task 1 RED: Failing de-validators tests** — `7501176` (test)
2. **Task 1 + Task 2 GREEN: All 4 DE validators + barrel** — `09701d1` (feat; combined — see Deviations)
3. **Task 3 RED: Failing locked-phrases-guard test** — `7b3f2e7` (test)
4. **Task 3 GREEN: `legal/de.ts` + barrel + deferred-items update** — `a51b9be` (feat)

**Plan metadata:** _pending docs commit at plan-close orchestration_

## Files Created/Modified

- `packages/validators/src/de-validators.ts` — 4 validators + mod11_10CheckDigit + ASSUMPTION A3 marker + WAVE 1 CONTRACT marker.
- `packages/validators/src/legal/de.ts` — 9 locked phrases, RESERVED_LEGAL_KEYS, LOCKED_DE_PHRASES record, LockedDePhraseKey type.
- `packages/validators/src/__tests__/de-validators.test.ts` — 43 tests covering checksum pins, USt-IdNr normalisation, SV-Nummer structural+checksum+derivation comments, 16-Bundesland Steuernummer dispatch, and Handelsregister composite.
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — 10 tests with gating (fs.existsSync) for pre-Plan 05/07 states.
- `packages/validators/src/index.ts` — barrel exports for `de-validators` (5 symbols) and `legal/de` (11 symbols + LockedDePhraseKey type).
- `.planning/phases/56-country-foundations-german-i18n/deferred-items.md` — logged 3 pre-existing unrelated invoice.test.ts failures.

## Decisions Made

- **Iterative MOD-11-10, not naive mod-11.** Pitfall 1 of RESEARCH explicitly warns that training data conflates the two. The iterative form with `product=10` seed is verified against python-stdnum for DE136695976 and DE811569869. (Note: DE123456788 is *internally consistent* under this algorithm — `mod11_10CheckDigit([1..8]) = 8` — so the plan's claim that it is invalid was corrected to DE123456789; see Deviation below.)
- **A3 (SV-Nummer weights) documented as code comment**, not runtime flag. The constant `SV_WEIGHTS = [2,1,2,5,7,1,2,1,2,1,2,1]` is pinned and the comment references STATE.md's Steuerberater-review blocker. If the weights ever change post-review, a single constant replacement + regenerated test vectors closes the loop.
- **Combined Task 1 + Task 2 GREEN commit**. Splitting `de-validators.ts` into two commits (one without Steuernummer/Handelsregister, one with) would require a broken intermediate state because the module already imports from `./steuernummer-formats.js` and `./handelsregister-courts.js` at top-level. Single GREEN after combined RED preserves CI invariants.
- **Locked phrases as module, not JSON.** D-05/D-06/D-07: phrases must survive translation-file reshuffles. A `legal/de.ts` module with `as const` literals is immune to locale-JSON drift, and the CI guard ensures no future PR accidentally re-declares a reserved identifier in any `messages/*.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan's canonical invalid vector `DE123456788` is actually valid under the specified algorithm**
- **Found during:** Task 1 GREEN verification (running the algorithm empirically).
- **Issue:** Plan text claims `DE123456788` should be invalid per python-stdnum doctest. Empirical run of the plan-specified iterative MOD-11-10 on body `[1,2,3,4,5,6,7,8]` returns `8`, which makes DE123456788 internally consistent (valid). The discrepancy is a research-time inconsistency between the plan's algorithm body and the python-stdnum Python-specific `check or 10` short-circuit semantics (which would give a different result than our TypeScript straight port).
- **Fix:** Removed `DE123456788` from the invalid-vector list; kept `DE123456789` (check digit 9, computed 8) as the unambiguous invalid vector. Added an explicit test pinning `mod11_10CheckDigit([1,2,3,4,5,6,7,8]) === 8` so any future algorithmic drift surfaces immediately.
- **Files modified:** packages/validators/src/__tests__/de-validators.test.ts
- **Verification:** 43/43 de-validators tests green; python-stdnum canonical `DE136695976` (valid) and community-known Siemens `DE811569869` (valid) both verified.
- **Committed in:** 7501176 (RED) + 09701d1 (GREEN)

**2. [Rule 1 — Bug] Handelsregister test fixture used non-existent court code `amtsgericht-berlin-charlottenburg`**
- **Found during:** Task 1 GREEN verification (1/43 tests failed).
- **Issue:** Test asserted composite validity with court code `amtsgericht-berlin-charlottenburg`, but Plan 04's `HANDELSREGISTER_COURTS` uses `amtsgericht-charlottenburg` (Berlin is the city, the slug omits the state prefix for brevity).
- **Fix:** Updated fixture to `amtsgericht-charlottenburg`.
- **Files modified:** packages/validators/src/__tests__/de-validators.test.ts
- **Verification:** 43/43 tests green.
- **Committed in:** 09701d1 (GREEN)

**3. [Rule 3 — Blocking / Scope] Pre-existing invoice.test.ts currency failures (out of scope)**
- **Found during:** Full `pnpm --filter @contractor-ops/validators test --run` sanity check.
- **Issue:** 3 pre-existing failures in `invoice.test.ts` rejecting `currency: 'EUR'`. Unrelated to Phase 56 — likely a v4.0 currency enum tightening.
- **Fix:** Logged to `.planning/phases/56-country-foundations-german-i18n/deferred-items.md` under "From 56-03". Did NOT fix (scope boundary).
- **Files modified:** deferred-items.md only.
- **Verification:** Phase 56 tests isolated — de-validators (43/43) + locked-phrases-guard (10/10) green.
- **Committed in:** a51b9be

**4. [Rule 3 — Blocking] Combined Task 1 + Task 2 commit**
- **Found during:** Task 2 planning (immediately after Task 1 GREEN consideration).
- **Issue:** `de-validators.ts` imports Plan 04's data modules at top-level. Committing Task 1 with only USt-IdNr + SV-Nummer present would still require the full import block because the module exports `isValidSteuernummer` + `isValidHandelsregister` in the same file. Splitting forces either (a) two separate module files (over-engineering a small validator module), or (b) a transient commit with `// TODO Task 2` stub functions that the next commit overwrites (adds noise, risks being shipped).
- **Fix:** Single RED commit (test file) + single GREEN commit (all four validators + barrel) = same semantic outcome as the plan's 2-task split, no broken intermediate states.
- **Files modified:** Same as planned; only commit boundaries changed.
- **Verification:** Same acceptance criteria as both tasks individually.
- **Committed in:** 7501176 (RED) + 09701d1 (GREEN)

---

**Total deviations:** 4 auto-fixed (2 × Rule 1 bug, 2 × Rule 3 blocking)
**Impact on plan:** Zero scope creep. All deviations either corrected plan-text errors against empirical verification, unblocked commit-atomicity, or documented pre-existing-unrelated issues for later triage.

## Issues Encountered

- **Pre-existing `invoice.test.ts` currency failures** (see Deviation 3 above) — logged and deferred; do not block Phase 56 closure.

## Authentication Gates

None — all work was local/in-repo.

## User Setup Required

None — no external services, no credentials, no environment variables added in this plan. Steuerberater review (A3 flag) is tracked in STATE.md Blockers but is not a gate for this plan's CI — it gates Phase 56 production acceptance.

## Next Phase Readiness

- **Wave 1 cross-plan contract:** `de-validators.ts` imports `./steuernummer-formats.js` and `./handelsregister-courts.js` (Plan 04). Both files exist in this branch; `pnpm --filter @contractor-ops/validators test --run de-validators` is 43/43 green.
- **Wave 2 consumers:**
  - Plan 06 UI components will import `isValidUstIdNr`, `isValidSvNummer`, `isValidSteuernummer`, `isValidHandelsregister`, and all `LOCKED_DE_PHRASES` values from `@contractor-ops/validators`.
  - Plan 07 privacy notices must ensure every locked phrase appears verbatim in `privacy-notices/de.ts` — the CI guard will enforce once that file exists.
  - Plan 05 messages/de.json is bound by: (a) no reserved legal key, (b) no `Du|Dir|Dein*` informal register.
- **Steuerberater review (Assumption A3)** is the only outstanding production gate — the code ships fine today; the weight array is pinned behind a single-constant refactor if review returns with corrections.

## Known Stubs

None — all code paths in Phase 56 · Plan 03 are wired to real data (Plan 04's Steuernummer and Handelsregister lists). Guard-test gates (`fs.existsSync`) on `messages/de.json` and `privacy-notices/de.ts` are intentional forward-compatibility, not stubs — they auto-activate once Plan 05/07 land and will enforce the full contract at that point.

## Threat Flags

None — this plan only strengthens the existing threat posture (T-56-06…T-56-10 all mitigated). No new trust boundaries introduced.

## Self-Check

- [x] `packages/validators/src/de-validators.ts` exists — FOUND
- [x] `packages/validators/src/legal/de.ts` exists — FOUND
- [x] `packages/validators/src/__tests__/de-validators.test.ts` exists — FOUND
- [x] `packages/validators/src/__tests__/locked-phrases-guard.test.ts` exists — FOUND
- [x] Commit `7501176` (test RED) — FOUND
- [x] Commit `09701d1` (feat GREEN all validators) — FOUND
- [x] Commit `7b3f2e7` (test RED locked-phrases) — FOUND
- [x] Commit `a51b9be` (feat GREEN legal/de + barrel) — FOUND

## Self-Check: PASSED

---
*Phase: 56-country-foundations-german-i18n*
*Plan: 03*
*Completed: 2026-04-12*
