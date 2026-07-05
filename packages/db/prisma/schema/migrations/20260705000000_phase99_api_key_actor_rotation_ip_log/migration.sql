-- Theme C — API-key actor model + rotation-with-grace + source-IP log.
-- Additive and reversible; no data loss.
--   * OrganizationApiKey."actingUserId" — mutable attribution FK to User. Added
--     NULLABLE, backfilled from "createdByUserId" (every existing key attributes
--     to its creator), then set NOT NULL in the same migration.
--   * OrganizationApiKey rotation columns (all nullable, no backfill).
--   * "ApiKeyIpEvent" — bounded per-key source-IP log.
-- Apply per region (EU/ME/US) via `pnpm db:migrate:all` post-merge.

-- Step 1 — add actingUserId NULLABLE (so existing rows are valid mid-migration).
ALTER TABLE "OrganizationApiKey"
    ADD COLUMN "actingUserId" TEXT;

-- Step 2 — backfill: every existing key attributes to whoever created it.
UPDATE "OrganizationApiKey"
    SET "actingUserId" = "createdByUserId"
    WHERE "actingUserId" IS NULL;

-- Step 3 — now that every row has a value, enforce NOT NULL.
ALTER TABLE "OrganizationApiKey"
    ALTER COLUMN "actingUserId" SET NOT NULL;

-- Step 4 — rotation-with-grace columns (nullable; a key is only ever superseded
-- by an explicit rotate, so existing rows stay NULL).
ALTER TABLE "OrganizationApiKey"
    ADD COLUMN "supersededAt"      TIMESTAMP(3),
    ADD COLUMN "supersededByKeyId" TEXT,
    ADD COLUMN "graceExpiresAt"    TIMESTAMP(3);

-- Step 5 — source-IP log (append-on-auth, debounced + pruned).
CREATE TABLE "ApiKeyIpEvent" (
    "id"             TEXT NOT NULL,
    "apiKeyId"       TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ipAddress"      TEXT NOT NULL,
    "userAgent"      TEXT,
    "seenAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyIpEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes.
CREATE INDEX "OrganizationApiKey_actingUserId_idx" ON "OrganizationApiKey"("actingUserId");
CREATE INDEX "ApiKeyIpEvent_apiKeyId_seenAt_idx" ON "ApiKeyIpEvent"("apiKeyId", "seenAt");

-- Foreign keys.
ALTER TABLE "OrganizationApiKey"
    ADD CONSTRAINT "OrganizationApiKey_actingUserId_fkey"
    FOREIGN KEY ("actingUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApiKeyIpEvent"
    ADD CONSTRAINT "ApiKeyIpEvent_apiKeyId_fkey"
    FOREIGN KEY ("apiKeyId") REFERENCES "OrganizationApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
