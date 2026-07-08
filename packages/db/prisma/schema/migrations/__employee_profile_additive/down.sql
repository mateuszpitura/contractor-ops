-- Rollback for the additive EmployeeProfile migration (migration.sql in this dir).
--
-- Mechanical reverse of migration.sql, applied in the opposite order: drop the
-- two foreign keys, drop the EmployeeProfile table (its indexes go with it), then
-- drop the EmploymentStatus enum type. No existing table is touched — only the
-- added objects are removed, so a rollback restores the exact pre-migration state.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility; run
-- only to reverse the additive step at the blocking human migration gate.

-- DropForeignKey
ALTER TABLE "EmployeeProfile" DROP CONSTRAINT "EmployeeProfile_workerId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeProfile" DROP CONSTRAINT "EmployeeProfile_organizationId_fkey";

-- DropTable
DROP TABLE "EmployeeProfile";

-- DropEnum
DROP TYPE "EmploymentStatus";
