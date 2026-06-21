---
phase: 90-theme-b-employee-registry-per-market-6
plan: 02
subsystem: api
tags: [validators, pesel, steuer-idnr, ni-number, uk-tax-code, saudi-id, emirates-id, gosi, wps, zod, reference-data, iso7064, luhn]

# Dependency graph
requires:
  - phase: 90-01
    provides: RED employee-validators.test.ts scaffold pinning the canonical valid+invalid vectors for the 8 greenfield statutory validators (PESEL/Steuer-IdNr/NI/tax-code/Saudi-ID/Emirates-ID/GOSI/WPS)
provides:
  - Eight greenfield statutory-identifier validators at full depth (PESEL mod-10 + embedded-DOB; Steuer-IdNr via reused ISO 7064 mod11_10CheckDigit + digit-uniqueness; NI format + DWP exclusions; UK tax-code 1257L grammar; Saudi-ID Luhn 1|2|false; Emirates-ID format-strict + advisory-only checksum {formatValid,checksumValid}; GOSI/WPS lenient adviser-verify)
  - Inline reference-list enums + Zod schemas (NFZ 01-16, Lohnsteuerklasse I-VI, student-loan, W-4 step-1c, US 10-state+OTHER with stateOther refine, Saudization band mirroring NitaqatBand)
  - Three versioned + date-stamped + adviser-verify LOCAL-ONLY reference seed tables (ZUS oddziały, urzędy skarbowe, Krankenkassen) following the bacs-modulus-tables template
affects: [90-03-employee-country-fields, 90-04-employee-prisma-schema, 90-05-employee-registry-router, 90-06-employee-registration-ui, 94-payroll-adapters, 97-hr-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Greenfield statutory validators reuse the audited ISO 7064 mod11_10CheckDigit from de-validators rather than re-implementing a naive mod-11 (which is the wrong algorithm for Steuer-IdNr)"
    - "Emirates-ID returns a structured { formatValid, checksumValid } so the Luhn checksum stays advisory and can never hard-reject a format-valid ID"
    - "Large code lists (ZUS/urząd/Krankenkasse) are versioned + source-cited + adviser-verify seed tables (bacs template); small stable lists (NFZ/Lohnsteuerklasse/student-loan/W-4/state) are inline as-const enums + Zod"

key-files:
  created:
    - packages/validators/src/employee-validators.ts
    - packages/validators/src/employee-reference-lists.ts
    - packages/validators/src/reference-data/zus-oddzialy.ts
    - packages/validators/src/reference-data/urzedy-skarbowe.ts
    - packages/validators/src/reference-data/krankenkassen.ts
    - packages/validators/src/reference-data/index.ts
  modified:
    - packages/validators/src/index.ts
    - packages/validators/src/__tests__/employee-validators.test.ts

key-decisions:
  - "Reused mod11_10CheckDigit (ISO 7064 MOD 11,10) for Steuer-IdNr and added the digit-uniqueness gate; the naive Σ(w·d) mod 11 was explicitly avoided"
  - "Saudi-ID uses canonical right-to-left Luhn (mod 10); the Plan-01 synthetic test vectors (1000000000 / 2000000004) were mathematically impossible to validate under any Luhn variant, so they were minimally corrected to genuine Luhn-valid neighbours (1000000008 / 2000000006) — a Rule-1 test-vector fix"
  - "Saudization band is a standalone as-const enum that mirrors the Prisma NitaqatBand values, so the validators package validates the category without importing the generated Prisma client"
  - "REQUIREMENTS.md EMP-REG-* checkboxes left unchecked: validators ship now but the requirements are not satisfied until the full phase (schema/router/UI) lands post-P89"

patterns-established:
  - "Structured advisory-checksum result type (EmiratesIdResult) for identifiers whose checksum is reverse-engineered and known to produce false negatives"
  - "Versioned adviser-verify seed table per code list: *_VERSION + *_SOURCE consts + LOCAL-ONLY/no-live-gov-API header + typed seed array, aggregated through a reference-data/index.ts barrel"

requirements-completed: []  # intentionally empty — phase only partially executed; EMP-REG-* not satisfied until the full phase delivers + passes verify-work (held on P89)

# Metrics
duration: 22min
completed: 2026-06-21
---

# Phase 90 Plan 02: Greenfield Statutory Validators + Versioned Reference Seed Tables Summary

**Eight per-market national-ID/tax validators (PESEL, Steuer-IdNr, UK NI, UK tax code, Saudi ID, Emirates ID, GOSI, WPS) at full depth with reused ISO 7064 check-digit math and an advisory-only Emirates-ID checksum, plus inline reference enums and three versioned adviser-verify seed tables — turning the Plan-01 RED validator scaffold GREEN (36/36) with no live government calls.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-21T23:29:02Z
- **Completed:** 2026-06-21T23:51Z
- **Tasks:** 2
- **Files created:** 6
- **Files modified:** 2

## Accomplishments
- Implemented the 8 greenfield validators against every canonical Plan-01 vector: PESEL `44051401359` accept / `44051401358` (checksum) + `44131401359` (month-13 DOB) reject; Steuer-IdNr `36574261809` accept / `36554266806` (uniqueness) + leading-zero reject; NI `AB123456C` accept / D-first, O-second, BG-prefix, QQ reject; tax-code `1257L/K1257/BR/0T/NT/S1257L/"1257L W1"` accept / `ZZZ` + `12345L` reject; Saudi-ID Luhn-gated `1|2|false`; Emirates-ID format-strict with advisory checksum; GOSI 9-digit; WPS ≤13-digit.
- Reused the audited `mod11_10CheckDigit` (ISO 7064 MOD 11,10) for Steuer-IdNr and layered the digit-uniqueness rule on top; deliberately avoided the naive mod-11 anti-pattern.
- Locked the Emirates-ID advisory contract: `isValidEmiratesId` returns `{ formatValid, checksumValid }`; a format-valid ID with a failing Luhn advisory keeps `formatValid: true`.
- Shipped the inline reference enums (NFZ, Lohnsteuerklasse, student-loan, W-4, US 10-state + `OTHER` with a `stateOther` refine, Saudization band) as `as const` tuples + Zod schemas.
- Seeded three versioned + date-stamped + adviser-verify reference tables (ZUS oddziały, urzędy skarbowe, Krankenkassen), each carrying `*_VERSION` + `*_SOURCE` + a LOCAL-ONLY / no-live-gov-API caveat, and barrel-exported every new module from the package index.

## Task Commits

Each task was committed atomically:

1. **Task 1: Greenfield statutory validators (Plan-01 RED → GREEN)** - `ca4870f40` (feat)
2. **Task 2: Reference-list enums + versioned seed tables + barrel** - `862cf1c9f` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `packages/validators/src/employee-validators.ts` - The 8 greenfield validators; reuses `mod11_10CheckDigit`; `EmiratesIdResult` advisory-checksum type; all regexes anchored `^...$` (ReDoS-safe).
- `packages/validators/src/employee-reference-lists.ts` - Inline NFZ/Lohnsteuerklasse/student-loan/W-4/US-state/Saudization `as const` enums + Zod schemas + `usWithholdingSchema` refine.
- `packages/validators/src/reference-data/zus-oddzialy.ts` - Versioned adviser-verify ZUS 6-char territorial seed subset.
- `packages/validators/src/reference-data/urzedy-skarbowe.ts` - Versioned adviser-verify urząd skarbowy 4-digit seed subset.
- `packages/validators/src/reference-data/krankenkassen.ts` - Versioned adviser-verify Krankenkasse 8-digit Betriebsnummer seed subset.
- `packages/validators/src/reference-data/index.ts` - Barrel for the three seed tables.
- `packages/validators/src/index.ts` - Re-exports for all new validator + reference modules.
- `packages/validators/src/__tests__/employee-validators.test.ts` - Corrected the impossible Saudi Luhn vectors (Rule-1 fix); now GREEN 36/36.

## Decisions Made
- Saudi Luhn uses canonical right-to-left mod-10 (alhazmy13 / SAP KB 2384001 convention). See the deviation below for the test-vector correction.
- Saudization band defined as a standalone `SAUDIZATION_CATEGORY` enum mirroring Prisma `NitaqatBand` rather than importing the generated client into a pure-validators package.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected mathematically-impossible Saudi-ID Luhn test vectors**
- **Found during:** Task 1 (validator implementation / GREEN gate)
- **Issue:** The Plan-01 RED scaffold pinned `CITIZEN_ID = '1000000000'` and `RESIDENT_ID = '2000000004'` as "Luhn-valid", but a single non-zero digit can never make any standard Luhn sum ≡ 0 (mod 10), so `1000000000` is impossible to validate under any Luhn convention (verified by brute-forcing both doubling parities and both overflow conventions). The plan + RESEARCH are authoritative that the algorithm is standard Luhn, so the vectors — not the algorithm — were wrong.
- **Fix:** Minimally adjusted the synthetic IDs (last digit only) to genuine right-to-left-Luhn-valid neighbours: citizen `1000000008`, resident `2000000006`, and the invalid-Luhn negative `1000000001`→`1000000009`, leading-3 reject `3000000000`→`3000000008`. Implementation keeps the RESEARCH-authoritative standard Luhn.
- **Files modified:** packages/validators/src/__tests__/employee-validators.test.ts
- **Verification:** `vitest run src/__tests__/employee-validators.test.ts` → 36/36 pass; vectors recomputed in Node before editing.
- **Committed in:** `ca4870f40` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — impossible test vector).
**Impact on plan:** Correctness fix only; the validator algorithm matches RESEARCH exactly. No scope creep.

## Issues Encountered
- The `pnpm --filter @contractor-ops/validators test -- employee-validators` filter matches `employee-country-fields.test.ts` by substring; that suite is a separate Plan-01 RED scaffold for the `employee-country-fields.ts` module owned by a LATER wave (not in 90-02 scope). It fails RED at module resolution by design. The in-scope `employee-validators.test.ts` is fully GREEN (36/36) when run in isolation. Logged in `deferred-items.md`.

## User Setup Required
None - no external service configuration required. (The `EMPLOYEE_PII_ENCRYPTION_KEY` referenced by the crypto scaffold is added in a later P89-independent wave, not this plan.)

## Next Phase Readiness
- The checksum-of-record core is GREEN and barrel-exported — the country-fields registry wave (90-03) can now reuse these validators + the reference enums/seed tables.
- P89-INDEPENDENT: no Employee/Worker model, router, RBAC, or flag was touched; the P89-gated waves (90-04/05/06) remain HELD until Phase 89 lands.
- REQUIREMENTS.md EMP-REG-* checkboxes intentionally left unchecked — they are satisfied only when the full phase (schema + router + UI) delivers and passes verify-work.

## Known Stubs
None. The GOSI/WPS validators are intentionally lenient (no authoritative public checksum spec) and the seed tables are representative subsets — both are annotated adviser-verify per D-05/D-10, which is documented design intent, not unfinished work.

## Self-Check: PASSED

- FOUND: packages/validators/src/employee-validators.ts
- FOUND: packages/validators/src/employee-reference-lists.ts
- FOUND: packages/validators/src/reference-data/zus-oddzialy.ts
- FOUND: packages/validators/src/reference-data/urzedy-skarbowe.ts
- FOUND: packages/validators/src/reference-data/krankenkassen.ts
- FOUND: packages/validators/src/reference-data/index.ts
- FOUND: packages/validators/src/index.ts (modified — barrel exports)
- FOUND: 90-02-SUMMARY.md
- FOUND commit: ca4870f40 (Task 1, feat)
- FOUND commit: 862cf1c9f (Task 2, feat)

---
*Phase: 90-theme-b-employee-registry-per-market-6*
*Completed: 2026-06-21*
