---
phase: 90-theme-b-employee-registry-per-market-6
plan: 05
subsystem: api
tags: [trpc, rbac, pii-encryption, audit-log, employee-registry, i18n, logger]

# Dependency graph
requires:
  - phase: 89-theme-b-worker-model-abstraction-serial-gate
    provides: Worker model (workerType=EMPLOYEE), employeeRouter skeleton, module.workforce-employees flag, employee Better Auth resource
  - phase: 90-theme-b-employee-registry-per-market-6 (plan 03)
    provides: per-market validators (validateEmployeeCountryFields + greenfield ID validators) + employee-pii-crypto encrypt/decrypt helpers
  - phase: 90-theme-b-employee-registry-per-market-6 (plan 04)
    provides: EmployeeProfile model (1:1 workerId FK, dedicated encrypted columns) + employeePii:read permission
provides:
  - employeeRegistryRouter (register + revealPii + listReferenceLists) composed into the staff employeeRouter
  - register mutation — per-market validation, national-ID encryption into dedicated columns, *Encrypted omit-on-return, audit-logged, Worker+EmployeeProfile in one transaction
  - revealPii mutation — employeePii:read RBAC + field-routed decrypt + audit row, staff-router-only
  - ELStAM stub-hook seam (elstam-stub.ts, no network)
  - PII_MASK_PATHS/KEYWORDS extended (pesel/iqama/emiratesId/nationalId) so national IDs never log in full
affects: [90-06 wiki synthesis, 94 payroll, 97 HR dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry router mirrors contractor-tax updateUsProfile/revealSsn: encrypt into dedicated columns + omit *Encrypted on return + audit-logged field-routed reveal"
    - "Static per-field findUnique selects for the reveal path (a computed-key select collapses the extended-client type inference to an Excessive-stack-depth error)"
    - "register creates the Worker(workerType=EMPLOYEE) identity root AND its 1:1 EmployeeProfile in one $transaction — full HR registration, since P89 models an employee as a Worker row (no standalone Employee table)"

key-files:
  created:
    - packages/api/src/routers/employee/employee-registry-router.ts
    - packages/api/src/services/elstam-stub.ts
  modified:
    - packages/api/src/routers/core/employee.ts
    - packages/api/src/errors.ts
    - packages/api/src/__tests__/employee-registry.test.ts
    - packages/logger/src/pii-mask.ts
    - apps/web-vite/messages/en.json
    - apps/web-vite/messages/pl.json
    - apps/web-vite/messages/de.json
    - apps/web-vite/messages/ar.json

key-decisions:
  - "register establishes the workerId→Worker linkage by CREATING the Worker(workerType=EMPLOYEE) + EmployeeProfile in one transaction — there is no Employee table; EmployeeProfile FKs Worker via workerId @unique (P89/Plan-04 shape). The plan's employeeId/Employee assumption was adapted."
  - "Audit rows use resourceType ORGANIZATION (EntityType enum has no EMPLOYEE/WORKER member) with resourceId = EmployeeProfile.id and workerId in metadata — the 89-03 worker.backfill precedent + reminder.ts idiom; keeps lint:audit-log + typecheck green without a schema/migration change."
  - "Promoted typed columns (saudizationCategory:NitaqatBand / etat:Decimal / employmentStatus) are set from dedicated typed inputs, decoupled from the loosely-typed countryFields JSON — avoids a lossy 4→6 Saudization-band mapping (SA countryFields band is PLATINUM/GREEN/YELLOW/RED; the NitaqatBand column splits GREEN into HIGH/MID/LOW)."
  - "revealPii keyed by workerId (the stable @unique employee identity), not the plan's employeeId."

patterns-established:
  - "Every errors.ts national-ID code ships en/pl/de/ar Errors translations in the same change set (errors-i18n-parity gate)"
  - "National-ID plaintexts are separate top-level register inputs, never inside countryFields; the per-market .strict() schema rejects any smuggled ID key"

requirements-completed: [EMP-REG-PL-01, EMP-REG-DE-01, EMP-REG-UK-01, EMP-REG-US-01, EMP-REG-AE-01, EMP-REG-SA-01]

# Metrics
duration: 35min
completed: 2026-07-01
---

# Phase 90 Plan 05: Employee Registry Router (register + revealPii + reference lists) Summary

**The employee registry's write + reveal surface: a `.strict()`, audit-logged `register` that validates per-market fields, encrypts the four national IDs into dedicated columns and omits every `*Encrypted` blob on the return; an `employeePii:read`-gated, field-routed, staff-only `revealPii`; a non-PII `listReferenceLists`; plus an ELStAM stub seam and logger PII-mask paths so national IDs never log in full.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 (both autonomous; TDD on Task 1)
- **Files:** 2 created, 8 modified

## Accomplishments

- `employeeRegistryRouter` created and composed into the P89 `employeeRouter` via `mergeRouters(employeeBaseRouter, employeeRegistryRouter)` — the skeleton `list` plus `register` / `revealPii` / `listReferenceLists` are now one `employee.*` namespace on the **staff `appRouter` only** (`grep -c revealPii portal-root.ts` = 0).
- **register** (`.strict()`): validates the non-PII per-market fields via `validateEmployeeCountryFields`; hard-rejects a structurally invalid PESEL / SSN / Iqama with a `BAD_REQUEST` `errors.ts` constant; encrypts PESEL/Iqama/Emirates-ID via `encryptPii` and SSN via `encryptSsn` into the dedicated columns (+ `*Last4`); splits the promoted typed columns out of the JSON; creates the `Worker(workerType=EMPLOYEE)` + linked `EmployeeProfile` in one `$transaction`; **omits every `*Encrypted` column on the return**; and writes an `employee.registered` audit row.
- **Emirates ID advisory:** format is blocking, checksum is advisory-only — a format-valid Emirates ID whose Luhn variant fails registers successfully and returns a `checksumAdvisory` field, never throwing.
- **revealPii:** `requirePermission({ employeePii: ['read'] })` (403 without), input `{ workerId, field }`, org-scoped single-column `findUnique`, `NOT_FOUND` when absent, field-routed decrypt (`ssn`→`decryptSsn`/SSN key, `pesel`/`iqama`/`emiratesId`→`decryptPii`/EMPLOYEE key), and an `employee.<field>.revealed` audit row. Staff-only.
- **listReferenceLists:** returns the non-PII per-market reference tuples (NFZ oddziały, Lohnsteuerklasse, student-loan plans, W-4 filing status, US withholding states, Saudization categories).
- **ELStAM stub seam** (`elstam-stub.ts`): typed `lookupElstam(input): ElstamStubResult` that makes **no network call** — a documented local-only integration seam (no live Finanzverwaltung API).
- **Logger PII-mask** extended: `PII_MASK_PATHS` + `PII_MASK_KEYWORDS` now cover `pesel` / `iqama` / `emiratesId` / `nationalId` (+ `countryFields.*` + casing variants), mirroring the existing `*.ssn` treatment.
- **i18n parity:** the 5 new `errors.ts` national-ID codes ship `Errors.*` translations in en / pl / de / ar (the `errors-i18n-parity` gate would otherwise fail).

## Task Commits

1. **Task 1 (RED):** un-skip employee-registry register + revealPii contract — `47dd9e58e` (test)
2. **Task 1 (GREEN):** employeeRegistryRouter register + revealPii + listReferenceLists — `1d6f427b0` (feat)
3. **Task 2:** ELStAM stub seam + mask employee national IDs in logs — `9ebd7cab7` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Verification

- `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/employee-registry.test.ts` — **11/11 GREEN** (omit-encrypted, `.strict()` mass-assignment reject, invalid-PESEL reject, Emirates-ID advisory, revealPii RBAC 403, audit row, no-raw-PII-in-audit, tenant IDOR, staff-only).
- `pnpm --filter @contractor-ops/logger test` — **49/49 GREEN**.
- `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/logger` — **clean**.
- `pnpm lint:audit-log` — OK (register + reveal route through `writeAuditLog`).
- `pnpm lint:no-breadcrumbs` — OK.
- `grep -c revealPii packages/api/src/portal-root.ts` — **0** (staff-only).
- `grep -c "pesel\|iqama\|emiratesId\|nationalId" packages/logger/src/pii-mask.ts` — 12 (≥ 4).
- `errors-i18n-parity.test.ts` — GREEN after adding the 4-locale translations.

## Decisions Made

- **workerId, not employeeId:** there is no `Employee` table — an employee is a `Worker(workerType=EMPLOYEE)` and `EmployeeProfile` attaches 1:1 via `workerId @unique` (P89 + Plan-04). `register` creates the Worker + EmployeeProfile in one transaction (a full HR registration); `revealPii` is keyed by `workerId`.
- **Audit resourceType = ORGANIZATION:** the `EntityType` Prisma enum has no `EMPLOYEE`/`WORKER` member. Following the 89-03 `worker.backfill` precedent and the `reminder.ts` idiom, the audit rows use `resourceType: 'ORGANIZATION'` with `resourceId = EmployeeProfile.id` and `workerId`/`field` in metadata — passes `lint:audit-log` + typecheck with no schema/migration change. A dedicated `EMPLOYEE` `EntityType` member is a clean follow-up (needs an additive enum migration).
- **Promoted columns from typed inputs:** `saudizationCategory` (NitaqatBand, 6-value) / `etat` (Decimal) / `employmentStatus` are set from dedicated typed register inputs rather than re-derived from the coarse `countryFields` JSON, avoiding a lossy 4→6 Saudization-band mapping.

## Deviations from Plan

### 1. [Plan-assumption correction] register creates Worker + EmployeeProfile (workerId), not an employeeId reference

- **Found during:** Task 1
- **Issue:** The plan text (`register` takes `employeeId` referencing an `Employee` table; `revealPii` input `{ employeeId, field }`) assumes a standalone `Employee` table that P89/Plan-04 do not ship.
- **Fix:** `register` creates the `Worker(workerType=EMPLOYEE)` identity root + the 1:1 `EmployeeProfile` (`workerId` FK) in one `$transaction`; `revealPii` is keyed by `workerId`. Matches the Plan-04 model exactly.
- **Committed in:** `1d6f427b0`

### 2. [Rule 3 - Blocking] revealPii used a computed-key select that broke typecheck

- **Found during:** Task 1 verification (`typecheck`)
- **Issue:** A dynamic `select: { id: true, [column]: true } as Prisma.EmployeeProfileSelect` triggered `TS2321 Excessive stack depth` against the tenant-extended client type.
- **Fix:** Replaced with a per-field `switch` of static single-column selects (still selects only the one requested encrypted column, no casts).
- **Committed in:** `1d6f427b0`

### 3. [Rule 3 - Blocking] new errors.ts codes needed 4-locale translations

- **Found during:** Task 1 verification (full api suite)
- **Issue:** `errors-i18n-parity.test.ts` requires every `errors.ts` code to have `Errors.*` strings in en/pl/de/ar; the 5 new national-ID codes were missing them.
- **Fix:** Added `employeeInvalidPesel` / `employeeInvalidSsn` / `employeeInvalidIqama` / `employeeInvalidEmiratesId` / `employeeEmiratesIdChecksumAdvisory` translations to all four locale bundles.
- **Committed in:** `1d6f427b0`

---

**Total deviations:** 3 (1 plan-assumption correction, 2 self-caused blocking fixes). No scope creep.

## Out-of-Scope Pre-Existing Failures (NOT caused by this plan)

- **`rbac-recipients.test.ts:110` snapshot mismatch** — the static `ROLE_CONTRACTOR_ACTIONS` mirror lists only the 10 core roles; P89 added the 4 HR roles to `roles.ts` without updating the mirror. Documented as pre-existing in 90-04; untouched here. This plan adds no `contractor` actions or roles, so it neither causes nor worsens it.
- **`packages/validators/src/legal/de.{js,d.ts}`** show as modified in the worktree — build artifacts regenerated by `pnpm install`, not edited by this plan; left unstaged.

## Known Stubs

- **`elstam-stub.ts` — intentional, documented seam.** `lookupElstam` returns an unavailable `STUB` result and makes no network call. This is a deliberate local-only integration seam (no live German Finanzverwaltung ELStAM API); a later phase wires the real transmission channel behind the same return shape. Not wired into `register` yet (out of scope for this plan).

## Documentation Follows Code

- Wiki synthesis for the employee registry is Plan **90-06**'s dedicated scope (per 90-04 `affects`); the domain/router-catalog pages are updated there. No wiki edit is made in this executor worktree.

## Threat Flags

None — no new security surface beyond the plan's threat model. `omit` keeps encrypted blobs off the register return (T-90-05-01), reveal is RBAC + audit gated (T-90-05-02), `.strict()` + server-derived org/encrypted columns block mass-assignment (T-90-05-03), reveal is staff-router-only (T-90-05-04), PII_MASK_PATHS block national IDs from logs (T-90-05-05), and Emirates-ID checksum stays advisory (T-90-05-06).

## Self-Check: PASSED

- Created files exist: `employee-registry-router.ts`, `elstam-stub.ts`, `90-05-SUMMARY.md` — all FOUND (plus the 6 modified sources + 4 locale bundles).
- Commits exist: `47dd9e58e` (test), `1d6f427b0` (feat), `9ebd7cab7` (feat) — all FOUND.
- Gates: registry test 11/11, logger test 49/49, `typecheck` api+logger clean, `lint:audit-log` OK, `lint:no-breadcrumbs` OK, `grep -c revealPii portal-root.ts` = 0.
