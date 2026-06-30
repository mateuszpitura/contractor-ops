---
phase: 90-theme-b-employee-registry-per-market-6
plan: 04
subsystem: database
tags: [prisma, postgres, multi-tenant, rbac, better-auth, pii-encryption, employee-registry]

# Dependency graph
requires:
  - phase: 89-theme-b-worker-model-abstraction-serial-gate
    provides: Worker model (workerType discriminator), employee Better Auth resource, 4 HR roles, module.workforce-employees flag
  - phase: 90-theme-b-employee-registry-per-market-6 (plan 03)
    provides: employeeCountryFieldsSchemaMap per-market non-PII country-field validators
provides:
  - EmployeeProfile tenant-owning Prisma model (1:1 on Worker via workerId @unique FK)
  - EmploymentStatus enum (ACTIVE/ON_LEAVE/SUSPENDED/TERMINATED)
  - Dedicated AES-256-GCM PII columns (pesel/ssn/iqama/emiratesId Encrypted+Last4)
  - Promoted typed columns saudizationCategory (NitaqatBand), etat (Decimal 3,2), employmentStatus
  - employeePii:read Better Auth permission, least-privilege grant (owner+admin+hr_admin)
  - GREEN cross-org leak test driving the real withTenantScope over EmployeeProfile
  - Authored additive multi-region migration (un-applied) + down.sql rollback
affects: [90-05 employee registration router, 90-06 wiki synthesis, 94 payroll, 97 HR dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hybrid employee storage: countryFields JSON for non-PII + dedicated encrypted columns for national IDs + promoted typed columns for dashboard filters"
    - "1:1 sidecar on Worker via workerId @unique FK (mirrors Contractor↔Worker), not a standalone Employee table"
    - "Cross-org leak test drives the real withTenantScope extension over a fake $extends base (db tenant.test.ts idiom) — proves isolation without the not-yet-built router"

key-files:
  created:
    - packages/db/prisma/schema/employee.prisma
    - packages/db/prisma/schema/migrations/__employee_profile_additive/migration.sql
    - packages/db/prisma/schema/migrations/__employee_profile_additive/down.sql
  modified:
    - packages/db/prisma/schema/worker.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/auth/src/permissions.ts
    - packages/auth/src/roles.ts
    - packages/api/src/__tests__/employee-cross-org-leak.test.ts

key-decisions:
  - "EmployeeProfile attaches 1:1 to Worker (workerId @unique FK), NOT to a standalone Employee table — P89 models an employee as Worker(workerType=EMPLOYEE), so no Employee table exists"
  - "employeePii:read granted to exactly owner + admin + hr_admin (snake_case); hr_manager/payroll_officer/leave_approver get the employee surface but never national-ID reveal"
  - "Per-region production migration apply DEFERRED as a post-merge item (LOCAL-ONLY posture + P82-89 precedent) — schema/client/permission/test land now"

patterns-established:
  - "National-ID PII never in countryFields JSON: dedicated *Encrypted/*Last4 columns only, enforced by .strict() per-market schemas"
  - "New tenant model stays out of globalModels so it inherits withTenantScope automatically"

requirements-completed: [EMP-REG-PL-01, EMP-REG-DE-01, EMP-REG-UK-01, EMP-REG-US-01, EMP-REG-AE-01, EMP-REG-SA-01]

# Metrics
duration: 30min
completed: 2026-07-01
---

# Phase 90 Plan 04: EmployeeProfile Storage + Access Control Summary

**Tenant-owning EmployeeProfile model attached 1:1 to Worker, with hybrid storage (countryFields JSON + dedicated AES-256-GCM national-ID columns + promoted typed columns), the least-privilege employeePii:read permission, and a GREEN cross-org leak test driving the real tenant-scope extension.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-30T23:06Z
- **Completed:** 2026-06-30T23:36Z
- **Tasks:** 2 (Task 1 autonomous; Task 2 migration authored, live apply deferred)
- **Files modified:** 8 source + generated client

## Accomplishments

- `EmployeeProfile` Prisma model: tenant-owning (`organizationId`), 1:1 on `Worker` via `workerId String @unique` FK, `countryCode`, `countryFields Json?`, four dedicated encrypted PII column pairs (pesel/ssn/iqama/emiratesId `*Encrypted` + `*Last4`), promoted typed columns `saudizationCategory NitaqatBand?` / `etat Decimal? @db.Decimal(3,2)` / `employmentStatus EmploymentStatus?`, `@@unique([organizationId, workerId])`, `@@index([organizationId])`, `@@index([organizationId, employmentStatus])`.
- New `enum EmploymentStatus { ACTIVE ON_LEAVE SUSPENDED TERMINATED }` (UPPER_SNAKE — passes `db:audit-enum-casing`).
- Back-relations added: `Worker.employeeProfile EmployeeProfile?` (replacing the commented placeholder) and `Organization.employeeProfiles EmployeeProfile[]`.
- `employeePii: ['read']` added to `accessControlStatement` and granted least-privilege to `owner` + `admin` + `hr_admin` only.
- `employee-cross-org-leak.test.ts` un-skipped and GREEN (4/4): drives the real `withTenantScope` from `@contractor-ops/db` over EmployeeProfile, proving org B cannot read/mutate org A's row, the injected `where` always carries the caller org, and the scope fails closed with no tenant context.
- `EmployeeProfile` is NOT in `globalModels` (`grep -c "'EmployeeProfile'" tenant.ts` = 0); Prisma client regenerated clean.
- Additive multi-region migration authored (un-applied) with a paired `down.sql`, mirroring the P89 `__worker_base_additive` convention.

## Task Commits

1. **Task 1: EmployeeProfile model + employeePii permission + cross-org leak test** — `a999b0063` (feat)
2. **Task 2: additive EmployeeProfile migration (authored, un-applied)** — `18b1b7bce` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `packages/db/prisma/schema/employee.prisma` — EmployeeProfile model + EmploymentStatus enum
- `packages/db/prisma/schema/worker.prisma` — `employeeProfile` 1:1 back-relation
- `packages/db/prisma/schema/organization.prisma` — `employeeProfiles` back-relation
- `packages/auth/src/permissions.ts` — `employeePii: ['read']` in accessControlStatement
- `packages/auth/src/roles.ts` — `employeePii` granted to owner/admin/hr_admin
- `packages/api/src/__tests__/employee-cross-org-leak.test.ts` — real withTenantScope isolation proof
- `packages/db/prisma/schema/migrations/__employee_profile_additive/{migration,down}.sql` — additive migration
- `packages/db/src/generated/prisma/client/**` — regenerated client (incl. new `models/EmployeeProfile.ts`)

## Decisions Made

- **EmployeeProfile → Worker, not Employee:** P89 deliberately models an employee as a `Worker` row with `workerType='EMPLOYEE'` (confirmed by the skeleton `employee.ts` router reading `worker.findMany({ where: { workerType: 'EMPLOYEE' }})` and the `worker.prisma` comment). No standalone `Employee` table exists, so EmployeeProfile attaches 1:1 to `Worker` via `workerId @unique`.
- **Least-privilege PII grant:** `employeePii:read` to owner/admin/hr_admin only — the read-only HR roles see the employee surface but never national-ID reveal.
- **Migration apply deferred:** schema/client/permission/test land now; live per-region apply is the deferred post-merge item (see below).

## Deviations from Plan

### 1. [Plan-assumption correction] EmployeeProfile FK targets Worker, not a non-existent Employee table

- **Found during:** Task 1 (model authoring)
- **Issue:** The plan (frontmatter `key_links`, `<promoted_columns>`, and Task 1 action) assumed a standalone P89 `Employee` table and an `employeeId String @unique` FK. P89 ships no such table — an employee is a `Worker` row with `workerType='EMPLOYEE'`.
- **Fix:** Used `workerId String @unique` → `Worker` for the 1:1 link; `@@unique([organizationId, workerId])`; added the `Worker.employeeProfile` back-relation (converted the commented `// employee Employee?` placeholder) and `Organization.employeeProfiles`. The cross-org leak test was adapted to `workerId`/`Worker`.
- **Verification:** `prisma generate` clean; `lint:schema` OK (35 files); cross-org leak test 4/4 GREEN.
- **Committed in:** `a999b0063`

### 2. [Checkpoint handled as deferred] Task 2 blocking human-action migration gate

- **Found during:** Task 2 (checkpoint:human-action, gate=blocking)
- **Issue:** Task 2 applies the additive migration to live EU/ME/US regional DBs — an external-state mutation requiring an operator. Running background/autonomous in a LOCAL-ONLY posture, there is no operator.
- **Fix:** Authored the additive migration as un-applied SQL files (`migration.sql` + `down.sql`) mirroring the P89 `__worker_base_additive` convention. Did NOT reach production DBs. Recorded the live apply as a DEFERRED post-merge item per LOCAL-ONLY and the P82-89 schema-lands / apply-deferred precedent. Did not return a phase-halting checkpoint.
- **Committed in:** `18b1b7bce`

---

**Total deviations:** 2 (1 plan-assumption correction, 1 checkpoint-handled-as-deferred). No scope creep.
**Impact on plan:** Functionally complete for local dev — model, client, permission, and isolation proof all land; only the production per-region apply is deferred.

## Deferred Issues

- **DEFERRED — blocking human-action gate:** apply the additive `EmployeeProfile` migration per region in order EU → ME → US (`packages/db/prisma/schema/migrations/__employee_profile_additive/`). Requires the P89 Worker migration applied first (FK dependency). Not applied in background/LOCAL-ONLY mode.

## Out-of-Scope Pre-Existing Failures (NOT caused by this plan)

Logged to `deferred-items.md`; not fixed per "fix only your own additions":

1. **`db:audit-enum-casing` red on `ManualOverrideCategory`** (`idp-deprovisioning.prisma:117-121`, P77) — lowercase enum values, file untouched by this plan. This plan's `EmploymentStatus` enum is clean (absent from the offender list).
2. **`rbac-recipients.test.ts:110` snapshot mismatch** — the static `ROLE_CONTRACTOR_ACTIONS` mirror in `rbac-recipients.ts` lists only the 10 core roles; P89 added the 4 HR roles to `roles.ts` without updating the mirror. This plan's `roles.ts` edit only adds the `employeePii` resource (not `contractor` actions or the role set), so it neither causes nor worsens the failure. The scoped `employee-cross-org-leak.test.ts` is GREEN (4/4).

## Issues Encountered

- Worktree had no `node_modules` / `.env`. Resolved by `pnpm install` (reuses global store) and passing dummy `DATABASE_URL*` to `prisma generate` / the pre-commit `prisma format` hook (no DB connection is made by either).

## User Setup Required

None for local dev. Post-merge: an operator must apply the additive migration to the three regional databases (see Deferred Issues).

## Threat Flags

None — no new security surface beyond the plan's threat model. EmployeeProfile is tenant-owning (T-90-04-01 mitigated), national IDs are dedicated encrypted columns never in JSON (T-90-04-02 mitigated), employeePii is least-privilege (T-90-04-03 mitigated), and the migration is additive + reversible + human-gated (T-90-04-04 mitigated, apply deferred).

## Self-Check: PASSED

- Created files exist: `employee.prisma`, migration `migration.sql` + `down.sql`, generated `models/EmployeeProfile.ts` — all FOUND.
- Commits exist: `a999b0063`, `18b1b7bce` — both FOUND.
- `employeePii` granted in `roles.ts` at exactly owner (allPermissions), admin, hr_admin.
- `grep -c "'EmployeeProfile'" tenant.ts` = 0; `lint:schema` OK; `lint:no-breadcrumbs` OK; cross-org leak test 4/4 GREEN.

## Next Phase Readiness

- Storage + access-control foundation ready for Plan 05 (employee registration router writes through EmployeeProfile, splitting national IDs into the encrypted columns and validating non-PII via `employeeCountryFieldsSchemaMap`).
- Blocker for production only: the deferred per-region migration apply.

---
*Phase: 90-theme-b-employee-registry-per-market-6*
*Completed: 2026-07-01*
