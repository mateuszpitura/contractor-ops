-- Add generated tsvector column for full-text search
ALTER TABLE "Contractor" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("legalName", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("displayName", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("taxId", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("email", '')), 'B')
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "Contractor_search_vector_idx" ON "Contractor" USING GIN ("search_vector");
