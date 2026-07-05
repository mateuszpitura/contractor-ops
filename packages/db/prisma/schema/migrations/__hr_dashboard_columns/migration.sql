-- HR-dashboard aggregation + document-expiry columns + two enums (additive,
-- reversible).
--
-- Two additive pieces, no backfill:
--   1. EmployeeProfile gains four nullable, indexed columns the HR dashboard
--      groups/windows on: `department`, `employmentType` (a NEW EmploymentType
--      enum — the CONTRACT-TYPE axis, distinct from the existing EmploymentStatus
--      lifecycle axis), `contractEndDate` (a SCHEDULED calendar end, distinct from
--      the administrative `terminatedAt` instant), and `probationEndsAt` (the
--      watchlist anchor).
--   2. PersonnelFileDocument gains `expiresAt` (the TZ-correct expiry anchor the
--      dashboard reads through the compliance-policy date math) + `docCategory`
--      (a NEW EmployeeDocCategory enum), plus a composite expiry index.
--
-- Every column is nullable, so applying it to a populated table cannot fail on
-- existing data and performs NO backfill — every existing row is untouched.
--
-- ORDERING: requires the EmployeeProfile table (from __employee_profile_additive)
-- and the PersonnelFileDocument table (from __personnel_file_additive) to already
-- exist in the target region. If either is still held, this one HOLDS behind it.
--
-- Reversibility: every statement here is undone by the paired down.sql in this
-- directory. No existing row is touched destructively; a rollback drops only the
-- added columns, indexes and enum types.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME,
-- then US) at the blocking human migration gate.

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'FIXED_TERM', 'TEMPORARY', 'APPRENTICE', 'SEASONAL');

-- CreateEnum
CREATE TYPE "EmployeeDocCategory" AS ENUM ('VISA', 'WORK_PERMIT', 'CONTRACT_RENEWAL', 'MEDICAL_CERT', 'TRAINING_CERT', 'OTHER');

-- AlterTable (EmployeeProfile — HR-dashboard aggregation columns)
ALTER TABLE "EmployeeProfile" ADD COLUMN "department" TEXT;
ALTER TABLE "EmployeeProfile" ADD COLUMN "employmentType" "EmploymentType";
ALTER TABLE "EmployeeProfile" ADD COLUMN "contractEndDate" DATE;
ALTER TABLE "EmployeeProfile" ADD COLUMN "probationEndsAt" DATE;

-- AlterTable (PersonnelFileDocument — document-expiry columns)
ALTER TABLE "PersonnelFileDocument" ADD COLUMN "expiresAt" DATE;
ALTER TABLE "PersonnelFileDocument" ADD COLUMN "docCategory" "EmployeeDocCategory";

-- CreateIndex
CREATE INDEX "EmployeeProfile_organizationId_department_idx" ON "EmployeeProfile"("organizationId", "department");

-- CreateIndex
CREATE INDEX "EmployeeProfile_organizationId_employmentType_idx" ON "EmployeeProfile"("organizationId", "employmentType");

-- CreateIndex
CREATE INDEX "EmployeeProfile_organizationId_contractEndDate_idx" ON "EmployeeProfile"("organizationId", "contractEndDate");

-- CreateIndex
CREATE INDEX "EmployeeProfile_organizationId_probationEndsAt_idx" ON "EmployeeProfile"("organizationId", "probationEndsAt");

-- CreateIndex
CREATE INDEX "PersonnelFileDocument_organizationId_expiresAt_idx" ON "PersonnelFileDocument"("organizationId", "expiresAt");
