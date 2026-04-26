-- Finding #8 — move claim-PDF rendering off the tRPC hot path onto QStash.
-- The claim row now lands synchronously with pdfKey=NULL + pdfStatus=PENDING_RENDER;
-- a QStash worker fills in pdfKey and flips pdfStatus to READY (or FAILED).

BEGIN;

-- 1. New enum for PDF lifecycle.
CREATE TYPE "InvoiceInterestClaimPdfStatus" AS ENUM (
  'PENDING_RENDER',
  'READY',
  'FAILED'
);

-- 2. Existing rows — backfill as READY since they all already have a pdfKey.
ALTER TABLE "invoice_interest_claim"
  ADD COLUMN "pdfStatus"  "InvoiceInterestClaimPdfStatus" NOT NULL DEFAULT 'PENDING_RENDER',
  ADD COLUMN "pdfError"   TEXT,
  ADD COLUMN "pdfReadyAt" TIMESTAMP(3);

UPDATE "invoice_interest_claim"
SET "pdfStatus" = 'READY',
    "pdfReadyAt" = "claimedAt"
WHERE "pdfKey" IS NOT NULL;

-- 3. pdfKey becomes nullable so newly enqueued claims can land without one.
ALTER TABLE "invoice_interest_claim"
  ALTER COLUMN "pdfKey" DROP NOT NULL;

-- 4. Index for the worker dequeue scan ("show me PENDING_RENDER jobs oldest first").
CREATE INDEX "invoice_interest_claim_pdfStatus_createdAt_idx"
  ON "invoice_interest_claim" ("pdfStatus", "createdAt");

COMMIT;
