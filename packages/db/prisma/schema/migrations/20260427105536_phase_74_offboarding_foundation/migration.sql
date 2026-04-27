-- Phase 74 D-01 / D-03 / D-06 / D-08 / D-09 / D-11 — F4 Offboarding foundation.
--
-- Forward-only, additive migration. Adds:
--   * 2 new tables (WorkflowRoleTemplate + WorkflowRoleTaskTemplate)
--   * 7 new nullable columns spread across 4 existing tables
--     (Contractor.workflowRoleId, Team.fallbackApproverId, User.outOfOffice,
--      WorkflowRun.{overriddenTemplateId, overriddenByUserId, overriddenAt,
--      overrideMetadata})
--   * 2 new enum values on WorkflowTaskType (IP_VERIFICATION, CONTRACT_HEALTH_CHECK)
--   * 5 new indexes
--   * 2 new unique constraints
--   * 4 new foreign keys
--
-- No DROP, RENAME, UPDATE, or INSERT statements. All new columns are NULLABLE so
-- existing rows remain valid; Plan 74-05 ships an idempotent first-boot upsert
-- to materialise the 4 typed-const seeds into per-org WorkflowRoleTemplate rows.
--
-- Multi-region apply (EU + ME) is a manual post-deploy step per Standing
-- Constraint (LOCAL-ONLY) — see push-all-regions.ts. Both regions must be on
-- the same migration version before Plans 74-05 / 74-06 / 74-07 / 74-08 land
-- their integration tests.

-- AlterEnum
ALTER TYPE "WorkflowTaskType" ADD VALUE 'IP_VERIFICATION';
ALTER TYPE "WorkflowTaskType" ADD VALUE 'CONTRACT_HEALTH_CHECK';

-- AlterTable
ALTER TABLE "Contractor"
  ADD COLUMN "workflowRoleId" TEXT;

-- AlterTable
ALTER TABLE "Team"
  ADD COLUMN "fallbackApproverId" TEXT;

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "outOfOffice" JSONB;

-- AlterTable
ALTER TABLE "WorkflowRun"
  ADD COLUMN "overriddenTemplateId" TEXT,
  ADD COLUMN "overriddenByUserId" TEXT,
  ADD COLUMN "overriddenAt" TIMESTAMP(3),
  ADD COLUMN "overrideMetadata" JSONB;

-- CreateTable
CREATE TABLE "WorkflowRoleTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "displayNameI18nKey" TEXT,
    "displayNameEn" TEXT,
    "displayNamePl" TEXT,
    "displayNameDe" TEXT,
    "isSeed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRoleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRoleTaskTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRoleTemplateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "titleI18nKey" TEXT,
    "descriptionI18nKey" TEXT,
    "titleEn" TEXT,
    "titlePl" TEXT,
    "titleDe" TEXT,
    "descriptionEn" TEXT,
    "descriptionPl" TEXT,
    "descriptionDe" TEXT,
    "dueDayOffset" INTEGER NOT NULL,
    "requiredDocsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRoleTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRoleTemplate_organizationId_role_key"
  ON "WorkflowRoleTemplate"("organizationId", "role");

-- CreateIndex
CREATE INDEX "WorkflowRoleTemplate_organizationId_idx"
  ON "WorkflowRoleTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowRoleTemplate_organizationId_isSeed_idx"
  ON "WorkflowRoleTemplate"("organizationId", "isSeed");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRoleTaskTemplate_workflowRoleTemplateId_sortOrder_key"
  ON "WorkflowRoleTaskTemplate"("workflowRoleTemplateId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkflowRoleTaskTemplate_organizationId_idx"
  ON "WorkflowRoleTaskTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowRoleTaskTemplate_organizationId_workflowRoleTemplate_idx"
  ON "WorkflowRoleTaskTemplate"("organizationId", "workflowRoleTemplateId", "sortOrder");

-- CreateIndex
CREATE INDEX "Contractor_organizationId_workflowRoleId_idx"
  ON "Contractor"("organizationId", "workflowRoleId");

-- AddForeignKey
ALTER TABLE "Contractor"
  ADD CONSTRAINT "Contractor_workflowRoleId_fkey"
  FOREIGN KEY ("workflowRoleId")
  REFERENCES "WorkflowRoleTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team"
  ADD CONSTRAINT "Team_fallbackApproverId_fkey"
  FOREIGN KEY ("fallbackApproverId")
  REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRoleTemplate"
  ADD CONSTRAINT "WorkflowRoleTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRoleTaskTemplate"
  ADD CONSTRAINT "WorkflowRoleTaskTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRoleTaskTemplate"
  ADD CONSTRAINT "WorkflowRoleTaskTemplate_workflowRoleTemplateId_fkey"
  FOREIGN KEY ("workflowRoleTemplateId")
  REFERENCES "WorkflowRoleTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
