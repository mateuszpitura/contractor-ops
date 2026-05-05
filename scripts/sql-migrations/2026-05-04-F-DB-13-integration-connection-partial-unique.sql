-- F-DB-13 — IntegrationConnection partial-unique semantics
--
-- Postgres can express partial-unique semantics that Prisma 7 cannot. The
-- Prisma schema currently declares
--   @@unique([organizationId, provider, userId])
-- which Postgres implements with NULLs treated as distinct, so two rows
-- with the same (organizationId, provider) but userId IS NULL both pass
-- the constraint. The reconnect / OAuth-refresh flow can then race and
-- create two CONNECTED org-level connections for the same provider, and
-- `findFirst` picks one nondeterministically.
--
-- This migration replaces the imprecise constraint with two partial
-- indexes:
--   - per-user uniqueness (only when userId IS NOT NULL)
--   - org-level uniqueness (only when userId IS NULL)
-- so the DB enforces "at most one CONNECTED row per provider per scope".
--
-- After applying this migration, run
--   pnpm --filter @contractor-ops/db db:generate
-- to regenerate the Prisma client. The generated SQL will not match the
-- DB exactly anymore (Prisma can't model partial uniques inline), so we
-- accept that drift and document it here as expected.

BEGIN;

-- 1. Drop the imprecise existing @@unique that Prisma generated.
ALTER TABLE "IntegrationConnection"
  DROP CONSTRAINT IF EXISTS "IntegrationConnection_organizationId_provider_userId_key";
DROP INDEX IF EXISTS "integration_connection_org_provider_user_uniq";

-- 2. Per-user uniqueness (partial: only when userId IS NOT NULL).
CREATE UNIQUE INDEX integration_connection_org_provider_user_uniq
  ON "IntegrationConnection" ("organizationId", "provider", "userId")
  WHERE "userId" IS NOT NULL;

-- 3. Org-level (no per-user) uniqueness (partial: only when userId IS NULL).
CREATE UNIQUE INDEX integration_connection_org_provider_org_uniq
  ON "IntegrationConnection" ("organizationId", "provider")
  WHERE "userId" IS NULL;

COMMIT;

-- Rollback:
--   BEGIN;
--   DROP INDEX IF EXISTS integration_connection_org_provider_user_uniq;
--   DROP INDEX IF EXISTS integration_connection_org_provider_org_uniq;
--   ALTER TABLE "IntegrationConnection"
--     ADD CONSTRAINT "IntegrationConnection_organizationId_provider_userId_key"
--     UNIQUE ("organizationId", "provider", "userId");
--   COMMIT;
