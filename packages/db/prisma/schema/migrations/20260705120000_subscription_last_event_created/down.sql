-- Rollback for migration.sql in this directory. Drops only the column this
-- migration added; no pre-existing data is touched. Run only at the migration gate.

-- DropColumn
ALTER TABLE "Subscription" DROP COLUMN "lastEventCreated";
