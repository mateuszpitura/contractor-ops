---
phase: 89-theme-b-worker-model-abstraction-serial-gate
plan: 02
subsystem: db-abstraction
tags: [prisma, prisma-extension, migration, raw-sql-guard, worker-model, tenant-scope]

# Dependency graph
requires:
  - phase: 89-01
    provides: the worker-type withWorkerTypeDefault RED scaffold (now GREEN) + the contractor-parity / route-shape baselines this plan must keep GREEN
provides:
  - Worker base table (org-scoped, NOT in globalModels) + WorkerType enum + sidecar nullable Contractor.workerId @unique FK, with Contractor.id left stable
  - Migration A authored as un-applied SQL files (migration.sql + down.sql) — additive, reversible, no NOT NULL / FK (enforcement deferred to Plan 03 after parity)
  - withWorkerTypeDefault Prisma extension chained outermost in createTenantClient + createTenantClientFrom (explicit-where-wins, 8 read ops, Worker-only)
  - check:contractor-rawsql-workertype CI guard wired into lint:ci; the 4 known raw FROM "Contractor" sites annotated contractor-only
affects: [89-03 (backfill + Migration B enforcement run at the human gate), 89-04 (router split), worker-model-abstraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "withWorkerTypeDefault: $allOperations $extends link, Worker-only model set, injects workerType='CONTRACTOR' unless caller passes an explicit workerType (the one behavior soft-delete lacks); chained outermost so the discriminator rides on top of tenant-scope + soft-delete"
    - "Sidecar nullable workerId @unique FK on Contractor (not a Contractor.id re-key) so the 20+ existing FKs that reference Contractor.id are never relinked"
    - "Migration A authored as files under prisma/schema/migrations/__worker_base_additive/ (double-underscore prefix → outside the timestamped applied-migration namespace) so codegen/migrate never auto-apply it; applied per-region at the blocking human gate"
    - "check:contractor-rawsql-workertype is a structural twin of check-raw-sql-tenant-scoped.ts: FROM \"Contractor\" detector + workerType-predicate / // contractor-only-raw-sql: annotation opt-out"

key-files:
  created:
    - packages/db/prisma/schema/worker.prisma
    - packages/db/prisma/schema/migrations/__worker_base_additive/migration.sql
    - packages/db/prisma/schema/migrations/__worker_base_additive/down.sql
    - packages/db/src/worker-type.ts
    - scripts/check-contractor-rawsql-workertype.ts
  modified:
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/src/index.ts
    - package.json
    - packages/api/src/routers/core/dashboard.ts
    - packages/api/src/routers/core/search.ts
    - packages/api/src/routers/core/contractor-shared.ts
    - packages/db/src/generated/prisma/client (codegen output)

key-decisions:
  - "Design A: workerType discriminator lives on Worker only; Contractor reads are inherently contractor-only, so the 4 raw FROM Contractor sites need no predicate change — only the annotation + the CI guard against NEW unguarded raw reads"
  - "No findUnique→findFirst fallback needed (A2): under design A the Worker-only model set means the only unique key is Worker.id, and soft-delete already injects a scalar into findUnique in-tree — the extension injects workerType into findUnique.where safely"
  - "Migration A is authored as un-applied files only — NO database migration applied this run (operator forbade DB mutation); per-region apply is the Plan-03 blocking human gate"

patterns-established:
  - "Worker base table + sidecar Contractor.workerId @unique 1:1 FK; Contractor.id stable"
  - "withWorkerTypeDefault chained outermost: withWorkerTypeDefault(withSoftDelete(withTenantScope(...)))"
  - "Annotation convention // contractor-only-raw-sql: <reason> opts a raw FROM Contractor read out of the new guard"

requirements-completed: []

# Metrics
duration: ~8min
completed: 2026-06-22
---

# Phase 89 Plan 02: Worker Base Schema + withWorkerTypeDefault Extension + Raw-SQL Guard Summary

**Worker identity-root table + sidecar nullable Contractor.workerId FK (additive Migration A authored as un-applied files), the withWorkerTypeDefault explicit-where-wins extension chained outermost in the tenant client, and a check:contractor-rawsql-workertype CI guard wired into lint:ci — all CODE + codegen only, with NO database migration applied.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-22T01:14:39Z
- **Tasks:** 3
- **Files:** 5 created + 8 modified (one of which is the regenerated Prisma client)

## Accomplishments

- **Worker base table + sidecar FK (Task 1).** `worker.prisma` defines the `Worker` identity root (`id`, `organizationId`, `workerType WorkerType @default(CONTRACTOR)`, shared `displayName/email/status`, `createdAt/updatedAt/deletedAt`, an `Organization` relation, a `Contractor?` back-relation, a commented `// employee Employee?` skeleton, and `@@index([organizationId])` + `@@index([organizationId, workerType])`). Worker is tenant-owning and deliberately absent from `globalModels`, so it inherits `withTenantScope`. `Contractor` gained a nullable `workerId String? @unique` sidecar FK + `worker Worker?` relation; `Contractor.id` is unchanged so the existing FKs that reference it are never relinked. `Organization` gained the `workers Worker[]` back-relation. `prisma generate` (codegen only) regenerated the client; `@contractor-ops/db` + `@contractor-ops/api` typecheck green.
- **Migration A authored as un-applied files (Task 1).** `prisma/schema/migrations/__worker_base_additive/migration.sql` creates the `WorkerType` enum + `Worker` table (with the two indexes + `workerType DEFAULT 'CONTRACTOR'`), adds the **nullable** `Contractor.workerId` column, and the unique index — with NO `NOT NULL` and NO `FOREIGN KEY` (those are Plan 03's post-backfill enforcement). A paired `down.sql` reverses it mechanically. The `__`-prefixed directory keeps it out of Prisma's timestamped applied-migration namespace, and **no migrate/push command was run** — it stays an un-applied file for the per-region blocking human gate in Plan 03.
- **withWorkerTypeDefault extension chained outermost (Task 2, TDD GREEN).** `worker-type.ts` exports `withWorkerTypeDefault` — an `$allOperations` `$extends` link that injects `workerType: 'CONTRACTOR'` on the 8 Worker read ops (findMany/findFirst/findFirstOrThrow/findUnique/findUniqueOrThrow/count/aggregate/groupBy) ONLY when the caller has not already set `workerType` (explicit-where-wins). Model set is `{'Worker'}` (design A). `index.ts` exports it and chains it outermost in both `createTenantClient` and `createTenantClientFrom`. This turned the Plan-01 worker-type RED scaffold GREEN (19 tests).
- **check:contractor-rawsql-workertype CI guard (Task 3).** A structural twin of `check-raw-sql-tenant-scoped.ts` (`captureBody`/`stripComments`/`lineNumberAt`/`previousNonBlankLines`/glob/exit machinery copied), with the predicate swapped to: offence iff a raw body matches `FROM "Contractor"` AND lacks a `workerType` token AND lacks a `// contractor-only-raw-sql:` annotation on a preceding non-blank line. The 4 known sites (dashboard activeContractors count, search command-palette FTS, contractor-shared billingModel facet, contractor-shared FTS facet) are annotated contractor-only. Wired into `lint:ci` immediately after `lint:raw-sql`. Verified: exits 0 on the current tree, exits 1 on a temporary unannotated `FROM "Contractor"` fixture (fixture removed). The contractor-parity + contract-snapshot baselines stayed GREEN.

## Task Commits

1. **Task 1: Worker schema + Contractor.workerId sidecar FK + Migration A** — `c6b1736fc` (feat)
2. **Task 2: withWorkerTypeDefault extension + chain outermost** — `297be7ae8` (feat)
3. **Task 3: check:contractor-rawsql-workertype CI guard + 4 sites annotated** — `4b8193ddc` (feat)

_TDD note (Task 2): the RED test (`worker-type.test.ts`) was committed in Plan 01 (`98c93a5e3`); Task 2 is the GREEN commit that turns it passing — RED→GREEN gate satisfied across the two plans._

## Files Created/Modified

- `packages/db/prisma/schema/worker.prisma` — Worker base model + WorkerType enum + indexes (tenant-owning)
- `packages/db/prisma/schema/migrations/__worker_base_additive/migration.sql` — additive Worker table + nullable Contractor.workerId (un-applied)
- `packages/db/prisma/schema/migrations/__worker_base_additive/down.sql` — paired rollback (un-applied)
- `packages/db/src/worker-type.ts` — withWorkerTypeDefault extension (explicit-where-wins)
- `scripts/check-contractor-rawsql-workertype.ts` — CI guard for raw FROM "Contractor" reads
- `packages/db/prisma/schema/contractor.prisma` — nullable workerId @unique + worker relation; Contractor.id unchanged
- `packages/db/prisma/schema/organization.prisma` — workers Worker[] back-relation
- `packages/db/src/index.ts` — export + outermost chaining in both client factories
- `package.json` — check:contractor-rawsql-workertype script + lint:ci wiring after lint:raw-sql
- `packages/api/src/routers/core/{dashboard,search,contractor-shared}.ts` — // contractor-only-raw-sql: annotations on the 4 raw sites
- `packages/db/src/generated/prisma/client/**` — Prisma codegen output of the schema change

## Verification

- `pnpm --filter @contractor-ops/db db:generate` → codegen only (no DB connection); client picks up Worker + Contractor.workerId + Organization.workers
- `pnpm --filter @contractor-ops/db typecheck` → green; `pnpm typecheck --filter=@contractor-ops/api` → 14/14 green (downstream consumer)
- `pnpm --filter @contractor-ops/db exec vitest run src/__tests__/worker-type.test.ts` → **19 passed** (Plan-01 RED scaffold now GREEN)
- `db:audit-enum-casing`: WorkerType is compliant and NOT an offender (the script's overall non-zero exit is a pre-existing `ManualOverrideCategory` failure — see Deferred Issues)
- `grep` ACs: `model Worker`, `@@index([organizationId, workerType])`, `workerId String? @unique`, Worker NOT in globalModels, migration has CREATE TABLE + ADD COLUMN with no NOT NULL/FK, down.sql exists, `withWorkerTypeDefault(withSoftDelete(withTenantScope` ×2, export line present, `check:contractor-rawsql-workertype` present — all pass
- `pnpm check:contractor-rawsql-workertype` → exits 0 on current tree; exits 1 on an unannotated fixture (verified, fixture removed)
- `pnpm lint:raw-sql` (existing tenant guard) → still green
- `pnpm --filter @contractor-ops/api exec vitest run worker-regression.test.ts contractor-contract-snapshot.test.ts` → **14 passed** (no regression)
- `pnpm lint:no-breadcrumbs` → OK (the // contractor-only-raw-sql: annotations are domain annotations, no planning IDs)

## Decisions Made

- **Design A confirmed at the code level.** The `workerType` discriminator lives only on `Worker`; the extension's model set is `{'Worker'}`. Contractor reads are inherently contractor-only, so the 4 raw `FROM "Contractor"` sites need no inline predicate — only the annotation and the new CI guard against future unguarded raw reads.
- **A2 (findUnique injection) is moot under design A.** With a Worker-only model set, the only unique key is `Worker.id`; soft-delete already injects a scalar into `findUnique.where` in-tree and works, so the extension injects `workerType` into `findUnique`/`findUniqueOrThrow` without converting to `findFirst`. No fallback applied.
- **Migration A is files-only this run.** Per the operator's NO_LIVE_MIGRATION directive, no `migrate dev/deploy`, `db push`, or seed touched any database. The `__`-prefixed migration directory keeps the SQL out of the applied-migration namespace; per-region apply is the Plan-03 blocking human gate.

## Deviations from Plan

**1. [Scope boundary] Plan's "additive db push fallback" NOT taken.** Task 1's action text offered an additive `db push` fallback if `migrate dev` was drift-blocked locally. The execution directive forbade any database mutation, so only `prisma generate` (pure codegen) was run. This is a deliberate, authorized deviation — Migration A stays an un-applied file. No functional impact: all verification (extension unit test, CI guard, typecheck, parity baselines) is satisfied on codegen-only because the regression/parity tests are mock-Prisma based (Plan 01), not live-DB.

## Deferred Issues

- **Pre-existing `db:audit-enum-casing` failure (out of scope).** The script exits non-zero on 5 lowercase values in `enum ManualOverrideCategory` (`idp-deprovisioning.prisma:117-121`), which predate Phase 89 (last touched by Phase 76, commit `6afe07244`). The new `WorkerType` enum is UPPER_SNAKE-compliant and is NOT an offender. Logged to `deferred-items.md`; not fixed (unrelated file, SCOPE BOUNDARY rule).

## Known Stubs

- The `// employee Employee?` line in `worker.prisma` is a commented-out skeleton placeholder for the future Employee model (P90), not a stub that blocks this plan's goal. The Migration A SQL is intentionally un-applied (per the execution directive) and is applied at the Plan-03 blocking human gate — documented above, not a stub to wire here.

## User Setup Required

None this run. The Worker schema change requires a per-region database migration (Migration A → backfill → Migration B), which is the **Plan 03 blocking human gate** — deliberately NOT performed here.

## Next Phase Readiness

- The Worker model + extension are in place and the worker-type RED scaffold is GREEN, so Plan 03 (backfill `planWorkerBackfill` + the per-region Migration A apply + Migration B enforcement) has its abstraction dependency satisfied.
- Migration A SQL (forward + rollback) is authored and ready to apply at the human gate; the backfill RED scaffold (`backfill-worker.test.ts`) remains terminal-RED until Plan 03 creates `backfill-worker.ts`.
- The CI guard prevents any new raw `FROM "Contractor"` read from silently bypassing the discriminator.
- No WORKER-* requirement is marked complete (per directive) — REQUIREMENTS.md WORKER-* stay `[ ]`.

## Self-Check: PASSED

- All 5 created files verified present on disk.
- All 3 task commits verified in git log: `c6b1736fc`, `297be7ae8`, `4b8193ddc`.

---
*Phase: 89-theme-b-worker-model-abstraction-serial-gate*
*Completed: 2026-06-22*
