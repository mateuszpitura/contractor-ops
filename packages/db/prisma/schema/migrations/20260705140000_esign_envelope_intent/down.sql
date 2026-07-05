-- Rollback for the additive EsignEnvelopeIntent migration (migration.sql in this
-- dir). Mechanical reverse: drop the foreign key, then drop the table (its indexes
-- go with it). No existing table is touched — only the added objects are removed,
-- so a rollback restores the exact pre-migration state.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility; run
-- only to reverse the additive step at the blocking human migration gate.

-- DropForeignKey
ALTER TABLE "EsignEnvelopeIntent" DROP CONSTRAINT "EsignEnvelopeIntent_organizationId_fkey";

-- DropTable
DROP TABLE "EsignEnvelopeIntent";
