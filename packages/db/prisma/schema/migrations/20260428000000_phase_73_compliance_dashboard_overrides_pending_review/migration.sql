-- Phase 73 — Compliance dashboard, override columns, document status PENDING_REVIEW, dashboard index, audit-log GIN.
-- All changes are additive-only. Apply via `pnpm db:migrate:all` (packages/db/scripts/migrate-all-regions.ts) post-merge.

-- (1) New enum WaivedReasonCategory
CREATE TYPE "WaivedReasonCategory" AS ENUM (
  'CONTRACTOR_OFFBOARDED',
  'ENGAGEMENT_CHANGED',
  'REGULATORY_EXEMPTION',
  'TEMPORARY_GRACE_PERIOD',
  'ADMIN_CORRECTION',
  'OTHER'
);

-- (2,3) Two new nullable columns on ContractorComplianceItem
ALTER TABLE "ContractorComplianceItem"
  ADD COLUMN "waivedReasonCategory" "WaivedReasonCategory",
  ADD COLUMN "waivedReasonNote" TEXT;

-- (4) Document status enum extension — must run outside transaction; Prisma's
-- raw migration file already runs each statement in its own tx context per
-- Phase 71 D-09 / Phase 72 D-08 precedent.
ALTER TYPE "DocumentStatus" ADD VALUE 'PENDING_REVIEW' AFTER 'ACTIVE';

-- (5) New composite index for D-02 admin dashboard "At risk" filter
CREATE INDEX "ContractorComplianceItem_organizationId_severity_status_expiresAt_idx"
  ON "ContractorComplianceItem" ("organizationId", "severity", "status", "expiresAt");

-- (6) Partial GIN index on AuditLog.metadataJson for D-13 history-timeline lookups.
-- Filtered to resourceType = 'CONTRACTOR' to keep the index small. Compliance
-- audit-log queries against the timeline use `metadataJson @> '{"itemId": "..."}'::jsonb`.
CREATE INDEX "AuditLog_metadata_itemId_idx"
  ON "AuditLog" USING GIN ("metadataJson")
  WHERE "resourceType" = 'CONTRACTOR';
