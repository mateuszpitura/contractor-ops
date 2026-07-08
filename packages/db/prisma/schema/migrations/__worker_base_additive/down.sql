-- Rollback for the additive Worker base migration (migration.sql in this dir).
--
-- Mechanical reverse of migration.sql, applied in the opposite order: drop the
-- Contractor.workerId unique index, drop the column, drop the Worker table and
-- its enum type. Contractor rows are never touched destructively; only the
-- added column is removed and any (orphaned) Worker rows go with the table.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility;
-- run only to reverse the additive step at the blocking human migration gate.

-- DropIndex
DROP INDEX "Contractor_workerId_key";

-- AlterTable
ALTER TABLE "Contractor" DROP COLUMN "workerId";

-- DropTable
DROP TABLE "Worker";

-- DropEnum
DROP TYPE "WorkerType";
