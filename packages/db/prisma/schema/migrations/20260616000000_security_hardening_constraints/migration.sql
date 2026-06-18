-- DropIndex
DROP INDEX "Contractor_organizationId_taxId_idx";

-- CreateIndex
CREATE INDEX "Invoice_organizationId_paymentStatus_paidAt_idx" ON "Invoice"("organizationId", "paymentStatus", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_organizationId_taxId_key" ON "Contractor"("organizationId", "taxId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentExport_paymentRunId_key" ON "PaymentExport"("paymentRunId");
