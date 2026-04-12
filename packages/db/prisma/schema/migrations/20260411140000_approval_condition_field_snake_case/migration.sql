-- Migrate approval chain condition field name from camelCase to snake_case (domain convention).

UPDATE "ApprovalChainConfig"
SET "conditionsJson" = regexp_replace(
  "conditionsJson"::text,
  '"field"\s*:\s*"contractorType"',
  '"field":"contractor_type"',
  'g'
)::jsonb
WHERE "conditionsJson"::text LIKE '%contractorType%';
