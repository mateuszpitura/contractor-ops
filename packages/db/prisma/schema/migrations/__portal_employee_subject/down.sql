-- Rollback for the additive portal-subject + reporting-line migration
-- (migration.sql in this dir).
--
-- Mechanical reverse of migration.sql, applied in the opposite order: drop the
-- one-of CHECK, the added FKs and indexes, the added columns, then the enum, and
-- restore PortalSession.contractorId NOT NULL. Restoring NOT NULL is safe only
-- while no employee-subject session rows exist (true immediately after an
-- apply→rollback in staging, before any employee session is minted).
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility;
-- run only to reverse the additive step at the blocking human migration gate.

-- DropCheck
ALTER TABLE "PortalSession" DROP CONSTRAINT "PortalSession_subject_one_of";

-- DropForeignKey
ALTER TABLE "EmployeeProfile" DROP CONSTRAINT "EmployeeProfile_managerWorkerId_fkey";
ALTER TABLE "PortalSession" DROP CONSTRAINT "PortalSession_workerId_fkey";

-- DropIndex
DROP INDEX "EmployeeProfile_organizationId_managerWorkerId_idx";
DROP INDEX "PortalSession_workerId_organizationId_idx";

-- AlterTable (EmployeeProfile — drop reporting-line edge)
ALTER TABLE "EmployeeProfile" DROP COLUMN "managerWorkerId";

-- AlterTable (PortalSession — drop worker subject + restore contractor NOT NULL)
ALTER TABLE "PortalSession" DROP COLUMN "subjectType";
ALTER TABLE "PortalSession" DROP COLUMN "workerId";
ALTER TABLE "PortalSession" ALTER COLUMN "contractorId" SET NOT NULL;

-- DropEnum
DROP TYPE "PortalSubjectType";
