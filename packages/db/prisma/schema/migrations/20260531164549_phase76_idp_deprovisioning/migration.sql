-- Phase 76 — F2 IdP deprovisioning saga + self-trigger provenance
-- Additive migration (no data loss):
--   * 3 new tables: "DeprovisioningRun" (D-01), "DeprovisioningStep" (D-01), "IdpChangeProvenance" (D-09)
--   * 5 new enums (run/step status, step kind, provider, provenance action kind)
--   * 1 new nullable column: "ContractorAssignment"."endedAt" (D-06 — drives 14-day cooldown)
--   * No DROP TABLE / DROP COLUMN / destructive ALTER
-- Multi-region apply is a MANUAL post-deploy step (LOCAL-ONLY): see packages/db/scripts/README.md.

-- CreateEnum
CREATE TYPE "DeprovisioningRunStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED');

-- CreateEnum
CREATE TYPE "DeprovisioningStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeprovisioningStepKind" AS ENUM ('SUSPEND_ACCOUNT', 'REVOKE_ALL_SESSIONS');

-- CreateEnum
CREATE TYPE "DeprovisioningProvider" AS ENUM ('GOOGLE_WORKSPACE', 'SLACK', 'ENTRA', 'OKTA', 'GITHUB');

-- CreateEnum
CREATE TYPE "IdpProvenanceActionKind" AS ENUM ('SUSPEND', 'REVOKE_SESSION');

-- AlterTable
ALTER TABLE "ContractorAssignment" ADD COLUMN     "endedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeprovisioningRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "status" "DeprovisioningRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "triggeredByUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "DeprovisioningRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeprovisioningStep" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "provider" "DeprovisioningProvider" NOT NULL,
    "stepKind" "DeprovisioningStepKind" NOT NULL,
    "status" "DeprovisioningStepStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "externalUserId" TEXT NOT NULL,
    "requestSha256" TEXT,
    "responseSha256" TEXT,
    "lastErrorMessage" TEXT,
    "qstashMessageId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DeprovisioningStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdpChangeProvenance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "DeprovisioningProvider" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "actionKind" "IdpProvenanceActionKind" NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" TIMESTAMP(3),
    "deprovisioningStepId" TEXT NOT NULL,

    CONSTRAINT "IdpChangeProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeprovisioningRun_idempotencyKey_key" ON "DeprovisioningRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DeprovisioningRun_organizationId_status_idx" ON "DeprovisioningRun"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DeprovisioningRun_organizationId_assignmentId_idx" ON "DeprovisioningRun"("organizationId", "assignmentId");

-- CreateIndex
CREATE INDEX "DeprovisioningRun_startedAt_idx" ON "DeprovisioningRun"("startedAt");

-- CreateIndex
CREATE INDEX "DeprovisioningStep_status_finishedAt_idx" ON "DeprovisioningStep"("status", "finishedAt");

-- CreateIndex
CREATE INDEX "DeprovisioningStep_organizationId_idx" ON "DeprovisioningStep"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DeprovisioningStep_runId_provider_stepKind_key" ON "DeprovisioningStep"("runId", "provider", "stepKind");

-- CreateIndex
CREATE INDEX "IdpChangeProvenance_provider_externalUserId_actionKind_init_idx" ON "IdpChangeProvenance"("provider", "externalUserId", "actionKind", "initiatedAt");

-- CreateIndex
CREATE INDEX "IdpChangeProvenance_initiatedAt_idx" ON "IdpChangeProvenance"("initiatedAt");

-- CreateIndex
CREATE INDEX "IdpChangeProvenance_organizationId_initiatedAt_idx" ON "IdpChangeProvenance"("organizationId", "initiatedAt");

-- AddForeignKey
ALTER TABLE "DeprovisioningRun" ADD CONSTRAINT "DeprovisioningRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeprovisioningRun" ADD CONSTRAINT "DeprovisioningRun_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeprovisioningRun" ADD CONSTRAINT "DeprovisioningRun_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ContractorAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeprovisioningRun" ADD CONSTRAINT "DeprovisioningRun_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeprovisioningStep" ADD CONSTRAINT "DeprovisioningStep_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeprovisioningStep" ADD CONSTRAINT "DeprovisioningStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeprovisioningRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdpChangeProvenance" ADD CONSTRAINT "IdpChangeProvenance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdpChangeProvenance" ADD CONSTRAINT "IdpChangeProvenance_deprovisioningStepId_fkey" FOREIGN KEY ("deprovisioningStepId") REFERENCES "DeprovisioningStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
