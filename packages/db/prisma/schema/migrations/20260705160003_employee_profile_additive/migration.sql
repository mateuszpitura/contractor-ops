-- EmployeeProfile personnel record + EmploymentStatus enum (additive, reversible).
--
-- Additive only: it creates the new EmploymentStatus enum and the new
-- EmployeeProfile table (a 1:1 sidecar on Worker, workerType = EMPLOYEE), with
-- its unique/lookup indexes and foreign keys to Organization and Worker. It
-- does NOT alter any existing table and performs NO backfill — every existing
-- row is untouched, so applying it cannot fail on existing data.
--
-- ORDERING: requires the Worker table (from 20260705160000_worker_base_additive)
-- to already exist in the target region, because EmployeeProfile.workerId
-- references it. The timestamp ordering guarantees the worker base migration
-- replays first.
--
-- Reversibility: every statement here is undone by the paired down.sql in this
-- directory. No existing row is touched destructively; a rollback drops only the
-- added enum, table, indexes and constraints.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME,
-- then US) at the blocking human migration gate.

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
-- NitaqatBand is a Gulf (KSA) enum used both HERE (EmployeeProfile.saudizationCategory)
-- and by the gulf-domain tables (SaudizationConfig.band in gulf.prisma). It is
-- CREATED here because this migration replays before 20260705160004_gulf_domain,
-- so the type already exists when the gulf tables reference it; the gulf migration
-- therefore does NOT re-create it. Values mirror `enum NitaqatBand` in the schema.
CREATE TYPE "NitaqatBand" AS ENUM ('PLATINUM', 'HIGH_GREEN', 'MID_GREEN', 'LOW_GREEN', 'YELLOW', 'RED');

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
