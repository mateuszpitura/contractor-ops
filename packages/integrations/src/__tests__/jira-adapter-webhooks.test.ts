import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { JiraAdapter } from "../adapters/jira-adapter.js";

describe("jira-adapter-webhooks", () => {
  let adapter: JiraAdapter;

  beforeEach(() => {
    adapter = new JiraAdapter();
  });

  describe("verifyWebhookSignature", () => {
    const secret = "jira-webhook-secret-123";

    it("returns valid=true when HMAC-SHA256 signature matches", () => {
      const body = JSON.stringify({ webhookEvent: "jira:issue_updated", issue: { key: "PROJ-1" } });
      const signature = createHmac("sha256", secret).update(body).digest("hex");

      const result = adapter.verifyWebhookSignature(body, {
        "x-hub-signature": `sha256=${signature}`,
        "x-webhook-secret": secret,
      });

      expect(result.valid).toBe(true);
    });

    it("returns valid=false when signature does not match", () => {
      const body = JSON.stringify({ webhookEvent: "jira:issue_created" });
      const wrongSignature = createHmac("sha256", "wrong-secret").update(body).digest("hex");

      const result = adapter.verifyWebhookSignature(body, {
        "x-hub-signature": `sha256=${wrongSignature}`,
        "x-webhook-secret": secret,
      });

      expect(result.valid).toBe(false);
    });

    it("returns valid=false when signature header is missing", () => {
      const body = JSON.stringify({ webhookEvent: "jira:issue_created" });

      const result = adapter.verifyWebhookSignature(body, {
        "x-webhook-secret": secret,
        // no x-hub-signature
      });

      expect(result.valid).toBe(false);
    });

    it("uses timingSafeEqual for constant-time comparison", () => {
      // Verify that a completely different-length signature doesn't crash
      // (timingSafeEqual throws on length mismatch, adapter catches it)
      const body = JSON.stringify({ webhookEvent: "test" });

      const result = adapter.verifyWebhookSignature(body, {
        "x-hub-signature": "sha256=tooshort",
        "x-webhook-secret": secret,
      });

      // Should not throw, should return false due to buffer length mismatch catch
      expect(result.valid).toBe(false);
    });

    it("extracts eventType from parsed payload webhookEvent field", () => {
      const body = JSON.stringify({ webhookEvent: "jira:issue_updated", issue: {} });
      const signature = createHmac("sha256", secret).update(body).digest("hex");

      const result = adapter.verifyWebhookSignature(body, {
        "x-hub-signature": `sha256=${signature}`,
        "x-webhook-secret": secret,
      });

      expect(result.valid).toBe(true);
      expect(result.eventType).toBe("jira:issue_updated");
    });
  });

  describe("getRequiredScopes", () => {
    it("returns array including read:jira-work", () => {
      expect(adapter.getRequiredScopes()).toContain("read:jira-work");
    });

    it("returns array including write:jira-work", () => {
      expect(adapter.getRequiredScopes()).toContain("write:jira-work");
    });

    it("returns array including manage:jira-webhook", () => {
      expect(adapter.getRequiredScopes()).toContain("manage:jira-webhook");
    });

    it("returns array including offline_access", () => {
      expect(adapter.getRequiredScopes()).toContain("offline_access");
    });
  });

  describe("supportsWebhooks", () => {
    it("returns true", () => {
      expect(adapter.supportsWebhooks).toBe(true);
    });
  });

  describe("scope expansion detection", () => {
    it("detects when stored credentials lack write:jira-work scope", () => {
      const storedScope = "read:jira-work offline_access";
      const required = adapter.getRequiredScopes();
      const storedScopes = storedScope.split(" ");
      const missing = required.filter((s) => !storedScopes.includes(s));

      expect(missing).toContain("write:jira-work");
      expect(missing).toContain("manage:jira-webhook");
    });

    it("detects when stored credentials lack manage:jira-webhook scope", () => {
      const storedScope = "read:jira-work write:jira-work offline_access";
      const required = adapter.getRequiredScopes();
      const storedScopes = storedScope.split(" ");
      const missing = required.filter((s) => !storedScopes.includes(s));

      expect(missing).toContain("manage:jira-webhook");
      expect(missing).not.toContain("read:jira-work");
      expect(missing).not.toContain("write:jira-work");
    });
  });
});
