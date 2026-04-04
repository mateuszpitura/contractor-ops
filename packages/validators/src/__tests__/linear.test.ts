import { describe, it, expect } from "vitest";
import {
  linearWebhookPayloadSchema,
  linearTaskConfigSchema,
  linearStatusMappingSchema,
  linearIssueMetadataSchema,
} from "../linear.js";

// ---------------------------------------------------------------------------
// linearWebhookPayloadSchema
// ---------------------------------------------------------------------------

describe("linearWebhookPayloadSchema", () => {
  const validPayload = {
    action: "update" as const,
    type: "Issue" as const,
    organizationId: "org_abc",
    webhookTimestamp: 1711929600000,
    webhookId: "wh_123",
    url: "https://linear.app/team/issue/TEAM-1",
    actor: {
      id: "usr_1",
      type: "user",
    },
    data: {
      id: "iss_1",
      number: 42,
      identifier: "TEAM-42",
      title: "Fix the bug",
      stateId: "state_1",
      teamId: "team_1",
      url: "https://linear.app/team/issue/TEAM-42",
    },
  };

  it("accepts valid Issue update payload", () => {
    const result = linearWebhookPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects payload with missing required fields", () => {
    const { action, ...noAction } = validPayload;
    const actionResult = linearWebhookPayloadSchema.safeParse(noAction);
    expect(actionResult.success).toBe(false);
    if (!actionResult.success) {
      const paths = actionResult.error.issues.map((i) => i.path).flat();
      expect(paths).toContain("action");
    }

    const { data, ...noData } = validPayload;
    const dataResult = linearWebhookPayloadSchema.safeParse(noData);
    expect(dataResult.success).toBe(false);
    if (!dataResult.success) {
      const paths = dataResult.error.issues.map((i) => i.path).flat();
      expect(paths).toContain("data");
    }

    const { organizationId, ...noOrg } = validPayload;
    const orgResult = linearWebhookPayloadSchema.safeParse(noOrg);
    expect(orgResult.success).toBe(false);
    if (!orgResult.success) {
      const paths = orgResult.error.issues.map((i) => i.path).flat();
      expect(paths).toContain("organizationId");
    }
  });

  it("accepts payload with optional updatedFrom", () => {
    const result = linearWebhookPayloadSchema.safeParse({
      ...validPayload,
      updatedFrom: { stateId: "old_state" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.updatedFrom?.stateId).toBe("old_state");
    }
  });
});

// ---------------------------------------------------------------------------
// linearTaskConfigSchema
// ---------------------------------------------------------------------------

describe("linearTaskConfigSchema", () => {
  it("accepts valid config with linearEnabled and teamId", () => {
    const result = linearTaskConfigSchema.safeParse({
      linearEnabled: true,
      linearTeamId: "team_1",
      linearTeamKey: "TEAM",
      linearTeamName: "My Team",
    });
    expect(result.success).toBe(true);
  });

  it("defaults linearEnabled to false", () => {
    const result = linearTaskConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.linearEnabled).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// linearStatusMappingSchema
// ---------------------------------------------------------------------------

describe("linearStatusMappingSchema", () => {
  it("accepts record of teamId to mapping entries", () => {
    const result = linearStatusMappingSchema.safeParse({
      team_1: [
        {
          workflowStatus: "TODO",
          linearStateId: "state_1",
          linearStateName: "Todo",
          linearStateType: "unstarted",
        },
        {
          workflowStatus: "DONE",
          linearStateId: "state_2",
          linearStateName: "Done",
          linearStateType: "completed",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("validates linearStateType enum values", () => {
    const result = linearStatusMappingSchema.safeParse({
      team_1: [
        {
          workflowStatus: "TODO",
          linearStateId: "state_1",
          linearStateName: "Todo",
          linearStateType: "invalid_type",
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path).flat();
      expect(paths).toContain("linearStateType");
    }
  });
});

// ---------------------------------------------------------------------------
// linearIssueMetadataSchema
// ---------------------------------------------------------------------------

describe("linearIssueMetadataSchema", () => {
  const validMetadata = {
    identifier: "TEAM-42",
    linearIssueId: "iss_1",
    title: "Fix the bug",
    status: "In Progress",
    statusType: "started" as const,
    url: "https://linear.app/team/issue/TEAM-42",
  };

  it("accepts valid issue metadata", () => {
    const result = linearIssueMetadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
  });

  it("validates statusType enum", () => {
    const result = linearIssueMetadataSchema.safeParse({
      ...validMetadata,
      statusType: "not_a_type",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("statusType"),
      );
      expect(issue).toBeDefined();
    }
  });

  it("accepts optional lastSyncOrigin and lastSyncAt", () => {
    const result = linearIssueMetadataSchema.safeParse({
      ...validMetadata,
      lastSyncOrigin: "LINEAR",
      lastSyncAt: "2026-03-01T12:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lastSyncOrigin).toBe("LINEAR");
      expect(result.data.lastSyncAt).toBe("2026-03-01T12:00:00Z");
    }
  });
});
