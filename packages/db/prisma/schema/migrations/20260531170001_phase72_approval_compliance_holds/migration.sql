-- Phase 72 Migration B — PENDING_COMPLIANCE approval hold (COMPL-06)
-- Additive migration (no data loss):
--   * 1 new "ApprovalStatus" enum value: 'PENDING_COMPLIANCE' (D-12)
--   * 1 new nullable column: "ApprovalFlow"."complianceHoldsJson" JSONB (D-14)
--   * 1 custom GIN index for JSONB @> containment queries (Prisma cannot auto-emit)
--   * No DROP TABLE / DROP COLUMN / destructive ALTER
-- Multi-region apply is a MANUAL post-deploy step (LOCAL-ONLY): see packages/db/scripts/README.md.
--
-- ALTER TYPE ... ADD VALUE is emitted FIRST and is NOT referenced as a value by any
-- statement in this migration, so it is safe to run alongside the column/index DDL on
-- PostgreSQL >= 12 (Neon PG16). Mirrors the Phase 75 IP_RATIFICATION precedent.

-- AlterEnum
ALTER TYPE "ApprovalStatus" ADD VALUE 'PENDING_COMPLIANCE' AFTER 'PENDING';

-- AlterTable
ALTER TABLE "ApprovalFlow" ADD COLUMN "complianceHoldsJson" JSONB;

-- CreateIndex (custom GIN index for JSONB containment queries — Prisma does not auto-emit)
CREATE INDEX "ApprovalFlow_complianceHoldsJson_gin_idx"
  ON "ApprovalFlow" USING GIN ("complianceHoldsJson" jsonb_path_ops);
