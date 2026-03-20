-- Add generated tsvector column for full-text search on contracts
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("contractNumber", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("notes", '')), 'C')
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "contract_fts_idx" ON "Contract" USING GIN ("searchVector");
