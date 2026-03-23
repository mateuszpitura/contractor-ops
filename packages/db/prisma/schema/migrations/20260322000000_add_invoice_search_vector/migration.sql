-- Add generated tsvector column for full-text search on invoices
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("invoiceNumber", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("notes", '')), 'B')
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "Invoice_search_vector_idx" ON "Invoice" USING GIN ("search_vector");
