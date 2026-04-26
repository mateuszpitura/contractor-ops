-- Security / correctness pass — enforce per-tenant uniqueness of:
--   1. PaymentRun.runNumber (finding #2: concurrent creates race the
--      "SELECT MAX + 1" scan and can both write the same runNumber).
--   2. Invoice.invoiceNumber scoped by contractor (finding #5: two intakes
--      carrying the same supplier-issued invoice number both convert into
--      real Invoice rows — GoBD violation for DE orgs).
--
-- Both constraints operate at the Postgres level so the race is caught
-- even if the app-layer advisory lock / precondition check is bypassed.
-- Application code is expected to catch P2002 and translate to 409.
--
-- Forward-only. Prisma db push is the canonical deploy path; this file is
-- the human-readable record of what the push produces. Both indexes are
-- created CONCURRENTLY so they can land on a live table without blocking
-- writes. Prisma does not support CONCURRENTLY in generated migrations,
-- so we ship raw DDL here.

-- IMPORTANT: CREATE UNIQUE INDEX CONCURRENTLY cannot run inside a
-- transaction. If you're applying this manually, run the two statements
-- individually (no BEGIN/COMMIT wrapper).

-- 1. PaymentRun.runNumber uniqueness per org. Multiple NULLs permitted
-- (Postgres default), which matches the current schema (runNumber String?).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "PaymentRun_organizationId_runNumber_key"
  ON "PaymentRun" ("organizationId", "runNumber");

-- 2. Invoice.invoiceNumber per (org, contractor). Contractor ID is
-- nullable on Invoice (self-issued invoices may have no external
-- contractor), so multiple NULL contractorIds can each carry the same
-- invoice number. That is intentional: self-issued numbers get their own
-- uniqueness handled by the sequence generator.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Invoice_organizationId_contractorId_invoiceNumber_key"
  ON "Invoice" ("organizationId", "contractorId", "invoiceNumber");
