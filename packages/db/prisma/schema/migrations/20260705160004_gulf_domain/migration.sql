-- Gulf (F3) domain substrate — UAE free-zone tracking + Saudization data layer
-- (additive, reversible). Creates the UaeFreeZoneCode enum and the four gulf
-- tables (FreeZoneAssignment, SaudizationConfig, SaudiHeadcount, UaeFreeZone)
-- exactly as declared in gulf.prisma.
--
-- These models previously existed only via db push / dev-drift and had NO
-- migration of their own — the exact gap the migration-drift check guards against
-- (a model queryable in code yet absent from a fresh regional database). This
-- migration closes that gap so a clean `migrate diff --from-migrations` replay
-- reproduces the gulf schema.
--
-- Additive only: it creates one new enum and four new tables with their
-- unique/lookup indexes and foreign keys to Organization and Contractor. It does
-- NOT alter any existing table and performs NO backfill — every existing row is
-- untouched, so applying it cannot fail on existing data.
--
-- ORDERING: the NitaqatBand enum (SaudizationConfig.band) is CREATED by
-- 20260705160003_employee_profile_additive, which replays before this migration,
-- so the type already exists here and is NOT re-created. FreeZoneAssignment /
-- SaudizationConfig / SaudiHeadcount reference Organization and Contractor (from
-- the baseline). The timestamp ordering guarantees all dependencies replay first.
--
-- REGION: the same schema deploys to BOTH the EU and ME physical databases; UAE/KSA
-- orgs live in the ME database and these models are reached only via a region-aware
-- client. Apply per region (EU/ME/US) via `pnpm db:migrate:all`; prod apply stays a
-- deferred ops action under the local-only posture. Reversible via down.sql.

-- CreateEnum
CREATE TYPE "UaeFreeZoneCode" AS ENUM ('DIFC', 'DMCC', 'IFZA', 'DUBAI_INTERNET_CITY', 'DUBAI_MEDIA_CITY', 'MEYDAN_FZ', 'JAFZA', 'SHAMS', 'RAKEZ', 'ADGM', 'MAINLAND');

-- CreateTable
CREATE TABLE "FreeZoneAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "zone" "UaeFreeZoneCode" NOT NULL,
    "licenseNumber" TEXT,
    "licenseCategory" TEXT,
    "licenseExpiresAt" DATE,
    "permittedActivitiesText" TEXT,
    "permittedActivityIsicCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreeZoneAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaudizationConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "band" "NitaqatBand",
    "industrySegment" TEXT,
    "bandLastUpdatedAt" TIMESTAMP(3),
    "thresholdsCustom" BOOLEAN NOT NULL DEFAULT false,
    "permittedActivityCatalogueCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaudizationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaudiHeadcount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "totalHeadcount" INTEGER NOT NULL,
    "saudiHeadcount" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaudiHeadcount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UaeFreeZone" (
    "code" "UaeFreeZoneCode" NOT NULL,
    "authorityLegalNameKey" TEXT NOT NULL,
    "isMainland" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UaeFreeZone_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "FreeZoneAssignment_contractorId_key" ON "FreeZoneAssignment"("contractorId");

-- CreateIndex
CREATE INDEX "FreeZoneAssignment_organizationId_idx" ON "FreeZoneAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "FreeZoneAssignment_organizationId_licenseExpiresAt_idx" ON "FreeZoneAssignment"("organizationId", "licenseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FreeZoneAssignment_organizationId_contractorId_key" ON "FreeZoneAssignment"("organizationId", "contractorId");

-- CreateIndex
CREATE INDEX "SaudizationConfig_organizationId_idx" ON "SaudizationConfig"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SaudizationConfig_organizationId_key" ON "SaudizationConfig"("organizationId");

-- CreateIndex
CREATE INDEX "SaudiHeadcount_organizationId_idx" ON "SaudiHeadcount"("organizationId");

-- CreateIndex
CREATE INDEX "SaudiHeadcount_organizationId_recordedAt_idx" ON "SaudiHeadcount"("organizationId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UaeFreeZone_code_key" ON "UaeFreeZone"("code");

-- AddForeignKey
ALTER TABLE "FreeZoneAssignment" ADD CONSTRAINT "FreeZoneAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeZoneAssignment" ADD CONSTRAINT "FreeZoneAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaudizationConfig" ADD CONSTRAINT "SaudizationConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaudiHeadcount" ADD CONSTRAINT "SaudiHeadcount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
