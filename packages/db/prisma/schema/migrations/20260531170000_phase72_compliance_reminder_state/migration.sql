-- Phase 72 Migration A — Compliance reminder cascade state (COMPL-03)
-- Additive migration (no data loss):
--   * 1 new enum: "ReminderBand" (NONE/D90/D60/D30/D15/D7/EXPIRED)
--   * 1 new table: "ContractorComplianceReminderState" (D-01 — 1:1 with ContractorComplianceItem via itemId @unique)
--   * No DROP TABLE / DROP COLUMN / destructive ALTER
-- Multi-region apply is a MANUAL post-deploy step (LOCAL-ONLY): see packages/db/scripts/README.md.

-- CreateEnum
CREATE TYPE "ReminderBand" AS ENUM ('NONE', 'D90', 'D60', 'D30', 'D15', 'D7', 'EXPIRED');

-- CreateTable
CREATE TABLE "ContractorComplianceReminderState" (
    "itemId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currentBand" "ReminderBand" NOT NULL DEFAULT 'NONE',
    "lastBandFired" "ReminderBand",
    "lastBandFiredAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorComplianceReminderState_pkey" PRIMARY KEY ("itemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractorComplianceReminderState_itemId_key" ON "ContractorComplianceReminderState"("itemId");

-- CreateIndex
CREATE INDEX "ContractorComplianceReminderState_organizationId_idx" ON "ContractorComplianceReminderState"("organizationId");

-- CreateIndex
CREATE INDEX "ContractorComplianceReminderState_organizationId_currentBand_idx" ON "ContractorComplianceReminderState"("organizationId", "currentBand");

-- AddForeignKey
ALTER TABLE "ContractorComplianceReminderState" ADD CONSTRAINT "ContractorComplianceReminderState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ContractorComplianceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
