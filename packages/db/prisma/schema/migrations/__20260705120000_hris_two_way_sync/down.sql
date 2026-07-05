-- Rollback for the additive HRIS two-way sync migration (migration.sql in this dir).
--
-- Drops the one-HRIS-per-org partial unique index. Postgres has no
-- ALTER TYPE ... DROP VALUE, so the two additive IntegrationProvider members
-- ('PERSONIO', 'BAMBOOHR') CANNOT be removed — they are inert unless a row uses
-- them; leaving them is harmless and standard for additive enum rollbacks.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility; run
-- only to reverse the additive step at the blocking human migration gate.

-- DropIndex
DROP INDEX IF EXISTS "integration_connection_one_hris_per_org";
