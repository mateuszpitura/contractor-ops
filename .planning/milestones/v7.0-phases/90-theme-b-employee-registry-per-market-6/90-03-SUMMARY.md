---
phase: 90-theme-b-employee-registry-per-market-6
plan: 03
subsystem: validators
tags: [validators, country-fields, zod, strict, pesel, ssn, iqama, emirates-id, aes-256-gcm, pii-crypto, env-schema, p89-independent]

# Dependency graph
requires:
  - phase: 90-02
    provides: the 8 greenfield statutory validators (isValidSteuerIdNr/isValidNiNumber/isValidUkTaxCode/isValidGosi/isValidWpsEstablishmentId) + reference-list enums (lohnsteuerklasse/nfzOddzial/studentLoanPlan/w4FilingStatus/usWithholdingState) the per-country schemas consume
  - phase: 90-01
    provides: the RED country-fields dispatch/no-PII scaffold + the RED employee-pii-crypto round-trip/random-IV scaffold this plan turns GREEN
  - phase: 84-us-profile-fields
    provides: the ssn-crypto AES-256-GCM iv:authTag:ciphertext idiom + SSN_ENCRYPTION_KEY env block mirrored for the dedicated employee key
provides:
  - employeeCountryFieldsSchemaMap (PL/DE/GB/US/AE/SA, each .strict()) + validateEmployeeCountryFields dispatch — a parallel registry to the contractor map, not a fork
  - per-country z.infer types (Pl/De/Uk/Us/Ae/Sa EmployeeCountryFields) for the later UI props
  - field-agnostic employee-pii-crypto (encryptPii/decryptPii/maskLast4) keyed by a dedicated EMPLOYEE_PII_ENCRYPTION_KEY
  - EMPLOYEE_PII_ENCRYPTION_KEY (hex32, required-in-schema) in the validators server env schema + minimal-server-env + .env.example
affects: [90-04-employee-prisma-schema, 90-05-employee-registry-router, 90-06-employee-registration-ui, 94-payroll-adapters, 97-hr-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Employee country-fields registry MIRRORS the contractor countryFieldsSchemaMap dispatch idiom in a parallel map — the contractor exports stay byte-identical (no fork)"
    - "Every per-country employee schema is .strict() so any national-ID key (pesel/ssn/iqama/emiratesId) is a parse error and can never round-trip into the wholesale countryFields JSON read"
    - "Dedicated EMPLOYEE_PII_ENCRYPTION_KEY gives PESEL/Iqama/Emirates-ID an independent blast radius; the US SSN column keeps ssn-crypto + SSN_ENCRYPTION_KEY unchanged"

key-files:
  created:
    - packages/validators/src/employee-country-fields.ts
    - packages/api/src/services/employee-pii-crypto.ts
  modified:
    - packages/validators/src/index.ts
    - packages/validators/src/env.ts
    - packages/validators/src/minimal-server-env.ts
    - .env.example

key-decisions:
  - "SA `saudizationCategory` uses a coarse Nitaqat colour band enum (PLATINUM/GREEN/YELLOW/RED) to satisfy the Plan-01 `GREEN` test vector, distinct from the fine SAUDIZATION_CATEGORY band (PLATINUM/HIGH_GREEN/MID_GREEN/LOW_GREEN/YELLOW/RED) reused by the promoted typed column — the JSON field carries the coarse band, the promoted column the fine one"
  - "isValidSvNummer is imported from de-validators.js (its real export site), not employee-validators.js — the plan interface listed it as a package REUSE"
  - "EMPLOYEE_PII_ENCRYPTION_KEY added as its own employeePiiEncryptionSchema block merged into serverEnvSchema, mirroring the SSN_ENCRYPTION_KEY usFieldsSchema block; required-in-schema so an unset key fails loud at boot"

patterns-established:
  - "Parallel-not-fork country-fields registry: a sibling employeeCountryFieldsSchemaMap leaving the contractor map untouched"
  - "Field-agnostic PII crypto on a dedicated per-data-class key, copying the audited ssn-crypto cipher idiom verbatim with only the key source changed"

requirements-completed: []  # intentionally empty — phase is partial; EMP-REG-* HELD on P89 (schema/router/UI not yet delivered)

# Metrics
duration: 4min
completed: 2026-06-22
---

# Phase 90 Plan 03: Employee Country-Fields Registry + Dedicated PII Crypto Summary

**A parallel `employeeCountryFieldsSchemaMap` (PL/DE/GB/US/AE/SA, every schema `.strict()` so no national-ID key can enter the JSON) consuming the Plan-02 statutory validators, plus a field-agnostic `employee-pii-crypto` (AES-256-GCM `iv:authTag:ciphertext`, random IV) keyed by a new dedicated `EMPLOYEE_PII_ENCRYPTION_KEY` — turning the two P89-independent Plan-01 RED scaffolds GREEN while the contractor registry and `ssn-crypto` stay byte-identical.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-21T23:38:26Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 4

## Accomplishments
- Built `employee-country-fields.ts`: six `.strict()` per-country Zod schemas (PL `stanowisko` required + ZUS/urząd/NFZ refs; DE Steuer-IdNr/SV-Nummer/Lohnsteuerklasse/Krankenkasse; GB tax-code/NI/student-loan/PAYE; US W-4 filing-status + state-withholding with `stateOther` refine; AE visa-type + WPS; SA coarse Nitaqat band + GOSI), the parallel `employeeCountryFieldsSchemaMap`, the `validateEmployeeCountryFields(cc, fields)` dispatch (`if (!schema) return {}`), and the six `z.infer` types — barrel-exported from `index.ts`.
- Locked the PII boundary: every schema is `.strict()`, so the no-PII test (`pesel/ssn/iqama/emiratesId` payloads) is rejected at parse — no national-ID key ever reaches the wholesale `countryFields` JSON read.
- Built `employee-pii-crypto.ts`: `encryptPii`/`decryptPii`/`maskLast4` copying the audited `ssn-crypto` AES-256-GCM idiom verbatim (`ALGORITHM`, `IV_LENGTH=12`, `iv:authTag:ciphertext`, random IV) with the only change being the key source — the dedicated `EMPLOYEE_PII_ENCRYPTION_KEY`.
- Added `EMPLOYEE_PII_ENCRYPTION_KEY` (hex32, required-in-schema) as its own `employeePiiEncryptionSchema` block in `env.ts`, to `minimal-server-env.ts`, and to `.env.example` with a breadcrumb-free rationale comment (PESEL/Iqama/Emirates-ID use it; SSN keeps `SSN_ENCRYPTION_KEY`).
- Verified the parallel-not-fork invariant: `git diff HEAD~2` shows zero changes to the contractor `country-fields.ts` and to `ssn-crypto.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Parallel employee country-fields registry (Plan-01 country-fields RED → GREEN)** - `1e8eaabe6` (feat)
2. **Task 2: Dedicated employee PII crypto util + EMPLOYEE_PII_ENCRYPTION_KEY (Plan-01 crypto RED → GREEN)** - `a42ab6794` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `packages/validators/src/employee-country-fields.ts` - Six `.strict()` per-country schemas + `employeeCountryFieldsSchemaMap` + `validateEmployeeCountryFields` + per-country `z.infer` types; reuses the Plan-02 validators and reference-list enums.
- `packages/api/src/services/employee-pii-crypto.ts` - Field-agnostic `encryptPii`/`decryptPii`/`maskLast4` on the dedicated `EMPLOYEE_PII_ENCRYPTION_KEY`.
- `packages/validators/src/index.ts` - Barrel re-exports for the new schemas, map, dispatch, enums, and types.
- `packages/validators/src/env.ts` - New `employeePiiEncryptionSchema` (`EMPLOYEE_PII_ENCRYPTION_KEY: hex32`) merged into `serverEnvSchema`.
- `packages/validators/src/minimal-server-env.ts` - `EMPLOYEE_PII_ENCRYPTION_KEY: HEX32` so `getServerEnv()`-at-import modules load in tests.
- `.env.example` - `EMPLOYEE_PII_ENCRYPTION_KEY=` placeholder with a `openssl rand -hex 32` + blast-radius note.

## Decisions Made
- SA `saudizationCategory` JSON field uses a coarse 4-value Nitaqat band (`PLATINUM/GREEN/YELLOW/RED`) — the Plan-01 minimal-valid vector is `'GREEN'`, which the fine `SAUDIZATION_CATEGORY` (`HIGH_GREEN/MID_GREEN/LOW_GREEN`) does not contain. The fine band remains the reference enum for the later promoted typed column; the coarse band is the user-facing JSON value.
- Kept the AE `aeVisaTypeEnum` and SA `saudizationBandEnum` local to the country-fields module (only consumed by these schemas + their `z.infer` UI props), exported via the barrel for the later UI selects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the `isValidSvNummer` import source**
- **Found during:** Task 1 (validators typecheck gate)
- **Issue:** The first draft imported `isValidSvNummer` from `./employee-validators.js`, but that symbol is exported from `./de-validators.js` (the plan interface listed it under the package REUSE set, not the new module). `tsc` flagged `TS2724: has no exported member named 'isValidSvNummer'`.
- **Fix:** Moved `isValidSvNummer` to a dedicated `import { isValidSvNummer } from './de-validators.js'`.
- **Files modified:** packages/validators/src/employee-country-fields.ts
- **Verification:** `pnpm typecheck --filter=@contractor-ops/validators` clean; country-fields test 13/13.
- **Committed in:** `1e8eaabe6` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — wrong import source).
**Impact on plan:** Import-path correction only; the validator reused is the audited one named in the plan interface. No scope change.

## Issues Encountered
None beyond the import fix above. The validators env-type change required no api-side change (the api typecheck rebuilt validators transitively and stayed clean).

## Verification
- `pnpm --filter @contractor-ops/validators exec vitest run src/__tests__/employee-country-fields.test.ts` → 13/13 GREEN (Plan-01 RED → GREEN).
- `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/employee-pii-crypto.test.ts` → 5/5 GREEN, including the random-IV (two encrypts differ) assertion.
- `pnpm --filter @contractor-ops/validators exec vitest run employee-country-fields employee-validators` → 49/49 (no regression in the Plan-02 validator suite).
- `pnpm typecheck --filter=@contractor-ops/validators --filter=@contractor-ops/api` → clean.
- `pnpm check:no-process-env` → OK (182, baseline 182 — no new raw process.env).
- `pnpm lint:no-breadcrumbs` → OK.
- `git diff HEAD~2 -- packages/validators/src/country-fields.ts packages/api/src/services/ssn-crypto.ts` → empty (contractor registry + ssn-crypto UNTOUCHED).

## Known Stubs
None. The PL/DE/GB/US/AE/SA schemas are fully wired to the audited validators + reference enums. The GOSI/WPS refinements are intentionally lenient adviser-verify (inherited from Plan-02, no authoritative public checksum spec) — documented design intent, not unfinished work.

## Next Phase Readiness
- The country-fields registry + dedicated crypto boundary are GREEN and barrel-exported — Plan 04 (Prisma `EmployeeProfile`) and Plan 05 (registry router) wire pre-tested pieces: `validateEmployeeCountryFields` for the JSON column, `encryptPii`/`maskLast4` for the dedicated national-ID columns, `decryptPii` for the reveal procedure.
- P89-INDEPENDENT: no Employee/Worker model, router, RBAC, or flag was touched. The P89-gated waves (90-04/05/06) remain HELD until Phase 89 lands the Employee model + `employee` resource + 4 HR roles + `module.workforce-employees` flag.
- REQUIREMENTS.md EMP-REG-* checkboxes intentionally left unchecked — satisfied only when the full phase (schema + router + UI) delivers and passes verify-work.
- Deployment note: `EMPLOYEE_PII_ENCRYPTION_KEY` must be set in every environment before the employee national-ID write path ships (required-in-schema — boot fails loud if unset).

## Self-Check: PASSED

- FOUND: packages/validators/src/employee-country-fields.ts
- FOUND: packages/api/src/services/employee-pii-crypto.ts
- FOUND: packages/validators/src/index.ts (modified — barrel exports)
- FOUND: packages/validators/src/env.ts (modified — EMPLOYEE_PII_ENCRYPTION_KEY)
- FOUND: packages/validators/src/minimal-server-env.ts (modified)
- FOUND: .env.example (modified)
- FOUND commit: 1e8eaabe6 (Task 1, feat)
- FOUND commit: a42ab6794 (Task 2, feat)

---
*Phase: 90-theme-b-employee-registry-per-market-6*
*Completed: 2026-06-22*
