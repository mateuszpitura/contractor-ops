# Phase 74 — Offboarding Foundation Migration

**Status:** code shipped — multi-region apply pending human supervision.

## What this migration adds (additive-only)

- 2 new tables: `WorkflowRoleTemplate`, `WorkflowRoleTaskTemplate`
- 7 new columns:
  - `Contractor.workflowRoleId` (nullable FK → WorkflowRoleTemplate.id)
  - `Team.fallbackApproverId` (nullable FK → User.id)
  - `User.outOfOffice` (JSONB)
  - `WorkflowRun.overriddenTemplateId` (nullable)
  - `WorkflowRun.overriddenByUserId` (nullable)
  - `WorkflowRun.overriddenAt` (nullable)
  - `WorkflowRun.overrideMetadata` (JSONB)
- 2 new `WorkflowTaskType` enum values: `IP_VERIFICATION`, `CONTRACT_HEALTH_CHECK`
- 5 new indexes:
  - `WorkflowRoleTemplate(organizationId)`
  - `WorkflowRoleTemplate(organizationId, isSeed)`
  - `WorkflowRoleTaskTemplate(organizationId)`
  - `WorkflowRoleTaskTemplate(organizationId, workflowRoleTemplateId, sortOrder)`
  - `Contractor(organizationId, workflowRoleId)`
- 2 new unique constraints:
  - `WorkflowRoleTemplate(organizationId, role)`
  - `WorkflowRoleTaskTemplate(workflowRoleTemplateId, sortOrder)`
- 5 new foreign keys (Contractor.workflowRoleId, Team.fallbackApproverId,
  WorkflowRoleTemplate.organizationId, WorkflowRoleTaskTemplate.organizationId,
  WorkflowRoleTaskTemplate.workflowRoleTemplateId)

## Multi-region apply procedure (LOCAL-ONLY → post-merge)

Run from a deploy workstation (NOT a background agent session). Mirrors Phase 70 Plan 09 / Phase 71 Plan 03 / Phase 76 Plan 02.

```sh
# Step 1 — EU region dry run
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/push-all-regions.ts --dry-run

# Step 2 — EU region apply
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/push-all-regions.ts

# Step 3 — ME region dry run
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/push-all-regions.ts --dry-run

# Step 4 — ME region apply
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/push-all-regions.ts
```

## Idempotency

`ALTER TYPE ... ADD VALUE` is idempotent on Postgres 15.4+ when wrapped in the
migration script's per-statement transactional retry; `ADD COLUMN` and
`CREATE TABLE` are NOT inherently idempotent, but `_prisma_migrations` tracks
applied migrations so re-running this directory is safe (Prisma skips the
`migration.sql` re-execution if the row already exists with a matching
checksum).

If a partial-failure leaves the DB in a half-applied state, manually reconcile
by inspecting `information_schema.columns` and `pg_enum` (see Verification
post-apply below) and re-applying the missing pieces by hand before re-running.

## Rollback

Forward-only. To revert, ship a follow-up migration that drops the columns/tables
in reverse-dependency order:
1. Drop FKs on Contractor.workflowRoleId, Team.fallbackApproverId, etc.
2. Drop tables WorkflowRoleTaskTemplate then WorkflowRoleTemplate.
3. Drop columns from WorkflowRun, User, Team, Contractor.
4. Postgres does NOT support `ALTER TYPE ... DROP VALUE`; the enum values
   IP_VERIFICATION + CONTRACT_HEALTH_CHECK become orphaned on rollback —
   acceptable since they have no rows yet.

Do NOT manually `DROP` — capture in code so audit trail survives.

## Verification post-apply

```sh
DATABASE_URL=$DATABASE_URL_EU psql -c "SELECT column_name FROM information_schema.columns WHERE table_name='WorkflowRun' AND column_name LIKE 'override%';"
# Expected: overriddenTemplateId, overriddenByUserId, overriddenAt, overrideMetadata

DATABASE_URL=$DATABASE_URL_EU psql -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname='WorkflowTaskType');"
# Expected: includes IP_VERIFICATION, CONTRACT_HEALTH_CHECK

DATABASE_URL=$DATABASE_URL_EU psql -c "\d \"WorkflowRoleTemplate\""
# Expected: 11 columns including organizationId, role, isSeed, displayName{En,Pl,De}
```

Repeat for ME.

## Recording in STATE.md

Once both regions apply cleanly, append to STATE.md "Deferred Items" table:

| Category | Phase | File | Status | Disposition |
|----------|-------|------|--------|-------------|
| migration_apply | 74 | 74-04-SUMMARY.md | code shipped — multi-region apply pending | EU + ME applied YYYY-MM-DD |

## Threat reference

See `74-RESEARCH.md` § Risk Register R5 (multi-region schema drift) and
T-74-04-schema-drop / T-74-04-region-drift in `74-04-PLAN.md`.

## Migration generation note

This `migration.sql` was hand-authored following the Phase 71 Plan 03 exemplar
(`20260427103913_add_compliance_policy_columns_v6/migration.sql`) because the
local shadow-database setup that `prisma migrate dev --create-only` requires
was not available in the build environment. The schema and SQL were
cross-verified manually for additive-only correctness:

- Zero `DROP TABLE` / `DROP COLUMN` / `DROP CONSTRAINT` statements.
- Zero `RENAME` statements (the word "RENAME" only appears in the
  file-header comment NEGATING its use).
- Zero `ALTER COLUMN ... TYPE` statements.
- All new columns are NULLABLE.
- All new FK constraints use `ON DELETE SET NULL` (or CASCADE for child-of-template
  rows) — no parent-row orphan risk.
