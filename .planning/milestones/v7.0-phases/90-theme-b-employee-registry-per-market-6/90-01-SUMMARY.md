---
phase: 90-theme-b-employee-registry-per-market-6
plan: 01
subsystem: testing
tags: [vitest, validators, pesel, steuer-idnr, ni-number, emirates-id, saudi-id, aes-256-gcm, tenant-isolation, rbac, tdd-red]

# Dependency graph
requires:
  - phase: 84-us-profile-fields
    provides: ssn-crypto AES-256-GCM iv:authTag:ciphertext idiom + contractorPii reveal RBAC+audit pattern reused as the employee analog
provides:
  - RED unit scaffold pinning canonical valid+invalid vectors for PESEL, Steuer-IdNr, NI number, UK tax code, Saudi ID (1|2|false), Emirates ID (format-strict / checksum-advisory), GOSI, WPS Establishment ID
  - RED dispatch + required-field + no-national-ID-key-in-JSON scaffold for employeeCountryFieldsSchemaMap
  - RED round-trip + random-IV + last4 scaffold for employee-pii-crypto (P89-independent)
  - describe.skip HOLD-until-P89 scaffolds pinning the EmployeeProfile cross-org-leak invariant and the register-omit-encrypted + revealPii RBAC/audit contracts
affects: [90-employee-validators-impl, 90-employee-country-fields-impl, 90-employee-pii-crypto-impl, 90-employee-registry-router, 90-employee-prisma-schema, phase-89-worker-model]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 RED-now scaffolds (P89-independent) live alongside describe.skip HOLD-until-P89 scaffolds so CI stays green while still pinning the gated contracts"
    - "Emirates-ID validator pinned as a structured { formatValid, checksumValid } result so the checksum stays advisory and can never hard-reject a format-valid ID"

key-files:
  created:
    - packages/validators/src/__tests__/employee-validators.test.ts
    - packages/validators/src/__tests__/employee-country-fields.test.ts
    - packages/api/src/__tests__/employee-pii-crypto.test.ts
    - packages/api/src/__tests__/employee-cross-org-leak.test.ts
    - packages/api/src/__tests__/employee-registry.test.ts
  modified: []

key-decisions:
  - "Greenfield statutory validators each get a RED unit test with canonical valid+invalid vectors before any implementation (validators-are-checksum-of-record)"
  - "P89-gated integration scaffolds (cross-org-leak, registry) are describe.skip with a HOLD-until-P89 marker and import NO P89 surface, so they register+skip cleanly instead of failing CI at module resolution"
  - "The crypto scaffold is P89-independent and fails RED only on the missing employee-pii-crypto service module, mirroring ssn-crypto.test.ts but keyed on EMPLOYEE_PII_ENCRYPTION_KEY"

patterns-established:
  - "RED-now vs skip-until-gate split: P89-independent scaffolds fail at module resolution now; P89-gated scaffolds are describe.skip so the later waves only flip them GREEN"
  - "Emirates-ID test asserts checksum-advisory: formatValid is authoritative, checksumValid is a soft boolean that never flips a format-valid ID to a reject"
  - "Country-fields test asserts the PII boundary: no national-ID key (pesel/ssn/iqama/emiratesId/nationalId) round-trips into the countryFields JSON"

requirements-completed: [EMP-REG-PL-01, EMP-REG-DE-01, EMP-REG-UK-01, EMP-REG-US-01, EMP-REG-AE-01, EMP-REG-SA-01]

# Metrics
duration: 14min
completed: 2026-06-22
---

# Phase 90 Plan 01: Wave-0 RED Scaffolds Summary

**Five RED/skip test scaffolds pinning the greenfield statutory-validator contracts (PESEL/Steuer-IdNr/NI/tax-code/Saudi-ID/Emirates-ID/GOSI/WPS) with canonical vectors, the country-fields PII boundary, the employee-PII AES-256-GCM round-trip, and the P89-gated tenant-isolation + reveal-RBAC contracts.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- Pinned every canonical test vector from RESEARCH as an explicit valid AND invalid assertion: PESEL `44051401359` (accept) / bad-checksum `44051401358` + bad-DOB `44131401359` (reject); Steuer-IdNr `36574261809` (accept) / `36554266806` uniqueness (reject); NI `AB123456C` (accept) / D-first, O-second, BG-prefix, QQ (reject); tax-code `1257L/K1257/BR/0T/NT/S1257L/"1257L W1"` (accept) / `ZZZ`, `12345L` (reject); Saudi ID `1|2|false` union; Emirates ID `784-1990-1234567-1` format-pass; GOSI 9-digit; WPS up-to-13-digit.
- Locked the country-fields PII boundary: a national-ID key (pesel/ssn/iqama/emiratesId/nationalId) is never accepted into the countryFields JSON.
- Locked the Emirates-ID checksum-advisory contract: a format-valid ID with a failing Luhn advisory is never hard-rejected.
- Crypto scaffold (P89-independent) pins round-trip, `iv:authTag:ciphertext` three-part format, random-IV (two encrypts differ), and `maskLast4` derivation, RED on the missing service module.
- Two P89-gated scaffolds register and skip cleanly (`2 skipped / 6 skipped`) with a HOLD-until-P89 marker, keeping the api suite green while pinning the cross-org-leak and register-omit + revealPii RBAC/audit contracts.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED validator + country-fields scaffolds (P89-independent)** - `c0db2fe7f` (test)
2. **Task 2: RED PII-crypto round-trip + P89-gated integration scaffolds** - `c9f4c1ba9` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `packages/validators/src/__tests__/employee-validators.test.ts` - RED unit vectors for the 8 greenfield statutory validators; fails on missing `../employee-validators.js`.
- `packages/validators/src/__tests__/employee-country-fields.test.ts` - RED dispatch + minimal valid PL/DE/GB/US/AE/SA + required-field + no-national-ID-key-in-JSON; fails on missing `../employee-country-fields.js`.
- `packages/api/src/__tests__/employee-pii-crypto.test.ts` - RED round-trip + random-IV + last4; fails on missing `../services/employee-pii-crypto.js`; P89-independent.
- `packages/api/src/__tests__/employee-cross-org-leak.test.ts` - `describe.skip` HOLD-until-P89 tenant-isolation scaffold for EmployeeProfile.
- `packages/api/src/__tests__/employee-registry.test.ts` - `describe.skip` HOLD-until-P89 register-omit-encrypted + revealPii RBAC/audit scaffold.

## Decisions Made
- None beyond the plan — executed exactly as written. The P89-gated scaffolds deliberately import no P89 surface (none exists in-tree) so they skip cleanly rather than failing at module resolution; the P89-independent scaffolds fail RED only on their not-yet-implemented target modules.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The acceptance criterion for this wave is that the P89-independent scaffolds fail RED for the RIGHT reason (Cannot find module for the not-yet-implemented validator/country-fields/crypto modules) and the P89-gated scaffolds skip cleanly — both verified.

## Verification
- `pnpm --filter @contractor-ops/validators test -- employee-validators employee-country-fields` → both FAIL at module resolution (`Cannot find module '../employee-validators.js'` / `'../employee-country-fields.js'`); the other 45 validator test files stay green.
- `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/employee-pii-crypto.test.ts` → FAILS at module resolution (`Cannot find module '../services/employee-pii-crypto.js'`).
- `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/employee-cross-org-leak.test.ts src/__tests__/employee-registry.test.ts` → `2 skipped (2)`, `6 skipped (6)` — register and skip cleanly, no CI failure.
- `pnpm lint:no-breadcrumbs` → OK (no planning-ID comments; `HOLD until P89` is an operational marker, not a planning ID).

## Known Stubs
The two `describe.skip` scaffolds (`employee-cross-org-leak.test.ts`, `employee-registry.test.ts`) are intentional HOLD-until-P89 placeholders — their `it` bodies document the gated contracts with `expect(true).toBe(true)` and become the GREEN target once Phase 89 lands `EmployeeProfile` + `employeeRouter` + the `employeePii` permission (Plan 04/05). This is documented intent, not unfinished work.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The P89-independent validator/country-fields/crypto contracts are pinned and RED — the next waves implement against these exact expectations (no test expectations to invent).
- The P89-gated scaffolds are ready to flip GREEN once Phase 89 delivers the Employee/Worker model, the `employee` Better Auth resource + 4 HR roles, and the `module.workforce-employees` flag. Execution of the schema/router waves remains HELD until P89 lands (D-08).
- A new `EMPLOYEE_PII_ENCRYPTION_KEY` (hex-32) must be added to the validators env schema + `.env.example` when the crypto service is implemented (the crypto scaffold already references it).

## Self-Check: PASSED

- FOUND: packages/validators/src/__tests__/employee-validators.test.ts
- FOUND: packages/validators/src/__tests__/employee-country-fields.test.ts
- FOUND: packages/api/src/__tests__/employee-pii-crypto.test.ts
- FOUND: packages/api/src/__tests__/employee-cross-org-leak.test.ts
- FOUND: packages/api/src/__tests__/employee-registry.test.ts
- FOUND: 90-01-SUMMARY.md
- FOUND commit: c0db2fe7f (Task 1)
- FOUND commit: c9f4c1ba9 (Task 2)

---
*Phase: 90-theme-b-employee-registry-per-market-6*
*Completed: 2026-06-22*
