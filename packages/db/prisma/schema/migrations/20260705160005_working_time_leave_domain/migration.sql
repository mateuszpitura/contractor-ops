-- Working-time + leave + reference-calendar domain (additive, reversible).
--
-- Creates the employee statutory working-time record (EmployeeTimeRecord), the
-- leave record-of-record (LeaveType, BlackoutPeriod, LeaveRequest, LeaveLedgerEntry,
-- LeaveBalance) and the global PublicHoliday reference calendar, plus their enums —
-- exactly as declared in employee-time.prisma, leave.prisma and reference.prisma.
--
-- These models previously existed only via db push / dev-drift and had NO
-- migration of their own (the exact gap the migration-drift check guards against).
-- This migration closes that gap so a clean `migrate diff --from-migrations` replay
-- reproduces the schema.
--
-- Additive only: it creates new enums and tables with their unique/lookup indexes
-- and foreign keys to Organization, Worker, LeaveType and Team. It does NOT alter
-- any existing table and performs NO backfill — every existing row is untouched,
-- so applying it cannot fail on existing data.
--
-- ORDERING: EmployeeTimeRecord / LeaveRequest / LeaveLedgerEntry / LeaveBalance
-- reference Worker (from 20260705160000_worker_base_additive); BlackoutPeriod /
-- LeaveRequest reference Team and every table references Organization (both from
-- the baseline). The timestamp ordering guarantees all dependencies replay first.
--
-- Apply per region (EU/ME/US) via `pnpm db:migrate:all`; prod apply stays a
-- deferred ops action under the local-only posture. Reversible via down.sql.

-- CreateEnum
CREATE TYPE "EmployeeTimeSource" AS ENUM ('MANUAL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "AbsenceKind" AS ENUM ('VACATION', 'SICK', 'PARENTAL', 'BEREAVEMENT', 'STUDY', 'UNPAID', 'OTHER_JUSTIFIED', 'UNJUSTIFIED');

-- CreateEnum
CREATE TYPE "LeaveKind" AS ENUM ('ANNUAL', 'SICK', 'PARENTAL', 'BEREAVEMENT', 'STUDY', 'UNPAID', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveLedgerType" AS ENUM ('ACCRUAL', 'DEDUCTION', 'CARRYOVER', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "EmployeeTimeRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "nightMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes50" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes100" INTEGER NOT NULL DEFAULT 0,
    "weekendHolidayMinutes" INTEGER NOT NULL DEFAULT 0,
    "onCallMinutes" INTEGER NOT NULL DEFAULT 0,
    "onCallLocation" TEXT,
    "absenceKind" "AbsenceKind",
    "wtOptOut" BOOLEAN NOT NULL DEFAULT false,
    "source" "EmployeeTimeSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeTimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "holidayDate" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "LeaveKind" NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackoutPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "teamId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlackoutPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "requestedMinutes" INTEGER NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "teamId" TEXT,
    "approvalFlowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "entryType" "LeaveLedgerType" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "sourceRef" TEXT,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitledMinutes" INTEGER NOT NULL DEFAULT 0,
    "usedMinutes" INTEGER NOT NULL DEFAULT 0,
    "carryoverMinutes" INTEGER NOT NULL DEFAULT 0,
    "recomputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeTimeRecord_organizationId_workerId_workDate_idx" ON "EmployeeTimeRecord"("organizationId", "workerId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeTimeRecord_organizationId_workerId_workDate_key" ON "EmployeeTimeRecord"("organizationId", "workerId", "workDate");

-- CreateIndex
CREATE INDEX "PublicHoliday_countryCode_holidayDate_idx" ON "PublicHoliday"("countryCode", "holidayDate");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_countryCode_holidayDate_region_key" ON "PublicHoliday"("countryCode", "holidayDate", "region");

-- CreateIndex
CREATE INDEX "LeaveType_organizationId_idx" ON "LeaveType"("organizationId");

-- CreateIndex
CREATE INDEX "LeaveType_organizationId_kind_idx" ON "LeaveType"("organizationId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_organizationId_code_key" ON "LeaveType"("organizationId", "code");

-- CreateIndex
CREATE INDEX "BlackoutPeriod_organizationId_idx" ON "BlackoutPeriod"("organizationId");

-- CreateIndex
CREATE INDEX "BlackoutPeriod_organizationId_startDate_endDate_idx" ON "BlackoutPeriod"("organizationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "BlackoutPeriod_organizationId_teamId_idx" ON "BlackoutPeriod"("organizationId", "teamId");

-- CreateIndex
CREATE INDEX "LeaveRequest_organizationId_idx" ON "LeaveRequest"("organizationId");

-- CreateIndex
CREATE INDEX "LeaveRequest_organizationId_workerId_idx" ON "LeaveRequest"("organizationId", "workerId");

-- CreateIndex
CREATE INDEX "LeaveRequest_organizationId_status_idx" ON "LeaveRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_organizationId_teamId_startDate_endDate_idx" ON "LeaveRequest"("organizationId", "teamId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_organizationId_workerId_leaveTypeId_effect_idx" ON "LeaveLedgerEntry"("organizationId", "workerId", "leaveTypeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "LeaveBalance_organizationId_workerId_idx" ON "LeaveBalance"("organizationId", "workerId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_organizationId_workerId_leaveTypeId_year_key" ON "LeaveBalance"("organizationId", "workerId", "leaveTypeId", "year");

-- AddForeignKey
ALTER TABLE "EmployeeTimeRecord" ADD CONSTRAINT "EmployeeTimeRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTimeRecord" ADD CONSTRAINT "EmployeeTimeRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlackoutPeriod" ADD CONSTRAINT "BlackoutPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlackoutPeriod" ADD CONSTRAINT "BlackoutPeriod_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
