-- Organization Definitions Management — Step 1
-- Adds OrgDefinitionSource enum, source + externalId columns on Team and Project,
-- new ProjectExternalLink join table, plus filtered unique indexes for non-null
-- externalIds (Prisma's DSL can't model partial uniques, so the SQL is appended
-- after the generated CREATE statements).

-- CreateEnum
CREATE TYPE "OrgDefinitionSource" AS ENUM ('MANUAL', 'JIRA', 'LINEAR');

-- AlterTable
ALTER TABLE "Team"
    ADD COLUMN "source"     "OrgDefinitionSource" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN "externalId" TEXT;

-- AlterTable
ALTER TABLE "Project"
    ADD COLUMN "source"     "OrgDefinitionSource" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE INDEX "Team_organizationId_source_idx"    ON "Team"    ("organizationId", "source");
CREATE INDEX "Project_organizationId_source_idx" ON "Project" ("organizationId", "source");

-- Filtered unique indexes — externalId must be unique per (organizationId, source)
-- only when present. Multiple NULL externalIds (manual rows) coexist.
CREATE UNIQUE INDEX "Team_organizationId_source_externalId_uniq"
    ON "Team" ("organizationId", "source", "externalId")
    WHERE "externalId" IS NOT NULL;
CREATE UNIQUE INDEX "Project_organizationId_source_externalId_uniq"
    ON "Project" ("organizationId", "source", "externalId")
    WHERE "externalId" IS NOT NULL;

-- CreateTable
CREATE TABLE "ProjectExternalLink" (
    "id"             TEXT                  NOT NULL,
    "organizationId" TEXT                  NOT NULL,
    "projectId"      TEXT                  NOT NULL,
    "source"         "OrgDefinitionSource" NOT NULL,
    "externalId"     TEXT                  NOT NULL,
    "syncedAt"       TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectExternalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectExternalLink_organizationId_source_externalId_key"
    ON "ProjectExternalLink" ("organizationId", "source", "externalId");
CREATE UNIQUE INDEX "ProjectExternalLink_projectId_source_key"
    ON "ProjectExternalLink" ("projectId", "source");
CREATE INDEX "ProjectExternalLink_organizationId_idx" ON "ProjectExternalLink" ("organizationId");
CREATE INDEX "ProjectExternalLink_projectId_idx"      ON "ProjectExternalLink" ("projectId");

-- AddForeignKey
ALTER TABLE "ProjectExternalLink"
    ADD CONSTRAINT "ProjectExternalLink_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectExternalLink"
    ADD CONSTRAINT "ProjectExternalLink_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS — same pattern as ExternalLink / IntegrationConnection: scoped on the
-- denormalised organizationId column via app.org_match + app.is_org_member /
-- app.can_write_ops.
ALTER TABLE "ProjectExternalLink" ENABLE  ROW LEVEL SECURITY;
ALTER TABLE "ProjectExternalLink" FORCE   ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projectexternallink_select ON "ProjectExternalLink";
CREATE POLICY projectexternallink_select ON "ProjectExternalLink"
  FOR SELECT
  USING (app.org_match("organizationId") AND app.is_org_member());

DROP POLICY IF EXISTS projectexternallink_write  ON "ProjectExternalLink";
CREATE POLICY projectexternallink_write  ON "ProjectExternalLink"
  FOR ALL
  USING      (app.org_match("organizationId") AND app.can_write_ops())
  WITH CHECK (app.org_match("organizationId") AND app.can_write_ops());
