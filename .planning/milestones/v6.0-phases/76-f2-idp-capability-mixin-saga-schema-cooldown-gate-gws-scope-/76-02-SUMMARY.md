---
phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-
plan: 02
subsystem: database
tags: [prisma, schema, migration, deprovisioning, saga, provenance, multi-region]

requires:
  - phase: 76
    provides: "Plan 76-01 idp-saga package (consumes endedAt via cooldown helper)"
provides:
  - "DeprovisioningRun + DeprovisioningStep saga tables (D-01)"
  - "IdpChangeProvenance self-trigger filter table (D-09)"
  - "ContractorAssignment.endedAt nullable column (D-06)"
  - "5 enums (run/step status, step kind, provider, provenance action kind)"
  - "Additive migration SQL + multi-region apply docs"
affects: [76-04, 76-05, 76-06, 76-09, 76-10]

tech-stack:
  added: []
  patterns: ["single-concern Prisma file (idp-deprovisioning.prisma)", "additive migration via migrate diff offline (no shadow DB)"]

key-files:
  created:
    - packages/db/prisma/schema/idp-deprovisioning.prisma
    - packages/db/prisma/schema/migrations/20260531164549_phase76_idp_deprovisioning/migration.sql
    - packages/db/src/__tests__/idp-deprovisioning-schema.test.ts
  modified:
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/db/scripts/README.md
    - packages/db/src/generated/prisma/ (regenerated client)

key-decisions:
  - "DeprovisioningStep declares organizationId directly — lint:schema (schema-guard run-guard.ts) requires organizationId on EVERY non-allowlisted model; there is no FK-scoped-child allowlist, so the plan's threat-model fallback T-76-02-03 was applied proactively"
  - "Migration SQL generated offline via `prisma migrate diff --from-schema <git-HEAD-reconstruction> --to-schema prisma/schema` — `--from-migrations` needs a shadow DB (LOCAL-ONLY: none assumed)"
  - "Added Organization relation + idpChangeProvenances/deprovisioningSteps inverses (the step now FK-references Organization for the tenant column)"
  - "Migrations live under packages/db/prisma/schema/migrations/ (prisma.config.ts migrations.path); multi-region runner is migrate-all-regions.ts (not the plan's stale push-all-regions.ts)"

patterns-established:
  - "Generated Prisma client is committed (tracked) — regenerated files staged alongside schema change"

requirements-completed: [IDP-02, IDP-09, IDP-10, IDP-13]

duration: 18 min
completed: 2026-05-31
---

# Phase 76 Plan 02: IdP Deprovisioning Saga Schema Summary

**Three additive Prisma tables (DeprovisioningRun/Step saga state + IdpChangeProvenance self-trigger filter) + 5 enums + nullable `ContractorAssignment.endedAt` cooldown column, with an offline-generated additive migration and multi-region apply docs.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-31T14:41:30Z
- **Completed:** 2026-05-31T16:48:00Z
- **Tasks:** 6
- **Files:** 3 created + 5 modified (+ regenerated client)

## Accomplishments
- `idp-deprovisioning.prisma`: 3 models + 5 enums; DeprovisioningStep has the `@@unique([runId, provider, stepKind])` anti-double-fan-out constraint + `onDelete: Cascade`; IdpChangeProvenance has the D-10 lookup index + D-12 GC scan index + Cascade.
- `ContractorAssignment.endedAt DateTime?` added — the 14-day cooldown clock source.
- Inverse relations on Contractor, Organization, User (named `UserTriggeredDeprovisioningRuns`), ContractorAssignment.
- Additive migration SQL (3 CREATE TABLE, 5 CREATE TYPE, 1 ADD COLUMN, 0 DROP) committed.
- `pnpm --filter @contractor-ops/db test idp-deprovisioning-schema` → 9 GREEN; db typecheck GREEN.

## Task Commits

1. **76-02-01..06: schema + relations + migration + README + test** — `45a7c742` (feat)

(Schema is one coherent unit; tasks committed together. Migration SQL, regenerated client, README, and test all included.)

## Files Created/Modified
See frontmatter `key-files`.

## Decisions Made
See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DeprovisioningStep needed organizationId for lint:schema**
- **Found during:** Task 76-02-06 (plan-anticipated via T-76-02-03)
- **Issue:** The lint:schema guard requires `organizationId` on every non-allowlisted model; no FK-scoped-child allowlist exists. The plan's primary schema omitted it from DeprovisioningStep.
- **Fix:** Added `organizationId String` + an Organization relation to DeprovisioningStep (+ `deprovisioningSteps` inverse on Organization).
- **Verification:** `pnpm lint:schema` reports only the pre-existing `UserPinnedView` offence; no Phase 76 model offends.
- **Committed in:** `45a7c742`

**2. [Rule 3 - Path/tooling drift] Migration generation + paths adapted**
- **Found during:** Task 76-02-03 / 76-02-04
- **Issue:** Plan referenced `prisma migrate dev --create-only` (needs DB/shadow), `packages/db/prisma/migrations/` (wrong path), and `push-all-regions.ts` (renamed).
- **Fix:** Generated the migration offline with `migrate diff` from a git-HEAD reconstruction of the before-state schema → current schema. Placed it under `prisma/schema/migrations/`. README documents `migrate-all-regions.ts` / `pnpm db:migrate:all`.
- **Verification:** SQL is additive (0 DROP); db:generate exits 0; schema test 9 GREEN.
- **Committed in:** `45a7c742`

---

**Total deviations:** 2 auto-fixed (1 bug — both plan-anticipated / mandatory post-migration)
**Impact on plan:** No scope creep. Schema shape matches RESEARCH §"Saga schema" + §"Provenance schema" exactly (plus the required tenant column on the step).

## Issues Encountered
- Pre-existing `lint:schema` failure on `UserPinnedView` (Phase 75, out of scope) persists — not introduced here.

## User Setup Required
None for code. See Manual-Only Verification below.

## Manual-Only Verifications (autonomous: false)

**Multi-region migration apply — DEFERRED post-deploy (LOCAL-ONLY Standing Constraint, Plan 70-09/75-02 precedent):**

Migration `20260531164549_phase76_idp_deprovisioning` is additive (0 destructive ops). Apply after merge:
```sh
npx tsx packages/db/scripts/migrate-all-regions.ts   # iterates DATABASE_URL_EU + DATABASE_URL_ME
# or: cd packages/db && pnpm run db:migrate:all
```
Idempotent via Prisma `_prisma_migrations`. Recorded in the Deferred Items table.

## Next Phase Readiness
- `endedAt` is queryable — Plan 76-04's cooldown helper has its real column.
- Generated client exposes DeprovisioningRun/Step/IdpChangeProvenance — Plans 76-04/05/06/09 can use them.

---
*Phase: 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-*
*Completed: 2026-05-31*
