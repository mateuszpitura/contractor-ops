import { describe, it } from "vitest";

describe("Linear validators", () => {
  describe("linearWebhookPayloadSchema", () => {
    it.todo("accepts valid Issue update payload");
    it.todo("rejects payload with missing required fields");
    it.todo("accepts payload with optional updatedFrom");
  });

  describe("linearTaskConfigSchema", () => {
    it.todo("accepts valid config with linearEnabled and teamId");
    it.todo("defaults linearEnabled to false");
  });

  describe("linearStatusMappingSchema", () => {
    it.todo("accepts record of teamId to mapping entries");
    it.todo("validates linearStateType enum values");
  });

  describe("linearIssueMetadataSchema", () => {
    it.todo("accepts valid issue metadata");
    it.todo("validates statusType enum");
    it.todo("accepts optional lastSyncOrigin and lastSyncAt");
  });
});
