# Plan 95-03 Summary — connection + model layer (enum, partial index, mapping)

**Wave:** 2 · **Status:** complete

## What shipped

| File | Provides |
|------|----------|
| `packages/db/prisma/schema/integration.prisma` | `IntegrationProvider` gains `PERSONIO` + `BAMBOOHR` (UPPER_SNAKE_CASE) |
| `packages/db/prisma/schema/migrations/__20260705120000_hris_two_way_sync/migration.sql` | `ALTER TYPE ADD VALUE` (both) + the one-HRIS-per-org **raw-SQL partial unique index** |
| `.../__20260705120000_hris_two_way_sync/down.sql` | reversal (drop index; enum members are inert, un-droppable in PG) |
| `packages/api/src/services/hris-sync/mapping.ts` | `hrisFieldMappingSchema` (.strict), `resolveMapping`, `defaultMappingFor`, `readSyncState`/`writeSyncState`, `publicHrisConfig`, `isOneHrisPerOrgViolation` + `ONE_HRIS_PER_ORG_INDEX` |

## Key decisions

- **One HRIS per org = raw-SQL partial unique index** (C2): `CREATE UNIQUE INDEX "integration_connection_one_hris_per_org" ON "IntegrationConnection"("organizationId") WHERE "provider"::text IN ('PERSONIO','BAMBOOHR')`. Prisma `@@unique` cannot filter, so it lives in the migration body, not the model.
- **Postgres new-enum-value-in-same-transaction gotcha handled:** the index predicate casts the column to text (`"provider"::text IN (...)`) instead of using the enum literals `'PERSONIO'::"IntegrationProvider"`. A newly-added enum value cannot be referenced as an enum literal in the transaction that added it ("unsafe use of new value"); the enum→text output cast is immutable (valid in an index predicate) and references no enum literal, so `ADD VALUE` + index coexist in one migration. Documented in the migration header for the deploy applier.
- **`publicHrisConfig(configJson)` returns `{ mapping }` only** — never `credentialsRef` or the raw sync-state (delta cursor + per-record hashes). Provider is surfaced separately from the connection column (not duplicated into configJson).
- **Migration is `__`-prefixed / unapplied** (drift-blocked posture); Prisma client regenerated so code compiles; applied per region at the deploy gate.

## Verification

- `pnpm --filter @contractor-ops/db exec prisma generate` (dummy DATABASE_URL — generate does not connect) + `db build` + `prisma validate` → schema valid.
- `pnpm -F @contractor-ops/api test mapping hris-one-per-org` → 25 passed. The `hris-one-per-org` RED test (95-02) is now GREEN via `isOneHrisPerOrgViolation` + `ONE_HRIS_PER_ORG_INDEX`.
- `pnpm typecheck --filter=@contractor-ops/api` → 16/16 green.
- `pnpm lint:raw-sql` green. `db:audit-enum-casing`: PERSONIO/BAMBOOHR are UPPER_SNAKE_CASE and NOT flagged (the audit's failure is pre-existing snake_case `ManualOverrideCategory` values from Phase 93, unrelated to this change).

## Deferred (EXTERNAL-ENABLEMENT)

- Migration apply to regional `DATABASE_URL_*` is a deploy-time human step (registered in Plan 09 docs). The SQL is generated + committed; the client compiles without a live DB.
