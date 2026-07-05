-- Rollback for the additive gulf-domain migration (migration.sql in this dir).
-- Mechanical reverse: drop the foreign keys, then the four tables (their indexes
-- go with them), then the UaeFreeZoneCode enum. NitaqatBand is NOT dropped here —
-- it is owned by 20260705160003_employee_profile_additive and its down.sql. No
-- existing table is touched — only the added objects are removed, so a rollback
-- restores the exact pre-migration state.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility; run
-- only to reverse the additive step at the blocking human migration gate.

-- DropForeignKey
ALTER TABLE "SaudiHeadcount" DROP CONSTRAINT "SaudiHeadcount_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "SaudizationConfig" DROP CONSTRAINT "SaudizationConfig_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "FreeZoneAssignment" DROP CONSTRAINT "FreeZoneAssignment_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "FreeZoneAssignment" DROP CONSTRAINT "FreeZoneAssignment_organizationId_fkey";

-- DropTable
DROP TABLE "UaeFreeZone";

-- DropTable
DROP TABLE "SaudiHeadcount";

-- DropTable
DROP TABLE "SaudizationConfig";

-- DropTable
DROP TABLE "FreeZoneAssignment";

-- DropEnum
DROP TYPE "UaeFreeZoneCode";
