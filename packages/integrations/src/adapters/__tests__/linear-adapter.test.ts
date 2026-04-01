import { describe, it } from "vitest";

describe("LinearAdapter", () => {
  describe("OAuth config", () => {
    it.todo("returns correct authorization URL");
    it.todo("returns correct token URL");
    it.todo("requests read and write scopes");
    it.todo("uses url-encoded content type for token exchange");
  });

  describe("exchangeCodeForTokens", () => {
    it.todo("exchanges authorization code for access + refresh tokens");
    it.todo("sets correct expiresAt from expires_in");
    it.todo("joins scope array into comma-separated string");
  });

  describe("refreshToken", () => {
    it.todo("refreshes access token using refresh token");
    it.todo("preserves old refresh token if new one not returned");
  });

  describe("verifyWebhookSignature", () => {
    it.todo("validates correct HMAC-SHA256 signature");
    it.todo("rejects invalid signature");
    it.todo("extracts eventType as type.action from payload");
    it.todo("returns invalid when signature header is missing");
  });

  describe("discoverWorkspace", () => {
    it.todo("fetches teams and organization info from GraphQL");
  });
});
