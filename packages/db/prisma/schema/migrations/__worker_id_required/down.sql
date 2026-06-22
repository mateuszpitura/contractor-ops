-- Rollback for the workerId NOT NULL + FK enforcement (migration.sql in this dir).
--
-- Mechanical reverse of migration.sql, applied in the opposite order: drop the
-- foreign-key constraint, then drop NOT NULL so the column is nullable again.
-- This returns the schema to the post-Migration-A state (nullable workerId,
-- unique index, no FK), from which __worker_base_additive/down.sql can further
-- reverse the additive step. No Contractor row is touched destructively.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility;
-- run only to reverse the enforcement step at the [BLOCKING] human migration gate.

-- DropForeignKey
ALTER TABLE "Contractor" DROP CONSTRAINT "Contractor_workerId_fkey";

-- AlterTable (back to nullable)
ALTER TABLE "Contractor" ALTER COLUMN "workerId" DROP NOT NULL;
