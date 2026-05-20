-- Organization Definitions Management — Step 5
-- Adds the PendingProjectMerge inbox table written by the sync service when
-- a Jira / Linear name collides with an existing Project. Resolved by an
-- admin via the Pending Merges UI.

-- CreateTable
CREATE TABLE "PendingProjectMerge" (
    "id"                  TEXT                  NOT NULL,
    "organizationId"      TEXT                  NOT NULL,
    "source"              "OrgDefinitionSource" NOT NULL,
    "externalId"          TEXT                  NOT NULL,
    "incomingName"        TEXT                  NOT NULL,
    "candidateProjectIds" TEXT[]                NOT NULL,
    "createdAt"           TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingProjectMerge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingProjectMerge_organizationId_source_externalId_key"
    ON "PendingProjectMerge" ("organizationId", "source", "externalId");
CREATE INDEX "PendingProjectMerge_organizationId_idx"
    ON "PendingProjectMerge" ("organizationId");

-- AddForeignKey
ALTER TABLE "PendingProjectMerge"
    ADD CONSTRAINT "PendingProjectMerge_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS — same pattern as the other org-scoped tables.
ALTER TABLE "PendingProjectMerge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PendingProjectMerge" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pendingprojectmerge_select ON "PendingProjectMerge";
CREATE POLICY pendingprojectmerge_select ON "PendingProjectMerge"
  FOR SELECT
  USING (app.org_match("organizationId") AND app.is_org_member());

DROP POLICY IF EXISTS pendingprojectmerge_write  ON "PendingProjectMerge";
CREATE POLICY pendingprojectmerge_write  ON "PendingProjectMerge"
  FOR ALL
  USING      (app.org_match("organizationId") AND app.can_write_ops())
  WITH CHECK (app.org_match("organizationId") AND app.can_write_ops());
