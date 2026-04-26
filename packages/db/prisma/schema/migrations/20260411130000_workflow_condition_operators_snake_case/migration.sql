-- Migrate workflow task condition operators in configJson from camelCase to snake_case (domain convention).

UPDATE "WorkflowTaskTemplate"
SET "configJson" = regexp_replace(
  regexp_replace(
    "configJson"::text,
    '"operator"\s*:\s*"notEquals"',
    '"operator":"not_equals"',
    'g'
  ),
  '"operator"\s*:\s*"startsWith"',
  '"operator":"starts_with"',
  'g'
)::jsonb
WHERE "configJson"::text LIKE '%notEquals%'
   OR "configJson"::text LIKE '%startsWith%';
