-- Phase 72 Migration C — PaymentRunComplianceCheck audit row (COMPL-07)
-- Additive migration (no data loss):
--   * 1 new enum: "EligibilityVerdict" (PASS/FAIL) (D-16)
--   * 1 new table: "PaymentRunComplianceCheck" (D-16 — 1 row per PaymentRun × Contractor × export attempt)
--   * paymentExportId FK uses ON DELETE SET NULL so the audit row survives export deletion (D-19)
--   * No DROP TABLE / DROP COLUMN / destructive ALTER
-- Multi-region apply is a MANUAL post-deploy step (LOCAL-ONLY): see packages/db/scripts/README.md.

-- CreateEnum
CREATE TYPE "EligibilityVerdict" AS ENUM ('PASS', 'FAIL');

-- CreateTable
CREATE TABLE "PaymentRunComplianceCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentRunId" TEXT NOT NULL,
    "paymentExportId" TEXT,
    "contractorId" TEXT NOT NULL,
    "snapshottedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotJson" JSONB NOT NULL,
    "eligibilityVerdict" "EligibilityVerdict" NOT NULL,
    "failureReasons" JSONB,
    "policyRuleSetVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRunComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentRunComplianceCheck_organizationId_idx" ON "PaymentRunComplianceCheck"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentRunComplianceCheck_paymentRunId_idx" ON "PaymentRunComplianceCheck"("paymentRunId");

-- CreateIndex
CREATE INDEX "PaymentRunComplianceCheck_contractorId_snapshottedAt_idx" ON "PaymentRunComplianceCheck"("contractorId", "snapshottedAt" DESC);

-- CreateIndex
CREATE INDEX "PaymentRunComplianceCheck_paymentExportId_idx" ON "PaymentRunComplianceCheck"("paymentExportId");

-- AddForeignKey
ALTER TABLE "PaymentRunComplianceCheck" ADD CONSTRAINT "PaymentRunComplianceCheck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunComplianceCheck" ADD CONSTRAINT "PaymentRunComplianceCheck_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "PaymentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunComplianceCheck" ADD CONSTRAINT "PaymentRunComplianceCheck_paymentExportId_fkey" FOREIGN KEY ("paymentExportId") REFERENCES "PaymentExport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRunComplianceCheck" ADD CONSTRAINT "PaymentRunComplianceCheck_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
