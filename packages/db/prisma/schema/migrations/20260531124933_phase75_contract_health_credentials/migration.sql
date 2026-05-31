-- Phase 75 — Contract health check + Credential vault
-- Additive migration:
--   * 5 new nullable columns on "Contract" (no data loss)
--   * 1 new DocumentType enum value (IP_RATIFICATION)
--   * 2 new tables: "ContractHealthCheckRun" (D-02), "CredentialReference" (D-10)
--   * 6 new enums (3 contract-health + 3 credential-vault)
--   * D-03 partial unique dedup index (raw SQL — Prisma cannot express filtered uniques)
--   * RLS policies for both new org-scoped tables (mirrors the org-scoped table pattern)

-- AlterEnum
-- IP_RATIFICATION is a post-sign artefact created by e-sign completion (D-08).
-- Emitted before any use; not referenced by data writes in this migration.
ALTER TYPE "DocumentType" ADD VALUE 'IP_RATIFICATION';

-- CreateEnum
CREATE TYPE "IpAssignmentVerdict" AS ENUM ('LIKELY_PRESENT', 'LIKELY_MISSING', 'MANUAL_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RunTrigger" AS ENUM ('UPLOAD', 'MANUAL', 'MODEL_BUMP_BULK');

-- CreateEnum
CREATE TYPE "VaultProvider" AS ENUM ('ONE_PASSWORD', 'BITWARDEN', 'HASHICORP_VAULT', 'AWS_SECRETS_MANAGER', 'GCP_SECRET_MANAGER', 'AZURE_KEY_VAULT', 'OTHER');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('AWS', 'GITHUB', 'GCP', 'AZURE', 'DATABASE', 'API_KEY', 'SSH_KEY', 'OTHER');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('PENDING', 'ROTATED', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "Contract"
    ADD COLUMN "complianceFlagsJson"      JSONB,
    ADD COLUMN "complianceFlagsCheckedAt" TIMESTAMP(3),
    ADD COLUMN "complianceFlagsModelVer"  TEXT,
    ADD COLUMN "latestHealthCheckRunId"   TEXT,
    ADD COLUMN "jurisdiction"             CHAR(3);

-- CreateTable
CREATE TABLE "ContractHealthCheckRun" (
    "id"                TEXT                  NOT NULL,
    "organizationId"    TEXT                  NOT NULL,
    "contractId"        TEXT                  NOT NULL,
    "contentHash"       VARCHAR(64)           NOT NULL,
    "modelVer"          TEXT                  NOT NULL,
    "verdict"           "IpAssignmentVerdict" NOT NULL,
    "resultsJson"       JSONB                 NOT NULL,
    "status"            "RunStatus"           NOT NULL,
    "errorMessage"      TEXT,
    "startedAt"         TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"       TIMESTAMP(3),
    "triggeredBy"       "RunTrigger"          NOT NULL,
    "triggeredByUserId" TEXT,

    CONSTRAINT "ContractHealthCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialReference" (
    "id"              TEXT               NOT NULL,
    "organizationId"  TEXT               NOT NULL,
    "workflowRunId"   TEXT               NOT NULL,
    "label"           TEXT               NOT NULL,
    "vaultProvider"   "VaultProvider"    NOT NULL,
    "vaultUrl"        TEXT               NOT NULL,
    "accessType"      "AccessType"       NOT NULL,
    "successorUserId" TEXT,
    "status"          "CredentialStatus" NOT NULL DEFAULT 'PENDING',
    "rotatedAt"       TIMESTAMP(3),
    "rotatedByUserId" TEXT,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)       NOT NULL,

    CONSTRAINT "CredentialReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contract_organizationId_latestHealthCheckRunId_idx"
    ON "Contract" ("organizationId", "latestHealthCheckRunId");
CREATE INDEX "Contract_organizationId_jurisdiction_idx"
    ON "Contract" ("organizationId", "jurisdiction");

-- CreateIndex
CREATE INDEX "ContractHealthCheckRun_organizationId_contractId_startedAt_idx"
    ON "ContractHealthCheckRun" ("organizationId", "contractId", "startedAt" DESC);
CREATE INDEX "ContractHealthCheckRun_organizationId_status_idx"
    ON "ContractHealthCheckRun" ("organizationId", "status");

-- CreateIndex
CREATE INDEX "CredentialReference_organizationId_idx"
    ON "CredentialReference" ("organizationId");
CREATE INDEX "CredentialReference_organizationId_workflowRunId_idx"
    ON "CredentialReference" ("organizationId", "workflowRunId");
CREATE INDEX "CredentialReference_organizationId_successorUserId_idx"
    ON "CredentialReference" ("organizationId", "successorUserId");
CREATE INDEX "CredentialReference_organizationId_workflowRunId_status_idx"
    ON "CredentialReference" ("organizationId", "workflowRunId", "status");

-- AddForeignKey
ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_latestHealthCheckRunId_fkey"
        FOREIGN KEY ("latestHealthCheckRunId") REFERENCES "ContractHealthCheckRun" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractHealthCheckRun"
    ADD CONSTRAINT "ContractHealthCheckRun_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractHealthCheckRun"
    ADD CONSTRAINT "ContractHealthCheckRun_contractId_fkey"
        FOREIGN KEY ("contractId") REFERENCES "Contract" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialReference"
    ADD CONSTRAINT "CredentialReference_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CredentialReference"
    ADD CONSTRAINT "CredentialReference_workflowRunId_fkey"
        FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CredentialReference"
    ADD CONSTRAINT "CredentialReference_successorUserId_fkey"
        FOREIGN KEY ("successorUserId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CredentialReference"
    ADD CONSTRAINT "CredentialReference_rotatedByUserId_fkey"
        FOREIGN KEY ("rotatedByUserId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 75 D-03 — partial unique index for idempotency dedup
-- (Prisma cannot express filtered unique indexes; raw SQL is the documented escape hatch).
-- Same contract + same content + same model can only have ONE SUCCEEDED run;
-- FAILED / PENDING rows are not constrained so re-runs are always allowed.
CREATE UNIQUE INDEX "ContractHealthCheckRun_dedup_succeeded"
    ON "ContractHealthCheckRun" ("contractId", "contentHash", "modelVer")
    WHERE status = 'SUCCEEDED';

-- RLS — both new tables are org-scoped; mirror the org-scoped table pattern.
-- ContractHealthCheckRun: readable by org members; written by ops/admin + system jobs.
ALTER TABLE "ContractHealthCheckRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractHealthCheckRun" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contracthealthcheckrun_select ON "ContractHealthCheckRun";
CREATE POLICY contracthealthcheckrun_select ON "ContractHealthCheckRun"
  FOR SELECT
  USING (app.org_match("organizationId") AND app.is_org_member());

DROP POLICY IF EXISTS contracthealthcheckrun_write ON "ContractHealthCheckRun";
CREATE POLICY contracthealthcheckrun_write ON "ContractHealthCheckRun"
  FOR ALL
  USING      (app.org_match("organizationId") AND app.can_write_ops())
  WITH CHECK (app.org_match("organizationId") AND app.can_write_ops());

-- CredentialReference: readable by org members; written by ops/admin.
ALTER TABLE "CredentialReference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CredentialReference" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credentialreference_select ON "CredentialReference";
CREATE POLICY credentialreference_select ON "CredentialReference"
  FOR SELECT
  USING (app.org_match("organizationId") AND app.is_org_member());

DROP POLICY IF EXISTS credentialreference_write ON "CredentialReference";
CREATE POLICY credentialreference_write ON "CredentialReference"
  FOR ALL
  USING      (app.org_match("organizationId") AND app.can_write_ops())
  WITH CHECK (app.org_match("organizationId") AND app.can_write_ops());
