-- Subject-discriminated portal session + employee reporting-line edge (additive,
-- reversible).
--
-- Two additive pieces:
--   1. PortalSession can authenticate a Contractor OR an employee Worker.
--      `contractorId` is relaxed to nullable, `workerId` + a `subjectType`
--      discriminator are added, and a one-of CHECK enforces exactly one subject
--      (contractor XOR employee) matching subjectType. Existing rows all default
--      to 'CONTRACTOR' with their contractorId intact, so the contractor login
--      path is untouched by the apply.
--   2. EmployeeProfile carries a nullable self-relation `managerWorkerId` (FK →
--      Worker.id) — the reporting-line edge direct reports resolve off. Same-org
--      integrity is enforced by the reports resolver (always filters
--      organizationId), not the FK.
--
-- The one-of invariant is a raw-SQL CHECK because Prisma cannot express a
-- multi-column CHECK (same posture as the WorkflowRun/DeprovisioningRun
-- single-subject checks).
--
-- ORDERING: requires PortalSession, Worker and EmployeeProfile to already exist
-- in the target region. If any is still held, this one HOLDS behind it.
--
-- Reversibility: every statement here is undone by the paired down.sql in this
-- directory. Restoring PortalSession.contractorId NOT NULL is safe only while no
-- employee-subject session rows exist.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME)
-- at the blocking human migration gate.

-- CreateEnum
CREATE TYPE "PortalSubjectType" AS ENUM ('CONTRACTOR', 'EMPLOYEE');

-- AlterTable (PortalSession — relax contractor subject + add worker subject)
ALTER TABLE "PortalSession" ALTER COLUMN "contractorId" DROP NOT NULL;
ALTER TABLE "PortalSession" ADD COLUMN "workerId" TEXT;
ALTER TABLE "PortalSession" ADD COLUMN "subjectType" "PortalSubjectType" NOT NULL DEFAULT 'CONTRACTOR';

-- AlterTable (EmployeeProfile — reporting-line edge)
ALTER TABLE "EmployeeProfile" ADD COLUMN "managerWorkerId" TEXT;

-- CreateIndex
CREATE INDEX "PortalSession_workerId_organizationId_idx" ON "PortalSession"("workerId", "organizationId");

-- CreateIndex
CREATE INDEX "EmployeeProfile_organizationId_managerWorkerId_idx" ON "EmployeeProfile"("organizationId", "managerWorkerId");

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_managerWorkerId_fkey" FOREIGN KEY ("managerWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One-of subject invariant: exactly one of contractor/worker set, matching
-- subjectType. A both/neither row is rejected at insert/update by the database.
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_subject_one_of"
    CHECK (
        ("subjectType" = 'CONTRACTOR' AND "contractorId" IS NOT NULL AND "workerId" IS NULL)
        OR ("subjectType" = 'EMPLOYEE' AND "workerId" IS NOT NULL AND "contractorId" IS NULL)
    );
