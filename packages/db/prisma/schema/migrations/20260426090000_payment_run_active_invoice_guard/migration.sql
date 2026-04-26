-- Prevent the same invoice from being held by more than one active payment run
-- item. Completed/cancelled/failed attempts must move their items out of
-- PENDING/EXPORTED (PAID, FAILED, SKIPPED), which keeps retries possible.
--
-- CREATE UNIQUE INDEX CONCURRENTLY cannot run inside a transaction.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "PaymentRunItem_active_invoice_once_idx"
  ON "PaymentRunItem" ("organizationId", "invoiceId")
  WHERE "status" IN ('PENDING', 'EXPORTED');
