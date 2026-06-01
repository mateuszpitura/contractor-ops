-- Phase 76 WR-1 security fix — scope DeprovisioningRun.idempotencyKey per-org.
--
-- The original migration (20260531164549_phase76_idp_deprovisioning) created a
-- GLOBAL unique index on idempotencyKey alone. This allowed one tenant to squat
-- or DoS another tenant's keys (cross-tenant collision), and the P2002 recovery
-- path relied on RLS alone to prevent IDOR.
--
-- This migration replaces the global single-column unique with a composite
-- (organizationId, idempotencyKey) unique, which scopes deduplication strictly
-- per org. The P2002 recovery lookup in the tRPC mutation has been updated to
-- use the composite key (organizationId_idempotencyKey) accordingly.
--
-- Additive/safe: DROP INDEX + CREATE UNIQUE INDEX — no data loss.
-- Multi-region apply (EU + ME) is a DEFERRED post-deploy step (LOCAL-ONLY).
-- See packages/db/scripts/README.md.

-- DropIndex (global single-column unique)
DROP INDEX "DeprovisioningRun_idempotencyKey_key";

-- CreateIndex (composite per-org unique)
CREATE UNIQUE INDEX "DeprovisioningRun_organizationId_idempotencyKey_key" ON "DeprovisioningRun"("organizationId", "idempotencyKey");
