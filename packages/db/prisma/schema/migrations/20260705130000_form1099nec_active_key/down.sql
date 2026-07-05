-- Rollback for the Form1099Nec ACTIVE-row partial unique (migration.sql in this
-- dir). Drops only the added index; no table or row is touched, so a rollback
-- restores the exact pre-migration state.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility; run
-- only to reverse the additive step at the blocking human migration gate.

-- DropIndex
DROP INDEX "Form1099Nec_active_key";
