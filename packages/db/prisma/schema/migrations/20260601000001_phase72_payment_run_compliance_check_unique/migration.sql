-- Phase 72 Migration D — PaymentRunComplianceCheck PASS-row uniqueness guard (COMPL-07 L-3)
-- Additive migration (no data loss):
--   * 1 new unique constraint: "PaymentRunComplianceCheck_paymentExportId_contractorId_key"
--     on (paymentExportId, contractorId)
--   * paymentExportId is nullable; Postgres treats NULL as non-equal in unique constraints,
--     so multiple FAIL rows (paymentExportId = null) are allowed — only PASS rows
--     (non-null paymentExportId) are constrained to one per contractor per export.
--   * No DROP TABLE / DROP COLUMN / destructive ALTER
-- Multi-region apply is a MANUAL post-deploy step (LOCAL-ONLY): see packages/db/scripts/README.md.

-- CreateIndex (unique)
CREATE UNIQUE INDEX "PaymentRunComplianceCheck_paymentExportId_contractorId_key"
    ON "PaymentRunComplianceCheck"("paymentExportId", "contractorId");
