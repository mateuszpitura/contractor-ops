-- Incident history for the public status page (additive, reversible).
--
-- Three additive pieces, no backfill:
--   1. Two new enums (IncidentStatus, IncidentSeverity) + the IncidentReport
--      table — operator-authored incident history for the public /status.json.
--      Global (NOT tenant-scoped): no organizationId, no RLS — a
--      platform-operator resource, never customer data.
--   2. EntityType gains INCIDENT (audited by the incident router).
--
-- Every object is new; no existing table or row is touched. Applying to a
-- populated database performs NO backfill.
--
-- ORDERING: standalone — depends only on the EntityType enum (already present).
--
-- Reversibility: the paired down.sql drops the table + the two new enums but
-- leaves the INCIDENT EntityType value in place (Postgres cannot DROP a single
-- enum value) — harmless + unused.
--
-- NOT APPLIED by codegen. Authored as a file; applied per region (EU, then ME,
-- then US) at the blocking human migration gate.

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- AlterEnum (EntityType — audit resource type for the incident router)
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'INCIDENT';

-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MINOR',
    "componentsAffected" TEXT[],
    "updates" JSONB[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentReport_status_startedAt_idx" ON "IncidentReport"("status", "startedAt");
