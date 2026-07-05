-- Rollback for the additive EwidencjaSnapshot migration (migration.sql in this
-- dir). Mechanical reverse: drop the self-referential foreign key, then the table
-- (its indexes go with it), then the EwidencjaStatus enum. No existing table is
-- touched — only the added objects are removed, so a rollback restores the exact
-- pre-migration state. Reverse the append-only hardening
-- (20260701000000_ewidencja_append_only) first.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility; run
-- only to reverse the additive step at the blocking human migration gate.

-- DropForeignKey
ALTER TABLE "EwidencjaSnapshot" DROP CONSTRAINT "EwidencjaSnapshot_previousSnapshotId_fkey";

-- DropTable
DROP TABLE "EwidencjaSnapshot";

-- DropEnum
DROP TYPE "EwidencjaStatus";
