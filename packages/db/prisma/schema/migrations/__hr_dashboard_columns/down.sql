-- Rollback for the additive HR-dashboard columns migration (migration.sql in
-- this dir).
--
-- Mechanical reverse of migration.sql, applied in the opposite order: drop the
-- added indexes, then the added columns, then the two enum types. No existing
-- table is touched — only the added objects are removed, so a rollback restores
-- the exact pre-migration state.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility; run
-- only to reverse the additive step at the blocking human migration gate.

-- DropIndex
DROP INDEX "PersonnelFileDocument_organizationId_expiresAt_idx";
DROP INDEX "EmployeeProfile_organizationId_probationEndsAt_idx";
DROP INDEX "EmployeeProfile_organizationId_contractEndDate_idx";
DROP INDEX "EmployeeProfile_organizationId_employmentType_idx";
DROP INDEX "EmployeeProfile_organizationId_department_idx";

-- AlterTable (PersonnelFileDocument — drop document-expiry columns)
ALTER TABLE "PersonnelFileDocument" DROP COLUMN "docCategory";
ALTER TABLE "PersonnelFileDocument" DROP COLUMN "expiresAt";

-- AlterTable (EmployeeProfile — drop HR-dashboard aggregation columns)
ALTER TABLE "EmployeeProfile" DROP COLUMN "probationEndsAt";
ALTER TABLE "EmployeeProfile" DROP COLUMN "contractEndDate";
ALTER TABLE "EmployeeProfile" DROP COLUMN "employmentType";
ALTER TABLE "EmployeeProfile" DROP COLUMN "department";

-- DropEnum
DROP TYPE "EmployeeDocCategory";
DROP TYPE "EmploymentType";
