# SQL migrations

Hand-rolled SQL migrations for changes that Prisma 7's schema language
cannot fully express (partial unique indexes, deduplication-then-unique
flows, redundant index cleanup that Prisma's `migrate deploy` does not perform).

These run **in addition to** the Prisma-managed schema. After applying
them, regenerate the Prisma client so the codegen reflects the
post-migration state:

```sh
pnpm --filter @contractor-ops/db db:generate
```

## Run order

Apply in this order:

1. `2026-05-04-F-DB-14-signing-envelope-dedupe-and-unique.sql`
2. `2026-05-04-F-DB-13-integration-connection-partial-unique.sql`
3. `2026-05-04-F-DB-17-drop-redundant-einvoice-lifecycle-unique.sql`

F-DB-14 must run before F-DB-13 because the SigningEnvelope dedupe is the
prerequisite for letting the next Prisma `db push` reconcile cleanly. The
F-DB-13 partial-unique migration drops a Prisma-managed constraint and
replaces it with two partial indexes that Prisma can no longer express
inline — running F-DB-13 first leaves the schema in a state where Prisma
will try to recreate the dropped constraint on the next `migrate deploy`. Apply
F-DB-13 only when you are ready to also accept the schema-vs-DB drift it
introduces (documented in the migration file).

F-DB-17 is independent and can run at any time.

## Prerequisites

- `psql` with connectivity to each Neon region (currently `EU` and `ME`).
- Connection strings for each region — use the `DATABASE_URL_EU` and
  `DATABASE_URL_ME` env vars exactly as used by the application.
- Standard `CREATE`/`DROP INDEX` privileges on the application schema.
  Superuser is **not** required.
- Recent backup. F-DB-14's dedupe step is destructive (DELETE).

## How to apply

For each region, run each migration file in the order above:

```sh
psql "$DATABASE_URL_EU" -f scripts/sql-migrations/2026-05-04-F-DB-14-signing-envelope-dedupe-and-unique.sql
psql "$DATABASE_URL_EU" -f scripts/sql-migrations/2026-05-04-F-DB-13-integration-connection-partial-unique.sql
psql "$DATABASE_URL_EU" -f scripts/sql-migrations/2026-05-04-F-DB-17-drop-redundant-einvoice-lifecycle-unique.sql

psql "$DATABASE_URL_ME" -f scripts/sql-migrations/2026-05-04-F-DB-14-signing-envelope-dedupe-and-unique.sql
psql "$DATABASE_URL_ME" -f scripts/sql-migrations/2026-05-04-F-DB-13-integration-connection-partial-unique.sql
psql "$DATABASE_URL_ME" -f scripts/sql-migrations/2026-05-04-F-DB-17-drop-redundant-einvoice-lifecycle-unique.sql
```

Each migration is wrapped in a single `BEGIN ... COMMIT;` so a failure
mid-script leaves the DB in the pre-migration state.

After all regions are migrated:

```sh
pnpm --filter @contractor-ops/db db:generate
```

## Rollback

Each migration file has a `Rollback:` block at the bottom showing the
exact statements to reverse it.

- **F-DB-13**: drop the two partial indexes and recreate the original
  full-tuple unique constraint. Reversible.
- **F-DB-14**: drop the partial unique index. The dedupe DELETE is **not**
  reversible without a database backup — the kept rows are the newest per
  `(provider, externalEnvelopeId)` pair, which matches application
  intent, but if you need the deleted rows for forensic purposes restore
  them from a backup snapshot taken before the migration.
- **F-DB-17**: recreate the redundant composite unique index. Reversible
  (and idempotent — `IF NOT EXISTS` is implicit on the recreate path).

## Why these aren't Prisma migrations

Prisma 7's schema DSL has known limitations:

- **Partial unique indexes** (`WHERE ... IS NOT NULL`) — F-DB-13 and
  F-DB-14 both depend on partial uniques to express "unique only when
  this column is set". Prisma's `@@unique` always creates a full-tuple
  unique constraint, which treats `NULL` as distinct in Postgres.
- **Conditional dedupe-before-constraint** — Prisma can't run a `DELETE`
  step before applying a constraint, so adding a partial unique to a
  table with existing duplicates fails.
- **Drop redundant index that schema previously declared but no longer
  does** — Prisma's `migrate deploy` is non-destructive of indexes by design;
  F-DB-17's redundant index has to be removed manually.

When future schema changes need similar capabilities, prefer to add a
new SQL file here rather than fighting the Prisma DSL.
