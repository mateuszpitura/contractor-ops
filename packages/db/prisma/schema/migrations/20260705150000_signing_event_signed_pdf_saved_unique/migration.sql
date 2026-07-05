-- SigningEvent SIGNED_PDF_SAVED partial UNIQUE — the DB backstop for the e-sign
-- completion-idempotency guard (a duplicate provider "completed" redelivery races
-- to persist the signed PDF + append the terminal SIGNED_PDF_SAVED event; the
-- second writer is rejected with P2002, which the service handles as an idempotent
-- no-op — no duplicate signed Document).
--
-- Additive only; no data loss. At most one SIGNED_PDF_SAVED row per
-- signingEnvelopeId. All other eventType rows are unconstrained because the WHERE
-- clause excludes them, so the existing envelope event-log history is untouched
-- and no existing row is rejected. Prisma cannot fully express the partial
-- predicate without the partialIndexes preview, so the index also lives verbatim
-- here (mirrors Form1042S_active_key / Form1099Nec_active_key).
--
-- Apply per region (EU/ME/US) via `pnpm db:migrate:all`; prod apply stays a
-- deferred ops action under the local-only posture. Reversible via down.sql.

-- CreateIndex
CREATE UNIQUE INDEX "signing_event_signed_pdf_saved_key" ON "SigningEvent"("signingEnvelopeId") WHERE ("eventType" = 'SIGNED_PDF_SAVED'::"SigningEventType");
