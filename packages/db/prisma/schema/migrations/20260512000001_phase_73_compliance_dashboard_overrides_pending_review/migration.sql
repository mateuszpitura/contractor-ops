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

-- (5) New composite index for D-02 admin dashboard "At risk" filter.
-- NOTE: builds with ACCESS EXCLUSIVE lock. On a populated prod table consider
-- running CONCURRENTLY in a separate non-transactional migration step (CF-I2).
CREATE INDEX "ContractorComplianceItem_organizationId_severity_status_expiresAt_idx"
  ON "ContractorComplianceItem" ("organizationId", "severity", "status", "expiresAt");

-- (6) Partial GIN index on AuditLog.metadataJson, filtered to resourceType = 'CONTRACTOR'.
-- NOTE: GIN indexes accelerate containment (@>) queries, not path-equality predicates.
-- The D-13 itemAuditTrail procedure uses `metadataJson.path=['itemId'].equals=...`
-- (a path-equality predicate), which cannot use this GIN index. The btree index on
-- (organizationId, resourceType, resourceId) covers that query in practice. This GIN
-- index is retained for any future @>-style containment lookups on AuditLog (CF-I1).
-- NOTE: builds with ACCESS EXCLUSIVE lock — same CONCURRENTLY caveat as index (5).
CREATE INDEX "AuditLog_metadata_itemId_idx"
  ON "AuditLog" USING GIN ("metadataJson")
  WHERE "resourceType" = 'CONTRACTOR';
