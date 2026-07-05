-- Form1099Nec ACTIVE-row partial UNIQUE — the DB backstop for the 1099-NEC
-- batch-generation idempotency guard (a duplicate ACTIVE return per recipient is
-- rejected with P2002, which the service handles as a skip).
--
-- Additive only; no data loss. It mirrors the existing Form1042S_active_key: at
-- most one ACTIVE row per (organizationId, payerOrgId, recipientId, taxYear).
-- DRAFT and SUPERSEDED rows are unconstrained because the WHERE clause excludes
-- them, so the immutable record-of-record supersede chain (which keeps prior
-- SUPERSEDED rows on the same natural key) is untouched and no existing row is
-- rejected. Prisma cannot fully express the partial predicate in @@unique(where:
-- raw(...)) without the partialIndexes preview, so the index also lives verbatim
-- here.
--
-- Apply per region (EU/ME/US) via `pnpm db:migrate:all`; prod apply stays a
-- deferred ops action under the local-only posture. Reversible via down.sql.

-- CreateIndex
CREATE UNIQUE INDEX "Form1099Nec_active_key" ON "Form1099Nec"("organizationId", "payerOrgId", "recipientId", "taxYear") WHERE (status = 'ACTIVE'::"Form1099Status");
