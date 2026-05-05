-- F-DB-17 — drop redundant EInvoiceLifecycle unique index
--
-- The original schema declared both:
--   invoiceId String @unique
--   @@unique([organizationId, invoiceId])
-- which Postgres implements as TWO unique indexes covering invoiceId.
-- Phase 3 removed the compound `@@unique([organizationId, invoiceId])`
-- from the Prisma schema (the field-level @unique on invoiceId is
-- sufficient since invoiceId is globally unique), but Prisma's
-- `db push` does not drop pre-existing indexes that were created by
-- earlier migrations — the underlying index `einvoice_lifecycle_org_invoice_uniq`
-- survives even though the schema no longer declares it.
--
-- This migration removes the redundant index so writes to
-- `EInvoiceLifecycle` (one per issued invoice) no longer pay a double
-- write cost.

BEGIN;

DROP INDEX IF EXISTS einvoice_lifecycle_org_invoice_uniq;

COMMIT;

-- Rollback (only useful if a future schema change re-introduces the
-- composite uniqueness requirement):
--   BEGIN;
--   CREATE UNIQUE INDEX einvoice_lifecycle_org_invoice_uniq
--     ON "EInvoiceLifecycle" ("organizationId", "invoiceId");
--   COMMIT;
