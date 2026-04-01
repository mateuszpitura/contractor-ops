import { describe, it, expect } from "vitest";

describe("LinearIssueSyncService", () => {
  describe("createLinearIssue", () => {
    it.todo("creates issue with title and description via issueCreate mutation");
    it.todo("looks up assignee by email and sets assigneeId");
    it.todo("falls back to unassigned when email has no Linear match per D-07");
    it.todo("creates ExternalLink with LINEAR_ISSUE type and correct metadata");
    it.todo("logs OUTBOUND ISSUE_CREATE to IntegrationSyncLog");
  });

  describe("syncTaskStatusToLinear", () => {
    it.todo("resolves target stateId from status mapping and calls issueUpdate");
    it.todo("skips sync when no ExternalLink exists for taskRun");
    it.todo("suppresses sync when lastSyncOrigin is LINEAR within 30s window");
    it.todo("updates ExternalLink metadata with new status and lastSyncOrigin APP");
    it.todo("returns early when status is unmapped");
  });

  describe("processLinearWebhook", () => {
    it.todo("updates task status from inbound state change webhook");
    it.todo("ignores webhooks for unlinked issues");
    it.todo("suppresses webhook when lastSyncOrigin is APP within 30s window");
    it.todo("logs unmapped stateId to webhook delivery per D-04");
  });
});
