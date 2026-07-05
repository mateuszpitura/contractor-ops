-- Rollback for the additive worker-lifecycle migration (migration.sql in this dir).
--
-- Mechanical reverse of migration.sql, applied in the opposite order: drop the
-- CHECK constraints, the added FKs and indexes, the StatutoryCertificate table
-- and its enum, then the added columns. Restoring DeprovisioningRun's NOT NULL is
-- safe only while no worker-only run rows exist (true immediately after an
-- apply→rollback in staging, before any employee run is created).
--
-- NOTE: Postgres has no ALTER TYPE ... DROP VALUE, so the two additive EntityType
-- members ('WORKER', 'EMPLOYEE') CANNOT be removed. They are inert unless a row
-- uses them; leaving them is harmless and standard for additive enum rollbacks.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility; run
-- only to reverse the additive step at the blocking human migration gate.

-- DropCheck
ALTER TABLE "DeprovisioningRun" DROP CONSTRAINT "DeprovisioningRun_single_subject_check";
ALTER TABLE "WorkflowRun" DROP CONSTRAINT "WorkflowRun_single_subject_check";

-- DropForeignKey
ALTER TABLE "StatutoryCertificate" DROP CONSTRAINT "StatutoryCertificate_organizationId_fkey";
ALTER TABLE "DeprovisioningRun" DROP CONSTRAINT "DeprovisioningRun_workerId_fkey";
ALTER TABLE "WorkflowRun" DROP CONSTRAINT "WorkflowRun_workerId_fkey";

-- DropIndex
DROP INDEX "StatutoryCertificate_organizationId_workerId_idx";
DROP INDEX "StatutoryCertificate_organizationId_workflowRunId_idx";
DROP INDEX "DeprovisioningRun_organizationId_workerId_idx";
DROP INDEX "WorkflowTemplate_organizationId_jurisdiction_type_seedKey_key";
DROP INDEX "WorkflowRun_organizationId_workerId_idx";

-- DropTable
DROP TABLE "StatutoryCertificate";

-- DropEnum
DROP TYPE "StatutoryCertificateStatus";

-- AlterTable (EmployeeProfile)
ALTER TABLE "EmployeeProfile" DROP COLUMN "terminatedAt";

-- AlterTable (DeprovisioningRun — drop worker + restore NOT NULL)
ALTER TABLE "DeprovisioningRun" DROP COLUMN "workerId";
ALTER TABLE "DeprovisioningRun" ALTER COLUMN "assignmentId" SET NOT NULL;
ALTER TABLE "DeprovisioningRun" ALTER COLUMN "contractorId" SET NOT NULL;

-- AlterTable (WorkflowTemplate)
ALTER TABLE "WorkflowTemplate" DROP COLUMN "seedKey";
ALTER TABLE "WorkflowTemplate" DROP COLUMN "jurisdiction";

-- AlterTable (WorkflowRun)
ALTER TABLE "WorkflowRun" DROP COLUMN "workerId";
