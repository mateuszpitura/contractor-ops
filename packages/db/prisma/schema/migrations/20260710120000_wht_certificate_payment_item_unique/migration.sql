-- One WHT certificate per payment run item (dedupe before enforcing).
DELETE FROM "WhtCertificate" wc
USING "WhtCertificate" wc2
WHERE wc."paymentRunItemId" = wc2."paymentRunItemId"
  AND (
    wc."generatedAt" > wc2."generatedAt"
    OR (wc."generatedAt" = wc2."generatedAt" AND wc."id" > wc2."id")
  );

DROP INDEX IF EXISTS "WhtCertificate_organizationId_paymentRunItemId_idx";

CREATE UNIQUE INDEX "WhtCertificate_paymentRunItemId_key" ON "WhtCertificate"("paymentRunItemId");

ALTER TABLE "WhtCertificate"
  ADD CONSTRAINT "WhtCertificate_paymentRunItemId_fkey"
  FOREIGN KEY ("paymentRunItemId") REFERENCES "PaymentRunItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
