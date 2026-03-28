import { describe, it, expect } from "vitest";

describe("jira-status-mapping", () => {
  describe("saveStatusMapping", () => {
    it.todo(
      "stores mapping in IntegrationConnection.configJson.statusMappings keyed by project ID",
    );
    it.todo("overwrites existing mapping for the same project");
    it.todo("preserves other configJson fields when updating");
  });

  describe("getStatusMapping", () => {
    it.todo("returns mapping for a given project ID");
    it.todo("returns null when no mapping exists for project");
  });

  describe("lookupJiraTransitionId", () => {
    it.todo(
      "returns Jira transition ID for a given WorkflowTaskStatus and project",
    );
    it.todo("returns null for unmapped status");
  });

  describe("lookupWorkflowStatus", () => {
    it.todo(
      "returns WorkflowTaskStatus for a given Jira status name and project",
    );
    it.todo("returns null for unmapped Jira status");
  });
});
