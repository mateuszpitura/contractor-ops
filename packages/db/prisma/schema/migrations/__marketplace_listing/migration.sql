-- Marketplace listing tracker + the two new EntityType audit values (additive,
-- reversible).
--
-- Three additive pieces, no backfill:
--   1. Two new enums (MarketplacePlatform, MarketplaceListingStatus) + the
--      MarketplaceListing table — one row per marketplace the product's own
--      integration is listed on, tracking its external review state. Global
--      (NOT tenant-scoped): no organizationId, no RLS — a platform-operator
--      resource, never customer data.
--   2. EntityType gains MARKETPLACE_LISTING (audited by the listing router).
--
-- Every object is new; no existing table or row is touched. Applying to a
-- populated database performs NO backfill.
--
-- ORDERING: standalone — depends on nothing beyond the EntityType enum, which
-- already exists in every region.
--
-- Reversibility: the paired down.sql drops only the added objects. Note that
-- Postgres cannot DROP a single enum VALUE, so the down reverses the table +
-- the two new enums but leaves the MARKETPLACE_LISTING EntityType value in place
-- (harmless, unused) — the same one-way posture every enum-value addition carries.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME,
-- then US) at the blocking human migration gate.

-- CreateEnum
CREATE TYPE "MarketplacePlatform" AS ENUM ('ZAPIER', 'N8N', 'MAKE');

-- CreateEnum
CREATE TYPE "MarketplaceListingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'LIVE', 'REJECTED', 'NEEDS_CHANGES');

-- AlterEnum (EntityType — audit resource type for the marketplace listing router)
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_LISTING';

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "platform" "MarketplacePlatform" NOT NULL,
    "status" "MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "versionPin" TEXT NOT NULL,
    "lastReviewFeedback" TEXT,
    "listingUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "wentLiveAt" TIMESTAMP(3),
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceListing_platform_key" ON "MarketplaceListing"("platform");
