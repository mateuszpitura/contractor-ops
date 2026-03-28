import { describe, it, expect } from "vitest";

describe("jira-issue-sync", () => {
  describe("createJiraIssue", () => {
    it.todo("creates a Jira issue via REST API with ADF description");
    it.todo(
      "stores issue key in WorkflowTaskRun.externalRefType=JIRA_ISSUE and externalRefId",
    );
    it.todo(
      "creates ExternalLink with entityType=WORKFLOW_TASK_RUN and externalType=JIRA_ISSUE",
    );
    it.todo(
      "populates ExternalLink.metadataJson with key, summary, status, statusCategory, url",
    );
    it.todo(
      "uses project and issueType from WorkflowTaskTemplate.configJson",
    );
    it.todo("generates issue summary as taskRun.title - contractorName");
    it.todo(
      "creates IntegrationSyncLog with direction=OUTBOUND, syncType=issue-create",
    );
    it.todo("throws TRPCError NOT_FOUND when connection missing");
    it.todo(
      "throws TRPCError PRECONDITION_FAILED when connection not CONNECTED",
    );
    it.todo("handles Jira 401 with UNAUTHORIZED TRPCError");
  });

  describe("transitionJiraIssue", () => {
    it.todo("executes Jira transition via POST /issue/{key}/transitions");
    it.todo(
      "looks up transition ID from status mapping by project and WorkflowTaskStatus",
    );
    it.todo(
      "sets lastSyncOrigin=APP and lastSyncAt on ExternalLink.metadataJson before transition",
    );
    it.todo(
      "creates IntegrationSyncLog with direction=OUTBOUND, syncType=issue-transition",
    );
    it.todo(
      "silently logs when no mapping exists for the workflow task status",
    );
    it.todo("handles Jira 400 transition error gracefully");
  });

  describe("detectScopeExpansionNeeded", () => {
    it.todo("returns true when stored scope lacks write:jira-work");
    it.todo("returns true when stored scope lacks manage:jira-webhook");
    it.todo("returns false when all required scopes present");
  });
});
