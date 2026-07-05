-- EsignEnvelopeIntent — pre-provider idempotency ledger for e-sign envelope
-- creation (additive, reversible).
--
-- Additive only: it creates one new table with its dedup unique + lookup indexes
-- and a foreign key to Organization. It does NOT alter any existing table and
-- performs NO backfill — every existing row is untouched, so applying it cannot
-- fail on existing data.
--
-- WHY: the e-sign orchestrator creates the provider envelope BEFORE the local DB
-- transaction; a rollback + retry would re-issue the provider call. DocuSign is
-- covered by its server-honored X-DocuSign-Idempotency-Key, but Autenti's
-- POST /document-processes accepts no idempotency header or client reference, so
-- the dedup must live on our side. The service writes an intent row keyed on the
-- deterministic (organizationId, documentId, signerSetHash) business key BEFORE
-- the provider call and short-circuits when a row already exists.
--
-- Apply per region (EU/ME/US) via `pnpm db:migrate:all`; prod apply stays a
-- deferred ops action under the local-only posture. Reversible via down.sql.

-- CreateTable
CREATE TABLE "EsignEnvelopeIntent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "contractId" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "integrationConnectionId" TEXT NOT NULL,
    "signerSetHash" TEXT NOT NULL,
    "externalEnvelopeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EsignEnvelopeIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EsignEnvelopeIntent_organizationId_idx" ON "EsignEnvelopeIntent"("organizationId");

-- CreateIndex
CREATE INDEX "EsignEnvelopeIntent_organizationId_documentId_idx" ON "EsignEnvelopeIntent"("organizationId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "esign_envelope_intent_dedup_key" ON "EsignEnvelopeIntent"("organizationId", "documentId", "signerSetHash");

-- AddForeignKey
ALTER TABLE "EsignEnvelopeIntent" ADD CONSTRAINT "EsignEnvelopeIntent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
