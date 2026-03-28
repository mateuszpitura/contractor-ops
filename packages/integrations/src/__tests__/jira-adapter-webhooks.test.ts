import { describe, it, expect } from "vitest";

describe("jira-adapter-webhooks", () => {
  describe("verifyWebhookSignature", () => {
    it.todo(
      "returns valid=true when HMAC-SHA256 signature matches",
    );
    it.todo(
      "returns valid=false when signature does not match",
    );
    it.todo(
      "returns valid=false when signature header is missing",
    );
    it.todo("uses timingSafeEqual for constant-time comparison");
    it.todo(
      "extracts eventType from parsed payload webhookEvent field",
    );
  });

  describe("getRequiredScopes", () => {
    it.todo("returns array including read:jira-work");
    it.todo("returns array including write:jira-work");
    it.todo("returns array including manage:jira-webhook");
    it.todo("returns array including offline_access");
  });

  describe("supportsWebhooks", () => {
    it.todo("returns true");
  });

  describe("scope expansion detection", () => {
    it.todo(
      "detects when stored credentials lack write:jira-work scope",
    );
    it.todo(
      "detects when stored credentials lack manage:jira-webhook scope",
    );
  });
});
