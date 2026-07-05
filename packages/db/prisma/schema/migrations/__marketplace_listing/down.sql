-- Rollback for the marketplace-listing migration (migration.sql in this dir).
--
-- Drops the added table + the two new enums. The MARKETPLACE_LISTING EntityType
-- VALUE is NOT removed — Postgres cannot drop a single enum value; it remains
-- unused and harmless.
--
-- NOT APPLIED by codegen. Run only to reverse the additive step at the blocking
-- human migration gate.

-- DropTable
DROP TABLE "MarketplaceListing";

-- DropEnum
DROP TYPE "MarketplaceListingStatus";

-- DropEnum
DROP TYPE "MarketplacePlatform";
