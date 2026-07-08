-- CreateEnum
CREATE TYPE "AchReturnEntryType" AS ENUM ('RETURN', 'NOTIFICATION_OF_CHANGE');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "lastEventCreated" TIMESTAMP(3);

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
CREATE TABLE "EsignEnvelopeIntent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "contractId" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "signerSetHash" TEXT NOT NULL,
    "externalEnvelopeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EsignEnvelopeIntent_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "CronJobRunState_jobName_key" ON "CronJobRunState"("jobName");

-- CreateIndex
CREATE INDEX "EsignEnvelopeIntent_organizationId_idx" ON "EsignEnvelopeIntent"("organizationId");

-- CreateIndex
CREATE INDEX "EsignEnvelopeIntent_organizationId_documentId_idx" ON "EsignEnvelopeIntent"("organizationId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "esign_envelope_intent_dedup_key" ON "EsignEnvelopeIntent"("organizationId", "documentId", "signerSetHash");

-- CreateIndex
CREATE INDEX "AchReturnLedgerEntry_organizationId_idx" ON "AchReturnLedgerEntry"("organizationId");

-- CreateIndex
CREATE INDEX "AchReturnLedgerEntry_paymentRunId_idx" ON "AchReturnLedgerEntry"("paymentRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ach_return_entry_run_trace_code_uniq" ON "AchReturnLedgerEntry"("paymentRunId", "traceNumber", "returnCode");

-- CreateIndex
CREATE UNIQUE INDEX "signing_event_signed_pdf_saved_key" ON "SigningEvent"("signingEnvelopeId") WHERE ("eventType" = 'SIGNED_PDF_SAVED'::"SigningEventType");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceInterestClaim_invoiceId_key" ON "InvoiceInterestClaim"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PeppolTransmission_invoiceId_active_key" ON "PeppolTransmission"("invoiceId") WHERE (status = ANY (ARRAY['PENDING'::"PeppolTransmissionStatus", 'TRANSMITTED'::"PeppolTransmissionStatus"]));

-- CreateIndex
CREATE UNIQUE INDEX "Form1099Nec_active_key" ON "Form1099Nec"("organizationId", "payerOrgId", "recipientId", "taxYear") WHERE (status = 'ACTIVE'::"Form1099Status");

-- CreateIndex
CREATE UNIQUE INDEX "Form1042S_active_key" ON "Form1042S"("organizationId", "payerOrgId", "recipientId", "taxYear") WHERE (status = 'ACTIVE'::"Form1042SStatus");

-- AddForeignKey
ALTER TABLE "EsignEnvelopeIntent" ADD CONSTRAINT "EsignEnvelopeIntent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchReturnLedgerEntry" ADD CONSTRAINT "AchReturnLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchReturnLedgerEntry" ADD CONSTRAINT "AchReturnLedgerEntry_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "PaymentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchReturnLedgerEntry" ADD CONSTRAINT "AchReturnLedgerEntry_paymentRunItemId_fkey" FOREIGN KEY ("paymentRunItemId") REFERENCES "PaymentRunItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

