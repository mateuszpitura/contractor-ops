---
phase: 96-theme-b-employee-self-service-portal
plan: 01
subsystem: database
tags: [portal, prisma, feature-flags, employee-portal, foundation-gate, idor]
requirements: [EMP-PORTAL-01, EMP-PORTAL-03]
dependency_graph:
  requires:
    - phase: 90-93
      provides: "Worker/EmployeeProfile/PortalSession models + portal auth v2.0"
  provides:
    - "PortalSession subject discrimination (subjectType + nullable contractorId/workerId + raw-SQL one-of CHECK)"
    - "PortalSubjectType enum (CONTRACTOR|EMPLOYEE)"
    - "EmployeeProfile.managerWorkerId reporting-line self-relation (FK -> Worker.id, indexed)"
    - "module.employee-portal dark flag + gated prefix module.employee- + PENDING signoff"
    - "PERSONNEL_FILE_SELF_VIEW_SECTIONS allowlist (section C excluded) + isSelfViewableSection()"
    - "__portal_employee_subject migration (+ down.sql), apply DEFERRED"
  affects:
    - "96-02 (discriminated validatePortalSession + employee/manager procedures)"
    - "96-05 (akta self-view filters on the allowlist)"
    - "96-06 (reports resolve off managerWorkerId)"
    - "96-04/05/06 (all portal procedures gate on module.employee-portal)"
tech_stack:
  added: []
  patterns:
    - "Raw-SQL multi-column CHECK in an __-prefixed hand-authored migration (Prisma cannot express it)"
    - "Two named relations between Worker<->EmployeeProfile (EmployeeProfileWorker + EmployeeManager)"
    - "const-local narrowing of nullable session subject so it survives into the tenantStore.run closure"
key_files:
  created:
    - "packages/db/prisma/schema/migrations/__portal_employee_subject/migration.sql"
    - "packages/db/prisma/schema/migrations/__portal_employee_subject/down.sql"
    - "packages/api/src/routers/portal/portal-self-view-sections.ts"
    - "packages/api/src/routers/portal/__tests__/portal-self-view-sections.test.ts"
  modified:
    - "packages/db/prisma/schema/portal.prisma"
    - "packages/db/prisma/schema/employee.prisma"
    - "packages/db/prisma/schema/worker.prisma"
    - "packages/feature-flags/src/flags-core.ts"
    - "packages/feature-flags/src/signoff-registry-flags.ts"
    - "packages/feature-flags/src/signoff-registry-flags.json"
    - "packages/api/src/middleware/portal-auth.ts"
    - "packages/api/src/services/portal-session.ts"
    - ".planning/brain/wiki/structure/prisma-schema-areas.md"
    - ".planning/brain/wiki/patterns/feature-flags.md"
decisions:
  - "module.employee-portal is NOT added to V7_FLAG_KEYS (pinned to the canonical 20-key GTM cohort by v7-flags-registered.test.ts); it is a new post-cohort flag gated via a new module.employee- prefix + PENDING registry entry."
  - "Making PortalSession.contractorId nullable rippled ctx.contractorId to string|null across 76 api typecheck errors; the contractor-path middleware/service now re-narrow the subject to non-null via const locals. This is permanent contractor-path code (96-02 layers a separate employee middleware alongside it), not a throwaway shim."
  - "managerWorkerId same-org integrity is enforced in the reports resolver (96-06), not the FK — Worker rows are org-scoped and the reports query always filters organizationId."
requirements_completed: [EMP-PORTAL-01, EMP-PORTAL-03]
completed: 2026-07-05
---

# Phase 96 Plan 01: Portal-session + reporting-line + flag + self-view foundation

**Laid the DB + flag + entitlement foundation the employee portal rests on: PortalSession can now be an EMPLOYEE subject (DB-enforced one-of), EmployeeProfile carries the manager reporting-line edge, module.employee-portal is a registered dark gate, and the personnel-file self-view allowlist (section C excluded) is a GREEN-tested constant.**

## Accomplishments

- **PortalSession subject discrimination** — `subjectType PortalSubjectType @default(CONTRACTOR)`, nullable `contractorId` + new nullable `workerId` FK, `@@index([workerId, organizationId])`, `worker`/`contractor` optional relations. A raw-SQL one-of CHECK (`PortalSession_subject_one_of`) enforces exactly one subject matching subjectType. Existing rows backfill to CONTRACTOR.
- **Reporting-line edge** — `EmployeeProfile.managerWorkerId String?` self-relation (FK → `Worker.id`, relation `EmployeeManager`) + `@@index([organizationId, managerWorkerId])`. Required naming the existing 1:1 relation `EmployeeProfileWorker` (two relations between the same pair). Worker gained `managedEmployees` + `portalSessions` back-relations.
- **module.employee-portal flag** — category module, owner workforce-platform, default false; new `module.employee-` gated prefix + PENDING signoff entry (ship-dark posture). Deliberately NOT in the pinned 20-key V7 cohort.
- **PERSONNEL_FILE_SELF_VIEW_SECTIONS** — `['SECTION_A','SECTION_B','SECTION_D']` (section C / pay+PII excluded) + `isSelfViewableSection()`, pure, GREEN-tested (4 tests).
- **Migration** — `__portal_employee_subject/migration.sql` + `down.sql`, hand-authored, `__`-prefixed (out of `migrate deploy`), reversible; apply DEFERRED per region.

## Verification

- `pnpm --filter @contractor-ops/db exec prisma validate` — schemas valid.
- `pnpm --filter @contractor-ops/db run db:generate` + `build` — client regenerates + tsc clean.
- `pnpm typecheck` (api, direct tsc) — 0 errors (after re-narrowing the contractor subject).
- `pnpm --filter @contractor-ops/feature-flags test` — 124/124 pass.
- `pnpm --filter @contractor-ops/api test portal-self-view-sections` — 4/4 pass.
- `pnpm --filter @contractor-ops/api test portal-session portal-auth` — 21/21 pass (no contractor regression).
- `pnpm lint:raw-sql` OK; `pnpm lint:no-breadcrumbs` — my files clean (pre-existing violations in webhooks/ewidencja are other-stream, out of scope).
- Wiki: `structure/prisma-schema-areas.md` (Portal auth row + managerWorkerId) + `patterns/feature-flags.md` (employee-portal gate) updated in this change set.

## Notes / deviations

- **Worktree was rebased to main first.** The worktree was cut at an older commit (docs-91) missing phases 92/93/94 foundation the plans depend on (leave services, employee-time, worker-lifecycle migration). Fast-forwarded the worktree branch to main (25e9937e0, a clean ancestor) so the phase-96 plans build on the correct foundation. Also ran `pnpm install` + symlinked the root `.env`.
- **portal-auth.ts / portal-session.ts touched** (outside 96-01's declared file list) — mandatory to keep the api typecheck green once `contractorId` went nullable. Minimal + behavior-preserving for the contractor path; 96-02 extends (does not undo) this.
