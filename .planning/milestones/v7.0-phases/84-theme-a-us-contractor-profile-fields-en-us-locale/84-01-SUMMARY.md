---
phase: 84-theme-a-us-contractor-profile-fields-en-us-locale
plan: 01
subsystem: api
tags: [zod, validators, ein, ssn, env, aes-256-gcm, us-fields]

# Dependency graph
requires:
  - phase: 84-00
    provides: us-validators.test.ts RED scaffold (Plan 00 Wave-0)
  - phase: 56-uk-de-country-fields
    provides: uk/de-validators + ukCountryFieldsSchema + countryFieldsSchemaMap pattern
provides:
  - isValidEin (XX-XXXXXXX + IRS valid-prefix table) + isValidSsn (format + SSA invalid-range exclusion) pure validators
  - usEntityTypeEnum + usCountryFieldsSchema (entityType + EIN + US address; SSN excluded from JSONB) registered as US in countryFieldsSchemaMap
  - SSN_ENCRYPTION_KEY (hex-32, required) + USPS_CLIENT_ID/SECRET (optional) server-env vars + .env.example dev key
affects:
  - 84-02 (en-US i18n)
  - 84-03 (db + ssn-crypto using SSN_ENCRYPTION_KEY)
  - 84-04 (gov-api USPS client using USPS creds)
  - 84-05 (RHF resolver consuming usCountryFieldsSchema + isValidEin/Ssn)
  - 84-06 (web-vite UsComplianceFields)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure tax-id validators mirror uk/de-validators (anchored regex, whitespace/hyphen-strip, no I/O, run client+server)"
    - "SSN deliberately excluded from countryFields JSONB schema — dedicated encrypted columns + reveal gate land in Plan 03 (T-84-01-01)"
    - "Dedicated SSN_ENCRYPTION_KEY (separate blast radius from bank key); required-in-schema so an unset key fails loud at boot (T-84-01-02)"

key-files:
  created:
    - packages/validators/src/us-validators.ts
  modified:
    - packages/validators/src/country-fields.ts
    - packages/validators/src/index.ts
    - packages/validators/src/env.ts
    - packages/validators/src/minimal-server-env.ts
    - packages/validators/src/__tests__/country-fields.test.ts
    - .env.example

key-decisions:
  - "US entity-type enum = SOLE_PROPRIETOR/LLC/C_CORP/S_CORP/PARTNERSHIP/INDIVIDUAL (UPPER_SNAKE, per 84-RESEARCH §359 + UI-SPEC §A)"
  - "EIN required (superRefine) for LLC/C_CORP/S_CORP/PARTNERSHIP; optional for INDIVIDUAL/SOLE_PROPRIETOR (84-RESEARCH Open Question 3)"
  - "SSN_ENCRYPTION_KEY is a NEW separate hex-32 key, not a reuse of BANK_ACCOUNT_ENCRYPTION_KEY (D-01 blast-radius separation)"
  - "USPS creds optional (LOCAL-ONLY has none; client fails-open in Plan 04)"
  - "IRS prefix table + SSA range rules annotated LOCAL-ONLY / legal-tax-adviser-deferred"

patterns-established:
  - "us-validators.ts: anchored ^...$ regex on whitespace-stripped input (ReDoS-safe, mirror uk T-56-03)"
  - "usCountryFieldsSchema: field-level isValidEin .refine + conditional superRefine, state z.string().length(2)"

requirements-completed: [US-FIELD-01, US-FIELD-02]

# Metrics
duration: 5min
completed: 2026-06-08
---

# Phase 84 Plan 01: US Field Validators + Schema + Env Summary

**`isValidEin` (XX-XXXXXXX + IRS valid-prefix table) and `isValidSsn` (format + SSA invalid-range exclusion) pure validators, the `usCountryFieldsSchema` (entityType + EIN + US address, SSN excluded) registered as `US` in `countryFieldsSchemaMap`, and a dedicated required `SSN_ENCRYPTION_KEY` plus optional USPS creds across both env schemas + `.env.example`.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-08T13:42:48Z
- **Completed:** 2026-06-08T13:47:19Z
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- `us-validators.ts`: `isValidEin` (2-digit IRS campus prefix set + `^(\d{2})-?(\d{7})$`) and `isValidSsn` (`^(\d{3})(\d{2})(\d{4})$` + reject area 000/666/900-999, group 00, serial 0000); both pure, anchored, whitespace/hyphen-tolerant; re-exported from `index.ts`. Plan 00 `us-validators.test.ts` now GREEN (22/22).
- `usEntityTypeEnum` + `usCountryFieldsSchema` with field-level EIN `.refine(isValidEin)` and a `superRefine` requiring EIN for LLC/C_CORP/S_CORP/PARTNERSHIP; `state` constrained to `.length(2)`; SSN deliberately absent from the JSONB shape. Registered as `US` in `countryFieldsSchemaMap`; schema/type/enum exported from `index.ts`.
- Env: required `SSN_ENCRYPTION_KEY: hex32` (+ merged into `serverEnvSchema`) and optional `USPS_CLIENT_ID`/`USPS_CLIENT_SECRET` in `env.ts`; `SSN_ENCRYPTION_KEY: HEX32` in `minimal-server-env.ts`; `.env.example` gets the keys with a generated dev hex-32 value so the API boots.
- `country-fields.test.ts` extended with US vectors (map registration, enum, EIN-required conditional, optional-for-individual, invalid EIN, state-length, SSN-stripped-absent, unknown entityType). Full validators suite 71/71 GREEN; package typecheck clean.

## Task Commits

Each task was committed atomically (TDD: Plan 00 was the RED commit; both tasks here are GREEN):

1. **Task 1: us-validators.ts (isValidEin + isValidSsn)** - `7880d307` (feat)
2. **Task 2: usCountryFieldsSchema + env keys** - `53abdf1f` (feat)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified
- `packages/validators/src/us-validators.ts` - NEW; `isValidEin` + `isValidSsn` pure validators with legal-deferred IRS/SSA annotations
- `packages/validators/src/country-fields.ts` - `usEntityTypeEnum` + `usCountryFieldsSchema` + `US` map entry; imports `isValidEin`
- `packages/validators/src/index.ts` - re-export `isValidEin`/`isValidSsn`, `usCountryFieldsSchema`, `UsCountryFields`, `usEntityTypeEnum`
- `packages/validators/src/env.ts` - `usFieldsSchema` (SSN_ENCRYPTION_KEY hex32 + optional USPS creds) merged into `serverEnvSchema`
- `packages/validators/src/minimal-server-env.ts` - `SSN_ENCRYPTION_KEY: HEX32` so `getServerEnv()` resolves in tests
- `packages/validators/src/__tests__/country-fields.test.ts` - US parse vectors (extend, not recreate)
- `.env.example` - SSN_ENCRYPTION_KEY (dev hex-32) + USPS_CLIENT_ID/SECRET placeholders

## Decisions Made
- Followed the plan as specified. US enum and EIN-vs-entity-type conditional confirmed against 84-RESEARCH (§359 + Open Question 3) and UI-SPEC §A field list; no UI-SPEC override needed.

## Deviations from Plan

None - plan executed exactly as written.

The plan listed `files_modified` for both tasks; all were edited as specified. No bugs, missing-critical, or blocking issues triggered Rules 1-3, and no architectural changes triggered Rule 4. No new dependencies were installed (zod already in tree), so the package-legitimacy checkpoint did not apply.

## Issues Encountered
- `pnpm check:no-process-env` reports failures, but all are **pre-existing** raw `process.env` usages in unrelated app files (`apps/landing`, `apps/cron-worker`, `apps/public-api`, etc.). Confirmed none of this plan's touched files (`env.ts`, `minimal-server-env.ts`, `country-fields.ts`) appear in the guard output — my env additions go through the Zod `serverEnvSchema`, not raw `process.env`. Out of scope for this plan (SCOPE BOUNDARY); not fixed.
- Biome (lint-staged pre-commit) reformatted the EIN prefix `Set` and a test enum array to one-element-per-line / single-line — cosmetic, tests stayed green.

## Known Stubs
None. USPS creds are intentionally optional/empty (LOCAL-ONLY; client lands in Plan 04 and fails-open), documented as such in `.env.example` and the plan — not a stub blocking this plan's goal.

## User Setup Required
None for local dev — `.env.example` ships a throwaway dev `SSN_ENCRYPTION_KEY`. For production, operators must generate their own key (`openssl rand -hex 32`) and supply real USPS creds (Plan 04 onward) via the secret store.

## Next Phase Readiness
- `usCountryFieldsSchema` + `isValidEin`/`isValidSsn` are exported and ready for the tRPC input + RHF resolver (Plan 05) and the web-vite component (Plan 06).
- `SSN_ENCRYPTION_KEY` exists in both env schemas, so Plan 03's `ssn-crypto.ts` (`getServerEnv().SSN_ENCRYPTION_KEY`) and the SSN write path will not throw on an unset key.
- IRS-prefix / SSA-range tables remain legal/tax-adviser-deferred (annotated in `us-validators.ts`); non-blocking for downstream plans.

## Self-Check: PASSED

- All 8 created/modified files exist on disk.
- Both task commits present in git log (`7880d307`, `53abdf1f`).
- `US: usCountryFieldsSchema` registered in `countryFieldsSchemaMap`; `SSN_ENCRYPTION_KEY` present in `env.ts`.
- Validators suite GREEN: `us-validators.test.ts` 22/22, `country-fields.test.ts` 49/49 (71 total); package typecheck clean.

---
*Phase: 84-theme-a-us-contractor-profile-fields-en-us-locale*
*Completed: 2026-06-08*
