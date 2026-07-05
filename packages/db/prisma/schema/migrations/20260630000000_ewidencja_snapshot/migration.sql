-- EwidencjaSnapshot table + EwidencjaStatus enum (additive, reversible).
--
-- The immutable record-of-record for the PL "ewidencja czasu pracy" (working-time
-- register, KP art. 149). Each generation freezes the KP §149 field set into
-- snapshotJson; regeneration INSERTs a new version row with a previousSnapshotId
-- back-pointer, never UPDATEs the prior row.
--
-- This CREATE previously existed only via db push / dev-drift — the same gap the
-- migration-drift check guards against (queryable in code, absent from a fresh
-- regional DB). ORDERING IS LOAD-BEARING: this migration MUST replay BEFORE
-- 20260701000000_ewidencja_append_only, which hardens the table with RLS policies
-- and the BEFORE UPDATE immutability trigger and therefore requires it to exist.
--
-- Additive only: it creates one enum and one table with its unique/lookup indexes
-- and a self-referential foreign key (the supersede chain). It does NOT alter any
-- existing table and performs NO backfill. Reversible via down.sql.

-- CreateEnum
CREATE TYPE "EwidencjaStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "EwidencjaSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "periodKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "previousSnapshotId" TEXT,
    "status" "EwidencjaStatus" NOT NULL DEFAULT 'ACTIVE',
    "snapshotJson" JSONB NOT NULL,
    "generatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EwidencjaSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EwidencjaSnapshot_organizationId_workerId_periodKey_idx" ON "EwidencjaSnapshot"("organizationId", "workerId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "EwidencjaSnapshot_organizationId_workerId_periodKey_version_key" ON "EwidencjaSnapshot"("organizationId", "workerId", "periodKey", "version");

-- AddForeignKey
ALTER TABLE "EwidencjaSnapshot" ADD CONSTRAINT "EwidencjaSnapshot_previousSnapshotId_fkey" FOREIGN KEY ("previousSnapshotId") REFERENCES "EwidencjaSnapshot"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
