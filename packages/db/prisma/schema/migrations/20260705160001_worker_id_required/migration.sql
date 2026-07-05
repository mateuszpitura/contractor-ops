-- Enforce the Contractor → Worker link: workerId NOT NULL + foreign key.
--
-- This is the SECOND of the two-step Worker migration. It is the strict successor
-- of 20260705160000_worker_base_additive (which created Worker and added the
-- NULLABLE Contractor.workerId column + unique index). It promotes the column to
-- NOT NULL and adds the foreign-key constraint that makes the sidecar 1:1 link
-- DB-enforced.
--
-- ORDERING IS LOAD-BEARING: this migration MUST run only after the backfill
-- (scripts/backfill-worker.ts) has set Contractor.workerId for every existing row
-- in the target region AND largest-org staging-snapshot contractor parity has been
-- signed off. Running it before the backfill (or in the same migration that added
-- the column) would reject every existing null row. On a fresh replay (no
-- Contractor rows) the NOT NULL promotion is trivially satisfied.
--
-- Reversibility: undone by the paired down.sql in this directory (drop the FK,
-- drop NOT NULL). No Contractor row is touched destructively.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region at the
-- [BLOCKING] human migration gate, after the backfill + parity sign-off.

-- AlterTable (enforce NOT NULL — every row must already be backfilled)
ALTER TABLE "Contractor" ALTER COLUMN "workerId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
