-- F-DB-14 — SigningEnvelope dedupe + (provider, externalEnvelopeId) unique
--
-- Phase 3 added @@unique([provider, externalEnvelopeId]) to the schema.
-- Prisma's `db push` refused on environments that already had duplicate
-- rows (a retry-of-CREATE-that-actually-succeeded scenario, or a webhook
-- replay that re-issued the create against the same external id). This
-- migration deduplicates first, then enforces the partial unique index
-- that Prisma's schema annotation cannot fully express (we want
-- uniqueness only when externalEnvelopeId IS NOT NULL — null = pending
-- create).
--
-- Strategy: keep the newest row per (provider, externalEnvelopeId). The
-- newest row has the most recent `createdAt`, which is the most likely
-- to reflect the truthful final state because each CREATE on the
-- esign provider returns a fresh externalEnvelopeId so duplicates only
-- exist when the local row failed to persist on the first attempt and a
-- retry succeeded — the second row carries the final state.
--
-- After applying this migration, run
--   pnpm --filter @contractor-ops/db db:generate
-- so the Prisma client picks up the schema's @@unique annotation cleanly.

BEGIN;

-- 1. Dedupe: keep newest per (provider, externalEnvelopeId).
DELETE FROM "SigningEnvelope" se
WHERE se.id NOT IN (
  SELECT DISTINCT ON ("provider", "externalEnvelopeId") id
  FROM "SigningEnvelope"
  WHERE "externalEnvelopeId" IS NOT NULL
  ORDER BY "provider", "externalEnvelopeId", "createdAt" DESC
)
AND "externalEnvelopeId" IS NOT NULL;

-- 2. Enforce uniqueness via partial index. Partial because rows pending
-- create have externalEnvelopeId IS NULL and must be allowed to coexist.
CREATE UNIQUE INDEX signing_envelope_provider_external_uniq
  ON "SigningEnvelope" ("provider", "externalEnvelopeId")
  WHERE "externalEnvelopeId" IS NOT NULL;

COMMIT;

-- Rollback:
--   BEGIN;
--   DROP INDEX IF EXISTS signing_envelope_provider_external_uniq;
--   COMMIT;
--   -- Note: the dedupe step is destructive and not reversible without a
--   -- backup. The DELETE keeps the most recent row per provider+external
--   -- pair, which matches application intent; restoring duplicates would
--   -- only be useful for forensic analysis from a backup.
