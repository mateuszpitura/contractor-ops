---
phase: 91-theme-b-akta-osobowe-personnel-file
plan: 02
subsystem: database
tags: [prisma, postgres, personnel-file, akta-osobowe, retention, multi-tenant, migration]

# Dependency graph
requires:
  - phase: 90-theme-b-employee-registry-per-market
    provides: EmployeeProfile (countryCode) + Worker identity root the personnel file attaches to
  - phase: 89-theme-b-worker-model-abstraction
    provides: Worker tenant-owning model + workerId sidecar FK precedent
provides:
  - PersonnelFile model (1:1 tenant-owning sidecar on Worker via workerId @unique)
  - PersonnelFileDocument join (documentId @unique 1:1 into the existing Document stack)
  - PersonnelFileSection enum (SECTION_A..D) realizing the locked 4-section view as an enum-on-link
  - PersonnelDocClassificationMethod enum (DETERMINISTIC/AI/MANUAL/PENDING)
  - hireDate/terminatedAt retention read-seams on PersonnelFile
  - additive reversible migration __personnel_file_additive (up + down)
  - regenerated tracked Prisma client exposing the new models + enums
affects: [personnel-file retention engine, personnel-file router, per-section RBAC, doc classifier, GDPR erasure, akta UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New tenant-owning model kept OUT of globalModels → inherits withTenantScope"
    - "4-section view realized as an optional enum on the document link (not row-per-section)"
    - "Retention anchors as nullable read-seam columns (hireDate hire anchor; terminatedAt termination anchor, null = active = retain indefinitely)"
    - "Additive-only file migration mirroring __employee_profile_additive; per-region prod apply deferred to a human gate"

key-files:
  created:
    - packages/db/prisma/schema/personnel.prisma
    - packages/db/prisma/schema/migrations/__personnel_file_additive/migration.sql
    - packages/db/prisma/schema/migrations/__personnel_file_additive/down.sql
    - packages/db/src/generated/prisma/client/models/PersonnelFile.ts
    - packages/db/src/generated/prisma/client/models/PersonnelFileDocument.ts
  modified:
    - packages/db/prisma/schema/worker.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/contract.prisma
    - packages/db/src/generated/prisma/client/** (regenerated)

key-decisions:
  - "PersonnelFile is a dedicated model FK'd to Worker.id (identity root), not a relation on EmployeeProfile"
  - "Sections modeled as an optional enum on PersonnelFileDocument (enum-on-link) per D-01's 4-section constraint"
  - "countryCode snapshotted onto PersonnelFile at creation so retention/section rules resolve without a join"
  - "hireDate lives on PersonnelFile (@db.Date) because EmployeeProfile has no hire column; terminatedAt is a nullable read-seam a later phase populates"

patterns-established:
  - "Personnel-file substrate: PersonnelFile + PersonnelFileDocument, both tenant-scoped via absence from globalModels"
  - "Document stack is referenced 1:1 (documentId @unique), never forked"

requirements-completed: [AKTA-01]

# Metrics
duration: ~30min
completed: 2026-07-01
---

# Phase 91 Plan 02: PersonnelFile Persistence Substrate Summary

**Tenant-owning PersonnelFile (1:1 → Worker) + PersonnelFileDocument enum-on-link join into the existing Document stack, with SECTION_A..D + classification-method enums, hireDate/terminatedAt retention read-seams, an additive/reversible migration, and a regenerated Prisma client.**

## Performance

- **Duration:** ~30 min (includes worktree hydration + fast-forward to the Phase 90 base)
- **Started:** 2026-07-01T08:25Z (approx)
- **Completed:** 2026-07-01T08:54Z
- **Tasks:** 1 auto committed; 1 checkpoint resolved autonomously as deferred
- **Files modified:** 19 (4 schema + 2 migration + 13 regenerated client)

## Accomplishments
- `personnel.prisma`: `PersonnelFile` (1:1 tenant-owning sidecar on `Worker` via `workerId @unique`; `@@unique([organizationId, workerId])`) and `PersonnelFileDocument` (`documentId @unique` 1:1 into `Document`) with the `PersonnelFileSection` (SECTION_A..D) and `PersonnelDocClassificationMethod` (DETERMINISTIC/AI/MANUAL/PENDING) enums.
- Retention read-seams on `PersonnelFile`: `hireDate DateTime? @db.Date` (hire anchor) and `terminatedAt DateTime?` (termination anchor; null → active → retain indefinitely), plus the `countryCode` jurisdiction key.
- Reciprocal relations wired: `Worker.personnelFile`, `Organization.personnelFiles` + `personnelFileDocuments`, `Document.personnelFileDocument`.
- Additive, reversible migration `__personnel_file_additive` (CREATE TYPE/TABLE/INDEX/FK only in `migration.sql`; mechanical reverse in `down.sql`) — no NOT NULL backfill, no drops on existing tables.
- Regenerated the tracked Prisma client — `PersonnelFile` + `PersonnelFileDocument` model types and both enums are now exposed; `pnpm --filter @contractor-ops/db typecheck` is green.
- Both models deliberately kept OUT of `globalModels` (tenant.ts untouched) → they inherit `withTenantScope`.

## Task Commits

1. **Task 1: models + enums + Worker/Organization/Document relations + migration + regenerated client** - `614eae4af` (feat)

**Task 2 (checkpoint:human-action — local dev DB push):** resolved autonomously as DEFERRED (see Deviations). No commit.

## Files Created/Modified
- `packages/db/prisma/schema/personnel.prisma` - PersonnelFile + PersonnelFileDocument models + two enums (new)
- `packages/db/prisma/schema/migrations/__personnel_file_additive/migration.sql` - additive up (new)
- `packages/db/prisma/schema/migrations/__personnel_file_additive/down.sql` - reversible down (new)
- `packages/db/prisma/schema/worker.prisma` - `personnelFile PersonnelFile?` back-relation
- `packages/db/prisma/schema/organization.prisma` - `personnelFiles` + `personnelFileDocuments` back-relations
- `packages/db/prisma/schema/contract.prisma` - `Document.personnelFileDocument` back-relation
- `packages/db/src/generated/prisma/client/**` - regenerated client (new PersonnelFile.ts + PersonnelFileDocument.ts model files)

## Decisions Made
- Dedicated `PersonnelFile` model on `Worker.id` (identity root) rather than a relation on `EmployeeProfile` — keeps the file at the identity grain the retention clock and RBAC key off.
- 4-section view as an optional enum on the document link (`section PersonnelFileSection?`), realizing D-01's locked constraint without a row-per-section table.
- `countryCode` snapshotted onto `PersonnelFile` at creation (jurisdiction key for retention/section resolution without a join).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fast-forwarded the worktree branch to the Phase 90 base**
- **Found during:** Task 1 (before authoring relations)
- **Issue:** The execution worktree was cut from a stale commit (`066704060`) that predates Phase 89/90, so `worker.prisma` and `employee.prisma` — the plan's declared HARD dependency ("Phase 90 must be COMPLETE before execution") — were absent from the working tree. `prisma generate` would fail because `PersonnelFile.worker Worker @relation` references an undefined model.
- **Fix:** `git merge --ff-only main`. HEAD was a strict ancestor of `main` (merge-base == HEAD), and `main` (`2cc3b2e0b`, "docs(90): complete Employee Registry 7/7") already contained the landed Phase 90 schema, so the fast-forward is non-destructive (pure pointer advance + checkout of files this plan never touches; the untracked `personnel.prisma` survived). No `reset --hard`, `clean`, `stash`, or protected-ref rewind was used.
- **Files modified:** none authored by this fix — it only brought already-landed tracked files into the worktree.
- **Verification:** post-merge `ls` confirmed `worker.prisma`/`employee.prisma` present; `prisma generate` + db `typecheck` subsequently green.
- **Committed in:** n/a (branch pointer advance; the plan's own changes are in `614eae4af`).

**2. [Rule 3 - Blocking] Hydrated worktree node_modules + supplied a placeholder DATABASE_URL for offline codegen/format**
- **Found during:** Task 1 (enum audit / generate / commit hook)
- **Issue:** Fresh worktree had no `node_modules` (`tsx: command not found`); and `prisma generate` / the pre-commit `prisma format` hook both fail to load `prisma.config.ts` when `DATABASE_URL` is unset (there is no root `.env` in the worktree).
- **Fix:** `pnpm install --frozen-lockfile` (routine workspace hydration from the committed lockfile — not a new dependency, no supply-chain surface). For the generate + commit steps, exported a placeholder `DATABASE_URL=postgresql://placeholder@localhost:5432/placeholder` — Prisma `generate`/`format` are offline and never connect. Commit ran with hooks ON (never `--no-verify`).
- **Files modified:** none (env/install only).
- **Verification:** `prisma generate` succeeded; pre-commit `biome check` + `prisma format` both completed; commit `614eae4af` landed.
- **Committed in:** n/a (environment setup).

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking; environment/base only). No source-logic deviation from the plan.
**Impact on plan:** Both fixes were required to satisfy the plan's stated precondition (Phase 90 landed) and to run offline Prisma codegen in a fresh worktree. No scope creep; the model/enum/migration/relation design is exactly as specified.

## Issues Encountered
- **Task 2 checkpoint resolved as DEFERRED — local dev DB push blocked.** `pnpm --filter @contractor-ops/db exec prisma db push` returns `P1001: Can't reach database server at localhost:5432`; a port probe confirms `:5432` is CLOSED (Connection refused). No local Postgres is available in this environment. Per the LOCAL-ONLY Standing Constraint, the per-region production apply (EU/ME) is a recorded post-merge item and must never hard-block; this matches the deferral pattern of prior phases (85-01, 89-02, 89-03). The generated Prisma client (from `db:generate`) is committed, so downstream typechecks are satisfied. **Follow-up (post-merge human gate):** apply `__personnel_file_additive/migration.sql` to the local dev DB, then to EU and ME regional databases.
- **Pre-existing `db:audit-enum-casing` offenders (not introduced here):** the whole-script run exits non-zero due to 5 lowercase values in `idp-deprovisioning.prisma` enum `ManualOverrideCategory` (Phase 76). Out of scope per the SCOPE BOUNDARY; logged in `deferred-items.md`. This plan's enums (`PersonnelFileSection` SECTION_A..D, `PersonnelDocClassificationMethod`) are correct UPPER_SNAKE and are absent from the offender list.

## User Setup Required
None - no external service configuration required. (Deferred DB apply is an operator/migration-gate action, not app config.)

## Next Phase Readiness
- The persistence substrate is landed and typed: Wave 2 (retention engine, personnel-file router, per-section RBAC, classifier, erasure, UI) can be authored and typechecked against `PersonnelFile` / `PersonnelFileDocument`.
- **Blocker for runtime verification only:** the schema is not yet applied to a live DB (deferred above), so any test that actually reads/writes these tables needs the migration applied first. Structural/typecheck verification is unaffected.

## Threat Flags
None - no new security surface beyond the plan's `<threat_model>`. Both models are tenant-scoped (absent from globalModels); the additive migration touches no existing table.

## Self-Check: PASSED

- FOUND: `packages/db/prisma/schema/personnel.prisma`
- FOUND: `packages/db/prisma/schema/migrations/__personnel_file_additive/migration.sql`
- FOUND: `packages/db/prisma/schema/migrations/__personnel_file_additive/down.sql`
- FOUND: `packages/db/src/generated/prisma/client/models/PersonnelFile.ts`
- FOUND: `packages/db/src/generated/prisma/client/models/PersonnelFileDocument.ts`
- FOUND: `91-02-SUMMARY.md`
- FOUND commit: `614eae4af`
- db typecheck: green

---
*Phase: 91-theme-b-akta-osobowe-personnel-file*
*Completed: 2026-07-01*
