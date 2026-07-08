-- EmployeeProfile personnel record + EmploymentStatus enum (additive, reversible).
--
-- Additive only: it creates the new EmploymentStatus enum and the new
-- EmployeeProfile table (a 1:1 sidecar on Worker, workerType = EMPLOYEE), with
-- its unique/lookup indexes and foreign keys to Organization and Worker. It
-- does NOT alter any existing table and performs NO backfill — every existing
-- row is untouched, so applying it cannot fail on existing data.
--
-- ORDERING: requires the Worker table (from __worker_base_additive) to already
-- exist in the target region, because EmployeeProfile.workerId references it. If
-- the Worker migration is still held, this one HOLDS behind it.
--
-- Reversibility: every statement here is undone by the paired down.sql in this
-- directory. No existing row is touched destructively; a rollback drops only the
-- added enum, table, indexes and constraints.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME,
-- then US) at the blocking human migration gate.

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryFields" JSONB,
    "peselEncrypted" TEXT,
    "peselLast4" TEXT,
    "ssnEncrypted" TEXT,
    "ssnLast4" TEXT,
    "iqamaEncrypted" TEXT,
    "iqamaLast4" TEXT,
    "emiratesIdEncrypted" TEXT,
    "emiratesIdLast4" TEXT,
    "saudizationCategory" "NitaqatBand",
    "etat" DECIMAL(3,2),
    "employmentStatus" "EmploymentStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_workerId_key" ON "EmployeeProfile"("workerId");

-- CreateIndex
CREATE INDEX "EmployeeProfile_organizationId_idx" ON "EmployeeProfile"("organizationId");

-- CreateIndex
CREATE INDEX "EmployeeProfile_organizationId_employmentStatus_idx" ON "EmployeeProfile"("organizationId", "employmentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_organizationId_workerId_key" ON "EmployeeProfile"("organizationId", "workerId");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
