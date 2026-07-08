-- Worker base table + sidecar Contractor.workerId FK column (additive, reversible).
--
-- This is the FIRST of the two-step Worker migration. It is intentionally
-- additive only: it creates the Worker identity root and adds a NULLABLE
-- Contractor.workerId column with a unique index. It does NOT enforce NOT NULL
-- and does NOT add the foreign-key constraint — those land in a later migration
-- only after every existing contractor row has been backfilled with a Worker.
--
-- Reversibility: every statement here is undone by the paired down.sql in this
-- directory. No Contractor row is touched destructively, so a rollback restores
-- the exact pre-migration contractor state (orphaned Worker rows are dropped).
--
-- NOT APPLIED by codegen. Authored as a file; applied per region at the
-- blocking human migration gate.

-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('CONTRACTOR', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workerType" "WorkerType" NOT NULL DEFAULT 'CONTRACTOR',
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Worker_organizationId_idx" ON "Worker"("organizationId");

-- CreateIndex
CREATE INDEX "Worker_organizationId_workerType_idx" ON "Worker"("organizationId", "workerType");

-- AlterTable (nullable — NOT NULL + FK deferred until after backfill)
ALTER TABLE "Contractor" ADD COLUMN "workerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_workerId_key" ON "Contractor"("workerId");
