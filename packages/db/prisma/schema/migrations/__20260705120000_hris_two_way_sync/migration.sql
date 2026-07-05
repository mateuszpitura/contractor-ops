-- HRIS two-way sync connection layer (additive, reversible).
--
-- Adds two IntegrationProvider members (PERSONIO, BAMBOOHR) and the
-- one-HRIS-per-org invariant as a raw-SQL PARTIAL unique index. Prisma's
-- `@@unique` cannot express a filtered index (the schema documents this for
-- WebhookDelivery), so the "at most one HRIS connection per org" rule — which
-- must hold only for the two HRIS providers, not every provider — lives here as
-- hand-written DDL rather than in the Prisma model.
--
-- POSTGRES ENUM CAVEAT: a newly-added enum value cannot be referenced as an enum
-- literal in the same transaction that added it ("unsafe use of new value").
-- The index predicate therefore compares the enum column CAST TO TEXT against
-- text literals (`"provider"::text IN ('PERSONIO','BAMBOOHR')`) — the enum->text
-- output cast is immutable (valid in an index predicate) and references no enum
-- literal, so the ADD VALUE statements and the index can live in one migration.
-- If your apply tool wraps the whole file in a single transaction and still
-- rejects it, COMMIT after the two ALTER TYPE statements, then create the index.
--
-- Additive only: existing rows are untouched. The partial unique index cannot
-- fail on apply because no existing IntegrationConnection row has provider
-- PERSONIO or BAMBOOHR yet, so the filtered set is empty.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME,
-- then US) at the blocking human migration gate.

-- AlterEnum
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'PERSONIO';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'BAMBOOHR';

-- CreateIndex — one HRIS connection per org (Personio XOR BambooHR).
-- Partial unique index on organizationId, scoped to the two HRIS providers.
CREATE UNIQUE INDEX IF NOT EXISTS "integration_connection_one_hris_per_org"
    ON "IntegrationConnection" ("organizationId")
    WHERE "provider"::text IN ('PERSONIO', 'BAMBOOHR');
