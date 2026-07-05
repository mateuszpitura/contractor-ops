-- Public-API sandbox environment axis (additive, reversible).
--
-- Two additive pieces, no backfill:
--   1. Organization.isSandbox — a persistent marker for a free-forever sandbox
--      org. A sandbox org holds only seeded fixture data and inherits the demo
--      read-only isolation, so it fires no real side-effect.
--   2. A new ApiKeyEnvironment enum + OrganizationApiKey.environment (default
--      LIVE) — the axis that distinguishes production (`co_live_`) keys from
--      sandbox (`co_test_`) keys. resolveByPrefix fails closed on any
--      environment<->isSandbox mismatch, so a sandbox key can never resolve to a
--      production org.
--
-- Existing rows default to isSandbox=false / environment=LIVE, i.e. their
-- current behaviour is unchanged. Applying to a populated database performs NO
-- backfill.
--
-- ORDERING: standalone — touches only Organization + OrganizationApiKey, both
-- of which exist in every region.
--
-- Reversibility: the paired down.sql drops both columns + the enum.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME,
-- then US) at the blocking human migration gate.

-- CreateEnum
CREATE TYPE "ApiKeyEnvironment" AS ENUM ('LIVE', 'SANDBOX');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "isSandbox" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrganizationApiKey" ADD COLUMN "environment" "ApiKeyEnvironment" NOT NULL DEFAULT 'LIVE';
