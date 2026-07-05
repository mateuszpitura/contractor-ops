-- Rollback for migration.sql in this directory. Mechanical reverse, applied in
-- opposite order: drop the added foreign keys and indexes, drop the two new
-- PaymentRunItem columns, then drop the new tables and their enum types. No
-- pre-existing table is touched destructively — only objects this migration
-- created are removed. Authored for reversibility; run only at the migration gate.

-- DropForeignKey
ALTER TABLE "AchReturnLedgerEntry" DROP CONSTRAINT "AchReturnLedgerEntry_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "AchReturnLedgerEntry" DROP CONSTRAINT "AchReturnLedgerEntry_paymentRunId_fkey";

-- DropForeignKey
ALTER TABLE "AchReturnLedgerEntry" DROP CONSTRAINT "AchReturnLedgerEntry_paymentRunItemId_fkey";

-- DropForeignKey
ALTER TABLE "TaxFormSubmission" DROP CONSTRAINT "TaxFormSubmission_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "TaxFormSubmission" DROP CONSTRAINT "TaxFormSubmission_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "TaxFormSubmission" DROP CONSTRAINT "TaxFormSubmission_supersededById_fkey";

-- DropForeignKey
ALTER TABLE "Form1099Nec" DROP CONSTRAINT "Form1099Nec_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Form1099Nec" DROP CONSTRAINT "Form1099Nec_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "Form1099Nec" DROP CONSTRAINT "Form1099Nec_supersededById_fkey";

-- DropForeignKey
ALTER TABLE "IrisSubmission" DROP CONSTRAINT "IrisSubmission_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "IrisAck" DROP CONSTRAINT "IrisAck_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "IrisAck" DROP CONSTRAINT "IrisAck_submissionId_fkey";

-- DropForeignKey
ALTER TABLE "Form1042S" DROP CONSTRAINT "Form1042S_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Form1042S" DROP CONSTRAINT "Form1042S_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "Form1042S" DROP CONSTRAINT "Form1042S_supersededById_fkey";

-- DropForeignKey
ALTER TABLE "Form1099KTrackerState" DROP CONSTRAINT "Form1099KTrackerState_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Form1099KTrackerState" DROP CONSTRAINT "Form1099KTrackerState_contractorId_fkey";

-- DropIndex
DROP INDEX "InvoiceInterestClaim_invoiceId_key";

-- DropIndex
DROP INDEX "PeppolTransmission_invoiceId_active_key";

-- AlterTable
ALTER TABLE "PaymentRunItem" DROP COLUMN "settlementRate",
DROP COLUMN "settlementRateDate";

-- DropTable
DROP TABLE "CronJobRunState";

-- DropTable
DROP TABLE "AchReturnLedgerEntry";

-- DropTable
DROP TABLE "TaxFormSubmission";

-- DropTable
DROP TABLE "Form1099Nec";

-- DropTable
DROP TABLE "IrisSubmission";

-- DropTable
DROP TABLE "IrisAck";

-- DropTable
DROP TABLE "Tax1099Threshold";

-- DropTable
DROP TABLE "StateFilingConfig";

-- DropTable
DROP TABLE "Form1042S";

-- DropTable
DROP TABLE "Form1099KTrackerState";

-- DropTable
DROP TABLE "Tax1099KThreshold";

-- DropEnum
DROP TYPE "AchReturnEntryType";

-- DropEnum
DROP TYPE "TaxFormType";

-- DropEnum
DROP TYPE "TaxFormStatus";

-- DropEnum
DROP TYPE "Form1099Status";

-- DropEnum
DROP TYPE "IrisAckStatus";

-- DropEnum
DROP TYPE "Form1042SStatus";

-- DropEnum
DROP TYPE "Form1099KBand";

