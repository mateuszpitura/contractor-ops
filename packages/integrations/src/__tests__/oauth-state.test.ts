import { afterEach, describe, expect, it, vi } from "vitest";
import { generateOAuthState, verifyOAuthState } from "../services/oauth-state.js";

const TEST_SECRET = "test-signing-secret-for-oauth-state";

describe("oauth-state", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateOAuthState / verifyOAuthState round-trip", () => {
    it("should generate and verify a valid state", () => {
      const state = generateOAuthState("slack", "org-123", "user-456", TEST_SECRET);

      expect(typeof state).toBe("string");
      expect(state.length).toBeGreaterThan(0);

      const payload = verifyOAuthState(state, "slack", TEST_SECRET);
      expect(payload).not.toBeNull();
      expect(payload?.provider).toBe("slack");
      expect(payload?.orgId).toBe("org-123");
      expect(payload?.userId).toBe("user-456");
      expect(typeof payload?.timestamp).toBe("number");
    });
  });

  describe("cross-provider CSRF protection", () => {
    it("should return null when provider does not match expected", () => {
      const state = generateOAuthState("slack", "org-123", "user-456", TEST_SECRET);

      // Verify with a different provider slug
      const payload = verifyOAuthState(state, "jira", TEST_SECRET);
      expect(payload).toBeNull();
    });
  });

  describe("wrong secret", () => {
    it("should return null when verified with a different secret", () => {
      const state = generateOAuthState("slack", "org-123", "user-456", TEST_SECRET);

      const payload = verifyOAuthState(state, "slack", "wrong-secret");
      expect(payload).toBeNull();
    });
  });

  describe("expired state", () => {
    it("should return null for state older than 10 minutes", () => {
      // Generate state, then advance time past the 10-minute window
      const state = generateOAuthState("slack", "org-123", "user-456", TEST_SECRET);

      const elevenMinutes = 11 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + elevenMinutes);

      const payload = verifyOAuthState(state, "slack", TEST_SECRET);
      expect(payload).toBeNull();
    });

    it("should accept state within the 10-minute window", () => {
      const state = generateOAuthState("slack", "org-123", "user-456", TEST_SECRET);

      const nineMinutes = 9 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + nineMinutes);

      const payload = verifyOAuthState(state, "slack", TEST_SECRET);
      expect(payload).not.toBeNull();
    });
  });

  describe("tampered state", () => {
    it("should return null for tampered payload", () => {
      const state = generateOAuthState("slack", "org-123", "user-456", TEST_SECRET);

      // Decode, tamper, re-encode
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
      decoded.orgId = "org-HACKED";
      const tampered = Buffer.from(JSON.stringify(decoded)).toString("base64url");

      const payload = verifyOAuthState(tampered, "slack", TEST_SECRET);
      expect(payload).toBeNull();
    });

    it("should return null for completely invalid base64url input", () => {
      const payload = verifyOAuthState("not-valid-state", "slack", TEST_SECRET);
      expect(payload).toBeNull();
    });

    it("should return null for empty string", () => {
      const payload = verifyOAuthState("", "slack", TEST_SECRET);
      expect(payload).toBeNull();
    });
  });
});
