-- Migrate legacy Peppol UAE participants registered under Norway scheme 0192 to UAE TRN scheme 0235 (PINT-AE).
UPDATE "PeppolParticipant"
SET
  "schemeId" = '0235',
  "participantId" = '0235:' || "identifierValue"
WHERE "schemeId" = '0192'
   OR "participantId" LIKE '0192:%';
