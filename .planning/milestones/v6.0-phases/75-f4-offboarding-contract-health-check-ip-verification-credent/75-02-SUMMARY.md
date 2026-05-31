---
phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
plan: 02
subsystem: database
tags: [prisma, postgres, rls, migration, contract-health, credential-vault]

requires:
  - phase: 75-01
    provides: phase-75-schema RED test flipped GREEN here
  - phase: 74-f4-offboarding-workflow-foundation
    provides: WorkflowRun (CredentialReference re-targets to workflowRunId)
provides:
  - ContractHealthCheckRun model (D-02) + CredentialReference model (D-10)
  - 5 nullable Contract columns + Contract.jurisdiction (D-15 precondition)
  - 6 new enums + DocumentType.IP_RATIFICATION
  - hand-authored migration with D-03 partial unique dedup index + RLS for both new tables
affects: [75-06, 75-07, 75-08]

tech-stack:
  added: []
  patterns:
    - "Hand-authored Prisma migration (no migrate dev against shared Neon) — matches the repo's existing hand-edited-migration pattern (org-definition filtered uniques)"
    - "D-03 filtered unique index via raw SQL (WHERE status='SUCCEEDED') — Prisma cannot express partial uniques"
    - "Per-table RLS policies (app.org_match + app.is_org_member / app.can_write_ops) added in the same migration"

key-files:
  created:
    - packages/db/prisma/schema/migrations/20260531124933_phase75_contract_health_credentials/migration.sql
    - packages/db/src/generated/prisma/client/models/ContractHealthCheckRun.ts
    - packages/db/src/generated/prisma/client/models/CredentialReference.ts
  modified:
    - packages/db/prisma/schema/contract.prisma
    - packages/db/prisma/schema/workflow.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/db/scripts/README.md
    - packages/db/src/__tests__/phase-75-schema.test.ts
    - packages/db/src/generated/prisma/client/* (regenerated)

key-decisions:
  - "Hand-authored the migration SQL rather than `prisma migrate dev` because DATABASE_URL points at a shared Neon cloud DB — running migrate dev would mutate shared infra during an autonomous background run; the plan defers the actual regional apply to a manual post-merge step (autonomous: false)"
  - "Schema test imports Prisma from ../generated/prisma/client/client.js (the repo's modern prisma-client generator), NOT @prisma/client as the plan's example showed"
  - "RLS policies added for both new org-scoped tables in-migration (repo applies RLS per-table in migrations; baseline has none)"

patterns-established:
  - "Multi-region apply is migrate-all-regions.ts (iterates DATABASE_URL_EU/_ME), documented in scripts/README.md"

requirements-completed: [OFFB-04, OFFB-05, OFFB-08, OFFB-09]

duration: 30 min
completed: 2026-05-31
---

# Phase 75 Plan 02: Contract-health + Credential-vault Schema Summary

**Landed ContractHealthCheckRun (D-02) + CredentialReference (D-10) + Contract.jurisdiction with a hand-authored, RLS-protected migration carrying the D-03 partial-unique dedup index; regenerated the prisma-client and flipped the schema RED test GREEN.**

## Performance
- **Duration:** ~30 min
- **Tasks:** 7/7 (apply step deferred — autonomous: false)
- **Files:** 21 (4 schema + 1 migration + 1 README + 1 test + regenerated client)

## Accomplishments
- Added both new models with full index sets, named self-relation on Contract (latest vs all runs), and inverse relations on Organization (2), User (2), WorkflowRun (1).
- Hand-authored migration: 6 CREATE TYPE, ALTER TYPE DocumentType ADD VALUE, ALTER TABLE Contract (5 cols), 2 CREATE TABLE, FKs (User table is "User"), partial unique `ContractHealthCheckRun_dedup_succeeded`, and RLS for both tables.
- prisma format + generate clean; phase-75-schema test 14/14 GREEN; workspace typecheck 42/42; db suite 96 passed / 0 failed.

## Task Commits
1. **75-02-01..07 (schema + migration + generate + test + README)** - `ab3e396c` (feat)

## Deviations from Plan

**[Path drift — 75-DRIFT-MAP] migration location + region script** — Migrations live at `prisma/schema/migrations/` (plan frontmatter said `prisma/migrations/`); region runner is `migrate-all-regions.ts` (plan said `push-all-regions.ts`). README + migration authored at the real paths.

**[Rule 1 — bug/correctness] Contractor field is `countryCode` not `country`** — RESEARCH §3 / plan assumed `Contractor.country`; the real field is `countryCode @db.Char(2)`. Updated the jurisdiction-fallback comment in contract.prisma and README; flagged for Plan 75-06's `resolveContractJurisdiction` (must select `contractor: { countryCode: true }`).

**[Rule 1 — correctness] User FK table name** — Migration FKs reference `"User"` (capital, no @@map), verified against the baseline migration, not lowercase `"user"`.

**[Deferred — autonomous: false] migrate dev not run** — DATABASE_URL targets shared Neon cloud; running `prisma migrate dev` would mutate shared infra in a background run. Migration was hand-authored (repo pattern) and validated via `prisma format` + `prisma generate`. The actual `migrate deploy` against EU+ME is the documented manual post-merge step (LOCAL-ONLY constraint).

**Total deviations:** 3 (1 path-drift, 2 correctness) + 1 deferred apply. **Impact:** none on schema correctness; the jurisdiction-field rename must be honored by Plan 75-06.

## Pre-existing issues (out of scope — NOT fixed)
- `pnpm lint:schema` reports ONE offence — `UserPinnedView` (auth.prisma:107, commit a1efc484, pre-Phase-75) missing organizationId. Both new Phase 75 models pass. Left untouched per scope-boundary rule; flag for the owning phase.

## Self-Check: PASSED
- Migration SQL: 1 CHCR table, 1 CredRef table, 6 CREATE TYPE, IP_RATIFICATION ADD VALUE, partial unique present.
- phase-75-schema test 14/14 GREEN; other Wave 0 RED scaffolds preserved; typecheck + db suite clean.
- Generated client in sync with schema (re-generate produced no diff).

## Post-deploy / manual checkpoint (autonomous: false)
- Run `npx tsx packages/db/scripts/migrate-all-regions.ts` (or `pnpm --filter @contractor-ops/db run db:migrate:all`) to apply the migration to EU + ME after merge. Documented in `packages/db/scripts/README.md`.

## Next
Wave 1 continues: 75-03 (compliance policies), 75-04 (IP-clause libs), 75-05 (secret-shape-detector).
