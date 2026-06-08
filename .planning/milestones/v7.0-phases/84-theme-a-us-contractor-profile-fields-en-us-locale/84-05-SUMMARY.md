---
phase: 84-theme-a-us-contractor-profile-fields-en-us-locale
plan: 05
subsystem: api
tags: [trpc, ssn, ein, usps, rbac, encryption, audit-log, contractor, us]

# Dependency graph
requires:
  - phase: 84-01
    provides: usCountryFieldsSchema, isValidEin, isValidSsn, US in countryFieldsSchemaMap, USPS/SSN env vars
  - phase: 84-03
    provides: encryptSsn/decryptSsn (ssn-crypto), contractorPii:[read] permission, Contractor.ssnEncrypted/ssnLast4/uspsVerified/uspsValidatedAt columns
  - phase: 84-04
    provides: UspsAddressClient.validateAddress (gov-api), fail-open advisory CASS adapter
provides:
  - "contractor.getCountryFieldsConfig US branch (place 1 of the 3-place US registration)"
  - "contractor.updateUsProfile — EIN/address to countryFields JSONB, SSN to dedicated encrypted columns, USPS advisory on save"
  - "contractor.revealSsn — staff-router-only, contractorPii:[read]-gated, audit-logged full-SSN reveal"
affects: [84-06 (web-vite US compliance UI consumes updateUsProfile + revealSsn), 85 (W-8BEN/tax-treaty)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSN encrypt-at-rest into dedicated columns (never JSONB) mirroring the bankAccount precedent"
    - "Advisory non-blocking external validation (USPS) via try/catch fail-open around an already-fail-open adapter"
    - "PII reveal as a separate RBAC-gated + audit-logged staff procedure (never portal)"

key-files:
  created: []
  modified:
    - packages/api/src/routers/core/contractor.ts
    - packages/api/src/errors.ts

key-decisions:
  - "EIN/SSN validated as individual flat inputs (not via usCountryFieldsSchema top-level) because updateUsProfile accepts partial updates without a required entityType; the JSONB schema's required entityType would reject EIN-only or address-only saves"
  - "SSN never enters countryFields JSONB — encrypted into ssnEncrypted + plain ssnLast4 columns (D-01 / Pitfall 3); the JSONB blob is keyed only with entityType/ein/address"
  - "USPS consulted only when a full address (line1+city+state+zip) is present; the call is wrapped fail-open so a USPS/limiter/cache failure leaves the save successful with uspsVerified=false (D-03)"
  - "revealSsn selects ONLY { id, ssnEncrypted } — the encrypted column is never selected in any other read path (Pitfall 3); cross-org id → NOT_FOUND (IDOR scoping)"
  - "Added CONTRACTOR_INVALID_EIN/SSN error constants to errors.ts rather than hardcoded TRPCError messages (CLAUDE.md i18n-system-messages lint gate)"

patterns-established:
  - "buildUsCountryFields helper: deterministic JSONB merge that structurally excludes SSN"
  - "applyUspsAdvisory helper: mutates update-data + JSONB in place, never throws (keeps the mutation under the cognitive-complexity limit)"

metrics:
  duration: ~13 min
  completed: 2026-06-08
  tasks: 2
  files: 2
---

# Phase 84 Plan 05: US Server Surface (contractor router) Summary

Wired the US contractor profile into the staff `contractor` tRPC router: a `US` branch in `getCountryFieldsConfig`, an `updateUsProfile` mutation that stores EIN/address in the `countryFields` JSONB while encrypting SSN into dedicated `ssnEncrypted`/`ssnLast4` columns and running USPS CASS validation advisory/non-blocking on save, and a `revealSsn` mutation that is staff-router-only, gated by `contractorPii:[read]`, tenant-scoped, and audit-logged with no SSN in the row.

## What Was Built

- **`getCountryFieldsConfig` US branch (US-FIELD-04):** for a US org returns `fields: [entityType, ein, addressLine1, city, state, zipCode]`. SSN is intentionally absent — it is rendered by the dedicated masked-reveal control (Plan 06), not the generic JSONB field renderer. This is place 1 of the 3-place US registration (place 2 = `countryFieldsSchemaMap.US` from 84-01; place 3 = the React switch in 84-06).
- **`updateUsProfile` (US-FIELD-01/02/03):** gated `requirePermission({ contractor: ['update'] })`. Validates EIN (`isValidEin`) and SSN (`isValidSsn`) up front → `BAD_REQUEST` on either. Builds the `countryFields` JSONB from EIN + address only. On a provided SSN: `encryptSsn(cleaned)` → `ssnEncrypted`, `cleaned.slice(-4)` → `ssnLast4` (dedicated columns, never JSONB). When a full address is present, runs `UspsAddressClient.validateAddress` advisory/non-blocking (fail-open try/catch) writing `uspsVerified` + `uspsValidatedAt` and applying any normalized address back to the JSONB. A USPS failure leaves the save successful and unverified.
- **`revealSsn` (US-FIELD-02):** gated `requirePermission({ contractorPii: ['read'] })`. Selects ONLY `{ id, ssnEncrypted }` scoped by `organizationId` → `NOT_FOUND` if absent or cross-org. Decrypts via `decryptSsn`, writes `writeAuditLog({ action: 'contractor.ssn.revealed', resourceType: 'CONTRACTOR', metadata: { field: 'ssn' } })` with no SSN value in the row, returns `{ ssn }`. Registered on the staff router only — never `portalAppRouter` (Pitfall 6).

## Verification

- `pnpm --filter @contractor-ops/api test src/routers/core/__tests__/contractor-reveal-ssn.test.ts` — 9/9 GREEN (RED → GREEN). Covers: revealSsn FORBIDDEN without perm, decrypt+audit with no SSN in row, cross-tenant NOT_FOUND, staff-router-only + no portal exposure; updateUsProfile SSN→encrypted-columns-never-JSONB, invalid EIN→BAD_REQUEST, USPS-failure-non-blocking.
- `pnpm --filter @contractor-ops/api typecheck` — clean.
- `grep -rl revealSsn packages/api/src/routers/portal` — empty (no portal exposure, Pitfall 6).
- `pnpm lint:audit-log` — clean (no direct `auditLog.create`).
- biome pre-commit (lint-staged) — clean on the two source files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale built artifacts for dependency packages**
- **Found during:** Task 1 typecheck.
- **Issue:** `@contractor-ops/db` `dist/` (consumed via `./dist` exports) lacked the Phase 84-03 `ssnEncrypted`/`ssnLast4`/`uspsVerified`/`uspsValidatedAt` columns, and `@contractor-ops/gov-api` `dist/` lacked the Phase 84-04 `UspsAddressClient`/`USPS_RATE_LIMIT` exports — so api typecheck failed on missing properties/exports despite the source schemas being correct.
- **Fix:** Regenerated the Prisma client (`pnpm --filter @contractor-ops/db db:generate`) and rebuilt `db` + `gov-api` (`pnpm --filter ... build`). These are generated/built artifacts (gitignored `dist/`), not source — no tracked-file changes.
- **Files modified:** none tracked (build output only).
- **Commit:** n/a (artifacts gitignored).

**2. [Rule 2 / CLAUDE.md - Correctness] Error constants instead of hardcoded TRPCError messages**
- **Found during:** Task 1 pre-commit (biome `i18n-system-messages` gate rejected `message: 'Invalid EIN' / 'Invalid SSN'`).
- **Issue:** CLAUDE.md forbids hardcoded TRPCError messages; the message must reference an error constant from `packages/api/src/errors.ts`.
- **Fix:** Added `CONTRACTOR_INVALID_EIN`/`CONTRACTOR_INVALID_SSN` constants (mirroring `CONTRACTOR_INVALID_NIP`) and referenced them via `E.*`. `errors.ts` is the directly-coupled error surface of these procedures. Note: wiring the matching `Errors.*` i18n keys into the web-vite locale JSONs is out of scope here (FE locale work, Plan 06 / locale plans); `i18n:parity` does not scan backend error constants.
- **Files modified:** `packages/api/src/errors.ts`.
- **Commit:** 268e1269.

**3. [Rule 1 - Refactor] Extracted helpers to satisfy cognitive-complexity guard**
- **Found during:** Task 1 pre-commit (biome `noExcessiveCognitiveComplexity`).
- **Issue:** Inlining the JSONB assembly + USPS advisory block pushed `updateUsProfile` to complexity 19 (max 15).
- **Fix:** Extracted `buildUsCountryFields` (JSONB merge that structurally excludes SSN) and `applyUspsAdvisory` (fail-open USPS block) as module helpers; the mutation is now a clean orchestrator under the limit.
- **Files modified:** `packages/api/src/routers/core/contractor.ts`.
- **Commit:** 268e1269.

## Deferred Issues (out of scope — logged to deferred-items.md)

- `pnpm lint:logs` failure at `apps/api/src/routes/csp-report.ts:86` — pre-existing unredacted-body log (commit `e320911b`, untouched by this plan; already logged under 84-03).
- biome `noExcessiveCognitiveComplexity` warning (17 > 15) at `contractor.ts:500` — the pre-existing `contractor.list` query, not my code (my new procedures are biome-clean). Non-blocking warning.

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. All mitigations applied: SSN never in JSONB / never selected outside reveal (T-84-05-01), `contractorPii:[read]` gate (T-84-05-02), audit with no SSN value (T-84-05-03), `organizationId` scoping → NOT_FOUND (T-84-05-04), SSN excluded from the JSONB schema/path (T-84-05-05), staff-router-only + grep gate (T-84-05-06), USPS fail-open (T-84-05-07).

## Known Stubs

None. The web-vite consumption of these procedures (the SSN masked-reveal control + USPS pill + US compliance fields) is Plan 06; that is a planned downstream wiring, not a stub in this plan's surface.

## Self-Check: PASSED

- FOUND: `.planning/milestones/v7.0-phases/84-theme-a-us-contractor-profile-fields-en-us-locale/84-05-SUMMARY.md`
- FOUND: commit `268e1269`
- Verified: `updateUsProfile` + `revealSsn` both present in the committed `contractor.ts`.
