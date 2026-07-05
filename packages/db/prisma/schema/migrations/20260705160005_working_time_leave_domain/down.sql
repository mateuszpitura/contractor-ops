-- Rollback for the additive working-time + leave + reference-calendar migration
-- (migration.sql in this dir). Mechanical reverse: drop the foreign keys, then the
-- tables (their indexes go with them), then the enums. No existing table is touched
-- — only the added objects are removed, so a rollback restores the exact
-- pre-migration state.
--
-- NOT APPLIED by codegen. Authored alongside migration.sql for reversibility; run
-- only to reverse the additive step at the blocking human migration gate.

-- DropForeignKey
ALTER TABLE "LeaveBalance" DROP CONSTRAINT "LeaveBalance_leaveTypeId_fkey";
ALTER TABLE "LeaveBalance" DROP CONSTRAINT "LeaveBalance_workerId_fkey";
ALTER TABLE "LeaveBalance" DROP CONSTRAINT "LeaveBalance_organizationId_fkey";
ALTER TABLE "LeaveLedgerEntry" DROP CONSTRAINT "LeaveLedgerEntry_leaveTypeId_fkey";
ALTER TABLE "LeaveLedgerEntry" DROP CONSTRAINT "LeaveLedgerEntry_workerId_fkey";
ALTER TABLE "LeaveLedgerEntry" DROP CONSTRAINT "LeaveLedgerEntry_organizationId_fkey";
ALTER TABLE "LeaveRequest" DROP CONSTRAINT "LeaveRequest_teamId_fkey";
ALTER TABLE "LeaveRequest" DROP CONSTRAINT "LeaveRequest_leaveTypeId_fkey";
ALTER TABLE "LeaveRequest" DROP CONSTRAINT "LeaveRequest_workerId_fkey";
ALTER TABLE "LeaveRequest" DROP CONSTRAINT "LeaveRequest_organizationId_fkey";
ALTER TABLE "BlackoutPeriod" DROP CONSTRAINT "BlackoutPeriod_teamId_fkey";
ALTER TABLE "BlackoutPeriod" DROP CONSTRAINT "BlackoutPeriod_organizationId_fkey";
ALTER TABLE "LeaveType" DROP CONSTRAINT "LeaveType_organizationId_fkey";
ALTER TABLE "EmployeeTimeRecord" DROP CONSTRAINT "EmployeeTimeRecord_workerId_fkey";
ALTER TABLE "EmployeeTimeRecord" DROP CONSTRAINT "EmployeeTimeRecord_organizationId_fkey";

-- DropTable
DROP TABLE "LeaveBalance";
DROP TABLE "LeaveLedgerEntry";
DROP TABLE "LeaveRequest";
DROP TABLE "BlackoutPeriod";
DROP TABLE "LeaveType";
DROP TABLE "PublicHoliday";
DROP TABLE "EmployeeTimeRecord";

-- DropEnum
DROP TYPE "LeaveLedgerType";
DROP TYPE "LeaveRequestStatus";
DROP TYPE "LeaveKind";
DROP TYPE "AbsenceKind";
DROP TYPE "EmployeeTimeSource";
