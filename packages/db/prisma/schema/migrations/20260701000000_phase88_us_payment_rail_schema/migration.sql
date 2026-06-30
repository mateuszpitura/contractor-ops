-- Phase 88 Theme A — US payment rail schema. Additive only; no data loss.
--   * 1 new nullable column on "Contractor" (backup-withholding decision flag)
--   * 7 new nullable columns on "ContractorBillingProfile"
--       (US ACH routing/account encrypted+masked pairs + Plaid advisory verification)
--   * 2 new "PaymentExportFormat" enum values (ACH_NACHA, FEDWIRE)
-- Every column is nullable with no default and every enum change is ADD VALUE, so
-- existing rows are untouched — zero backfill. Apply per region (EU/ME/US) via
-- `pnpm db:migrate:all` (packages/db/scripts/migrate-all-regions.ts) post-merge.

-- AlterTable — Contractor backup-withholding flag (IRC §3406). Read by the payment-run
-- seeding at payout time to deduct the statutory 24%; written advisory-only by the
-- TIN-match result. Nullable so unflagged contractors are simply NULL.
ALTER TABLE "Contractor"
    ADD COLUMN "backupWithholdingFlagged" BOOLEAN;

-- AlterTable — ContractorBillingProfile US ACH bank fields + Plaid verification.
-- The *Encrypted columns hold AES-256-GCM `iv:authTag:ciphertext`; the *Masked columns
-- are the only display surface (full routing/account values are never logged). The Plaid
-- columns are advisory (fail-open) verification status, mirroring the USPS posture.
ALTER TABLE "ContractorBillingProfile"
    ADD COLUMN "usRoutingNumberEncrypted" TEXT,
    ADD COLUMN "usRoutingNumberMasked"    TEXT,
    ADD COLUMN "usAccountNumberEncrypted" TEXT,
    ADD COLUMN "usAccountNumberMasked"    TEXT,
    ADD COLUMN "plaidVerificationStatus"  TEXT,
    ADD COLUMN "plaidVerifiedAt"          TIMESTAMP(3),
    ADD COLUMN "plaidAccountId"           TEXT;

-- AlterEnum — US export formats for the payment-export factory. ADD VALUE is additive
-- and is emitted before any data write references the new members, so no row uses a
-- value that does not yet exist. Each statement runs in its own migration step.
ALTER TYPE "PaymentExportFormat" ADD VALUE 'ACH_NACHA';
ALTER TYPE "PaymentExportFormat" ADD VALUE 'FEDWIRE';
