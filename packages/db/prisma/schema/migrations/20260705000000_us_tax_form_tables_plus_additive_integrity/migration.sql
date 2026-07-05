-- US tax-form tables + FX / ACH / Peppol / late-interest / cron additive changes.
--
-- Additive only; no data loss. Two kinds of change, all backfill-safe:
--
--   CREATE — nine US information-return tables that live in the schema but had no
--   migration (routers query them, so a fresh regional DB previously errored with
--   "relation does not exist"): TaxFormSubmission, Form1099Nec, IrisSubmission,
--   IrisAck, Tax1099Threshold, StateFilingConfig, Form1042S, Form1099KTrackerState,
--   Tax1099KThreshold — plus AchReturnLedgerEntry (ACH return-file idempotency
--   ledger) and CronJobRunState (per-job last-success, survives worker restart).
--
--   ALTER — two nullable FX-provenance columns on PaymentRunItem
--   (settlementRate / settlementRateDate) and three concurrency backstops:
--     * Form1042S    partial UNIQUE on the ACTIVE row per (org, payer, recipient, year)
--     * PeppolTransmission partial UNIQUE on the in-flight row per invoice
--     * InvoiceInterestClaim UNIQUE per invoice
--   The partial uniques exclude DRAFT/SUPERSEDED/terminal rows via a WHERE clause.
--
-- Every column added is nullable-or-defaulted and every constraint only rejects
-- true duplicates, so existing rows are untouched — zero backfill. The service
-- code that populates the new columns / handles P2002 lands in a later change set.
--
-- Apply per region (EU/ME/US) via `pnpm db:migrate:all`
-- (packages/db/scripts/migrate-all-regions.ts); prod apply stays a deferred ops
-- action under the local-only posture. Reversible via the paired down.sql.

-- CreateEnum
CREATE TYPE "AchReturnEntryType" AS ENUM ('RETURN', 'NOTIFICATION_OF_CHANGE');

-- CreateEnum
CREATE TYPE "TaxFormType" AS ENUM ('W9', 'W8BEN', 'W8BENE');

-- CreateEnum
CREATE TYPE "TaxFormStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "Form1099Status" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "IrisAckStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'PROCESSING', 'PARTIALLY_ACCEPTED', 'ACCEPTED_WITH_ERRORS', 'NOT_FOUND');

-- CreateEnum
CREATE TYPE "Form1042SStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "Form1099KBand" AS ENUM ('SAFE', 'APPROACHING', 'OVER');

-- AlterTable
ALTER TABLE "PaymentRunItem" ADD COLUMN     "settlementRate" DECIMAL(18,8),
ADD COLUMN     "settlementRateDate" DATE;

-- CreateTable
CREATE TABLE "CronJobRunState" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronJobRunState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchReturnLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentRunId" TEXT NOT NULL,
    "paymentRunItemId" TEXT,
    "entryType" "AchReturnEntryType" NOT NULL DEFAULT 'RETURN',
    "traceNumber" TEXT NOT NULL,
    "returnCode" VARCHAR(8) NOT NULL,
    "individualId" TEXT,
    "amountMinor" INTEGER,
    "addendaInfo" TEXT,
    "fileSha256" VARCHAR(64),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchReturnLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxFormSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "formType" "TaxFormType" NOT NULL,
    "status" "TaxFormStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshotJson" JSONB NOT NULL,
    "treatyArticle" VARCHAR(40),
    "treatyRate" DECIMAL(5,2),
    "contractorResidency" CHAR(2),
    "signerName" TEXT,
    "signedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form1099Nec" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payerOrgId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "status" "Form1099Status" NOT NULL DEFAULT 'DRAFT',
    "box1AmountMinor" INTEGER NOT NULL,
    "box4BackupWithholdingMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "cfsfStateCode" CHAR(2),
    "corrected" BOOLEAN NOT NULL DEFAULT false,
    "snapshotJson" JSONB NOT NULL,
    "pdfArchiveKey" TEXT,
    "supersededById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Form1099Nec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrisSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "schemaVersionNum" TEXT NOT NULL,
    "schemaVersionDt" TEXT NOT NULL,
    "transmitMethod" TEXT NOT NULL,
    "originalReceiptId" TEXT,
    "status" "IrisAckStatus",
    "xmlArchiveKey" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrisSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrisAck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "status" "IrisAckStatus" NOT NULL,
    "errorInformationJson" JSONB,
    "receiptId" TEXT,
    "parsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrisAck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tax1099Threshold" (
    "id" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "box1ThresholdMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "note" TEXT,

    CONSTRAINT "Tax1099Threshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateFilingConfig" (
    "id" TEXT NOT NULL,
    "stateCode" CHAR(2) NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "cfsfParticipant" BOOLEAN NOT NULL,
    "requiresDirectFiling" BOOLEAN NOT NULL,
    "filingThresholdMinor" INTEGER,
    "stateWithholdingBoxRules" JSONB,
    "note" TEXT,

    CONSTRAINT "StateFilingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form1042S" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payerOrgId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "status" "Form1042SStatus" NOT NULL DEFAULT 'DRAFT',
    "box1IncomeCode" VARCHAR(2),
    "box2GrossIncomeMinor" INTEGER NOT NULL,
    "box3aChap3ExemptionCode" VARCHAR(2),
    "box3bChap3Rate" DECIMAL(5,2),
    "box4aChap4ExemptionCode" VARCHAR(2),
    "box4bChap4Rate" DECIMAL(5,2),
    "box7FederalTaxWithheldMinor" INTEGER NOT NULL DEFAULT 0,
    "recipientChap3StatusCode" VARCHAR(2),
    "recipientChap4StatusCode" VARCHAR(2),
    "recipientLobCode" VARCHAR(2),
    "treatyArticle" VARCHAR(40),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "corrected" BOOLEAN NOT NULL DEFAULT false,
    "snapshotJson" JSONB NOT NULL,
    "pdfArchiveKey" TEXT,
    "supersededById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Form1042S_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form1099KTrackerState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "currentBand" "Form1099KBand" NOT NULL DEFAULT 'SAFE',
    "cumulativePayoutMinor" INTEGER NOT NULL DEFAULT 0,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "lastScannedAt" TIMESTAMP(3),
    "lastCrossedAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form1099KTrackerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tax1099KThreshold" (
    "id" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "amountThresholdMinor" INTEGER NOT NULL,
    "transactionCountThreshold" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "note" TEXT,

    CONSTRAINT "Tax1099KThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CronJobRunState_jobName_key" ON "CronJobRunState"("jobName");

-- CreateIndex
CREATE INDEX "AchReturnLedgerEntry_organizationId_idx" ON "AchReturnLedgerEntry"("organizationId");

-- CreateIndex
CREATE INDEX "AchReturnLedgerEntry_paymentRunId_idx" ON "AchReturnLedgerEntry"("paymentRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ach_return_entry_run_trace_code_uniq" ON "AchReturnLedgerEntry"("paymentRunId", "traceNumber", "returnCode");

-- CreateIndex
CREATE UNIQUE INDEX "TaxFormSubmission_supersededById_key" ON "TaxFormSubmission"("supersededById");

-- CreateIndex
CREATE INDEX "TaxFormSubmission_organizationId_contractorId_formType_stat_idx" ON "TaxFormSubmission"("organizationId", "contractorId", "formType", "status");

-- CreateIndex
CREATE INDEX "TaxFormSubmission_organizationId_status_expiresAt_idx" ON "TaxFormSubmission"("organizationId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Form1099Nec_supersededById_key" ON "Form1099Nec"("supersededById");

-- CreateIndex
CREATE INDEX "Form1099Nec_organizationId_payerOrgId_recipientId_taxYear_s_idx" ON "Form1099Nec"("organizationId", "payerOrgId", "recipientId", "taxYear", "status");

-- CreateIndex
CREATE INDEX "Form1099Nec_organizationId_taxYear_status_idx" ON "Form1099Nec"("organizationId", "taxYear", "status");

-- CreateIndex
CREATE INDEX "IrisSubmission_organizationId_taxYear_idx" ON "IrisSubmission"("organizationId", "taxYear");

-- CreateIndex
CREATE INDEX "IrisAck_organizationId_submissionId_idx" ON "IrisAck"("organizationId", "submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Tax1099Threshold_taxYear_key" ON "Tax1099Threshold"("taxYear");

-- CreateIndex
CREATE UNIQUE INDEX "StateFilingConfig_stateCode_taxYear_key" ON "StateFilingConfig"("stateCode", "taxYear");

-- CreateIndex
CREATE UNIQUE INDEX "Form1042S_supersededById_key" ON "Form1042S"("supersededById");

-- CreateIndex
CREATE INDEX "Form1042S_organizationId_payerOrgId_recipientId_taxYear_sta_idx" ON "Form1042S"("organizationId", "payerOrgId", "recipientId", "taxYear", "status");

-- CreateIndex
CREATE INDEX "Form1042S_organizationId_taxYear_status_idx" ON "Form1042S"("organizationId", "taxYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Form1042S_active_key" ON "Form1042S"("organizationId", "payerOrgId", "recipientId", "taxYear") WHERE (status = 'ACTIVE'::"Form1042SStatus");

-- CreateIndex
CREATE INDEX "F1099K_org_idx" ON "Form1099KTrackerState"("organizationId");

-- CreateIndex
CREATE INDEX "F1099K_org_band_idx" ON "Form1099KTrackerState"("organizationId", "currentBand");

-- CreateIndex
CREATE INDEX "F1099K_org_scanned_idx" ON "Form1099KTrackerState"("organizationId", "lastScannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Form1099KTrackerState_contractorId_taxYear_key" ON "Form1099KTrackerState"("contractorId", "taxYear");

-- CreateIndex
CREATE UNIQUE INDEX "Tax1099KThreshold_taxYear_key" ON "Tax1099KThreshold"("taxYear");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceInterestClaim_invoiceId_key" ON "InvoiceInterestClaim"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PeppolTransmission_invoiceId_active_key" ON "PeppolTransmission"("invoiceId") WHERE (status = ANY (ARRAY['PENDING'::"PeppolTransmissionStatus", 'TRANSMITTED'::"PeppolTransmissionStatus"]));

-- AddForeignKey
ALTER TABLE "AchReturnLedgerEntry" ADD CONSTRAINT "AchReturnLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchReturnLedgerEntry" ADD CONSTRAINT "AchReturnLedgerEntry_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "PaymentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchReturnLedgerEntry" ADD CONSTRAINT "AchReturnLedgerEntry_paymentRunItemId_fkey" FOREIGN KEY ("paymentRunItemId") REFERENCES "PaymentRunItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFormSubmission" ADD CONSTRAINT "TaxFormSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFormSubmission" ADD CONSTRAINT "TaxFormSubmission_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFormSubmission" ADD CONSTRAINT "TaxFormSubmission_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "TaxFormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form1099Nec" ADD CONSTRAINT "Form1099Nec_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form1099Nec" ADD CONSTRAINT "Form1099Nec_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form1099Nec" ADD CONSTRAINT "Form1099Nec_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Form1099Nec"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrisSubmission" ADD CONSTRAINT "IrisSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrisAck" ADD CONSTRAINT "IrisAck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrisAck" ADD CONSTRAINT "IrisAck_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "IrisSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form1042S" ADD CONSTRAINT "Form1042S_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form1042S" ADD CONSTRAINT "Form1042S_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form1042S" ADD CONSTRAINT "Form1042S_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Form1042S"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form1099KTrackerState" ADD CONSTRAINT "Form1099KTrackerState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form1099KTrackerState" ADD CONSTRAINT "Form1099KTrackerState_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

