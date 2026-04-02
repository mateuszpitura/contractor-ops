import { describe, it, expect } from "vitest";

describe("GoogleWorkspaceAdapter", () => {
  describe("OAuth configuration", () => {
    it.todo(
      "returns OAuth config with Admin SDK scopes (admin.directory.user.readonly, admin.directory.group.readonly)"
    );
    it.todo(
      "uses GOOGLE_WORKSPACE_CLIENT_ID and GOOGLE_WORKSPACE_CLIENT_SECRET env vars"
    );
    it.todo(
      "sets access_type=offline and prompt=consent in extra auth params"
    );
    it.todo("has slug 'google-workspace' and displayName 'Google Workspace'");
    it.todo("sets supportsOAuth=true and supportsWebhooks=false");
  });

  describe("exchangeCodeForTokens", () => {
    it.todo(
      "exchanges authorization code for access token and refresh token"
    );
    it.todo("throws on non-ok response from Google token endpoint");
  });

  describe("refreshToken", () => {
    it.todo("refreshes expired access token using refresh token");
    it.todo("throws on non-ok response from Google token endpoint");
  });
});
