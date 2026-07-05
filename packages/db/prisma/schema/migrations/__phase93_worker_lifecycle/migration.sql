-- Worker-keyed employee on/offboarding lifecycle (additive, reversible).
--
-- Additive only: two new EntityType members, a nullable WorkflowRun.workerId FK,
-- DeprovisioningRun contractor/assignment FKs relaxed to nullable + a nullable
-- workerId FK, EmployeeProfile.terminatedAt, WorkflowTemplate jurisdiction/seedKey
-- + a compound unique, and the new StatutoryCertificate table. Every existing
-- row is untouched: DROP NOT NULL is non-destructive (contractor rows keep their
-- FKs) and the compound unique treats existing NULL jurisdiction/seedKey rows as
-- distinct, so applying it cannot fail on existing data.
--
-- Defence-in-depth: a CHECK on WorkflowRun and DeprovisioningRun enforces at most
-- one subject (contractor XOR worker) at the storage tier; the API tier already
-- enforces exactly-one via a discriminated-union input.
--
-- ORDERING: requires Worker, EmployeeProfile, WorkflowRun, WorkflowTemplate and
-- DeprovisioningRun to already exist in the target region. If any is still held,
-- this one HOLDS behind it.
--
-- Reversibility: every statement here is undone by the paired down.sql in this
-- directory. A rollback removes only the added members/columns/table/constraints
-- (enum members cannot be dropped in Postgres — see down.sql note).
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME,
-- then US) at the blocking human migration gate.

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'WORKER';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'EMPLOYEE';

-- CreateEnum
CREATE TYPE "StatutoryCertificateStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');

-- AlterTable (WorkflowRun — add nullable worker subject)
ALTER TABLE "WorkflowRun" ADD COLUMN "workerId" TEXT;

-- AlterTable (WorkflowTemplate — per-market seed identity)
ALTER TABLE "WorkflowTemplate" ADD COLUMN "jurisdiction" TEXT;
ALTER TABLE "WorkflowTemplate" ADD COLUMN "seedKey" TEXT;

-- AlterTable (DeprovisioningRun — relax subject FKs + add nullable worker)
ALTER TABLE "DeprovisioningRun" ALTER COLUMN "contractorId" DROP NOT NULL;
ALTER TABLE "DeprovisioningRun" ALTER COLUMN "assignmentId" DROP NOT NULL;
ALTER TABLE "DeprovisioningRun" ADD COLUMN "workerId" TEXT;

-- AlterTable (EmployeeProfile — dated termination signal)
ALTER TABLE "EmployeeProfile" ADD COLUMN "terminatedAt" TIMESTAMP(3);

-- CreateTable (StatutoryCertificate)
CREATE TABLE "StatutoryCertificate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "certType" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "status" "StatutoryCertificateStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshotJson" JSONB NOT NULL,
    "pdfArchiveKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatutoryCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowRun_organizationId_workerId_idx" ON "WorkflowRun"("organizationId", "workerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTemplate_organizationId_jurisdiction_type_seedKey_key" ON "WorkflowTemplate"("organizationId", "jurisdiction", "type", "seedKey");

-- CreateIndex
CREATE INDEX "DeprovisioningRun_organizationId_workerId_idx" ON "DeprovisioningRun"("organizationId", "workerId");

-- CreateIndex
CREATE INDEX "StatutoryCertificate_organizationId_workflowRunId_idx" ON "StatutoryCertificate"("organizationId", "workflowRunId");

-- CreateIndex
CREATE INDEX "StatutoryCertificate_organizationId_workerId_idx" ON "StatutoryCertificate"("organizationId", "workerId");

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeprovisioningRun" ADD CONSTRAINT "DeprovisioningRun_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutoryCertificate" ADD CONSTRAINT "StatutoryCertificate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defence-in-depth: at most one subject (contractor XOR worker) per run.
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_single_subject_check"
    CHECK ((("contractorId" IS NOT NULL))::int + (("workerId" IS NOT NULL))::int <= 1);

ALTER TABLE "DeprovisioningRun" ADD CONSTRAINT "DeprovisioningRun_single_subject_check"
    CHECK ((("contractorId" IS NOT NULL))::int + (("workerId" IS NOT NULL))::int <= 1);
