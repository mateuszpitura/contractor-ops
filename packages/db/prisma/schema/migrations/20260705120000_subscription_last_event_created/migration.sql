-- Subscription webhook ordering guard.
--
-- Additive only; no data loss. Adds one nullable column that stores the
-- `created` timestamp of the last Stripe event applied to the row. The webhook
-- handler (`packages/api/src/services/billing-webhook.ts`) skips any subscription
-- event whose `created` predates this value, so a delayed (Stripe retries for up
-- to 3 days) or out-of-order redelivery cannot resurrect stale state
-- (e.g. an old ACTIVE event clobbering a newer PAST_DUE / CANCELED).
--
-- Existing rows backfill to NULL, and the guard treats NULL as "no event applied
-- yet" — so the column is zero-backfill and safe to add online.
--
-- Apply per region (EU/ME/US) via `pnpm db:migrate:all`
-- (packages/db/scripts/migrate-all-regions.ts); prod apply stays a deferred ops
-- action under the local-only posture. Reversible via the paired down.sql.

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "lastEventCreated" TIMESTAMP(3);
