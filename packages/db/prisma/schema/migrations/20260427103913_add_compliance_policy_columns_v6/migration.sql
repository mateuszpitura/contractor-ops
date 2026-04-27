-- Phase 71 D-05..D-08, D-11 — compliance policy schema additions.
--
-- Forward-only, additive migration. Adds 4 nullable columns to
-- ContractorComplianceItem, 1 nullable column to ClassificationAssessment,
-- 2 new enums (Severity, WaivedReason), and 1 new index on
-- (organizationId, policyRuleId) to support drift queries by stable namespace.
--
-- No DROP, RENAME, UPDATE, or INSERT statements. All new columns are NULLABLE
-- so existing rows remain valid until Plan 71-07 backfill runs.
--
-- Multi-region apply (EU + ME) is a manual post-deploy step per Standing
-- Constraint (LOCAL-ONLY) — see push-all-regions.ts. Both regions must be on
-- the same migration version before Plan 71-04 lands.

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('BLOCKING', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "WaivedReason" AS ENUM ('superseded_by_policy_version', 'classification_outcome_change', 'admin_manual_waive', 'contractor_offboarded');

-- AlterTable
ALTER TABLE "ContractorComplianceItem"
  ADD COLUMN "severity" "Severity",
  ADD COLUMN "policyRuleId" TEXT,
  ADD COLUMN "expiryJurisdictionTz" TEXT,
  ADD COLUMN "waivedReason" "WaivedReason";

-- AlterTable
ALTER TABLE "ClassificationAssessment"
  ADD COLUMN "policyRuleSetVersion" TEXT;

-- CreateIndex
CREATE INDEX "ContractorComplianceItem_organizationId_policyRuleId_idx"
  ON "ContractorComplianceItem"("organizationId", "policyRuleId");
