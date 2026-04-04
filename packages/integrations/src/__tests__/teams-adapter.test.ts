import { describe, it, expect } from "vitest";
import { TeamsAdapter } from "../adapters/teams-adapter.js";

describe("TeamsAdapter", () => {
  const adapter = new TeamsAdapter();

  describe("identity", () => {
    it("has slug 'microsoft_teams'", () => {
      expect(adapter.slug).toBe("microsoft_teams");
    });

    it("has displayName 'Microsoft Teams'", () => {
      expect(adapter.displayName).toBe("Microsoft Teams");
    });

    it("supports OAuth", () => {
      expect(adapter.supportsOAuth).toBe(true);
    });

    it("does not support webhooks (Bot Framework handles messaging)", () => {
      expect(adapter.supportsWebhooks).toBe(false);
    });
  });

  describe("getOAuthConfig", () => {
    it("returns Azure AD OAuth config", () => {
      const config = adapter.getOAuthConfig();

      expect(config).toBeDefined();
      expect(config.clientIdEnvVar).toBe("AZURE_BOT_APP_ID");
      expect(config.clientSecretEnvVar).toBe("AZURE_BOT_APP_SECRET");
      expect(config.authorizationUrl).toBe(
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      );
      expect(config.tokenUrl).toBe(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      );
    });

    it("requests Graph API scopes for teams, channels, user, and offline_access", () => {
      const config = adapter.getOAuthConfig();

      expect(config.scopes).toContain(
        "https://graph.microsoft.com/Team.ReadBasic.All",
      );
      expect(config.scopes).toContain(
        "https://graph.microsoft.com/Channel.ReadBasic.All",
      );
      expect(config.scopes).toContain(
        "https://graph.microsoft.com/User.Read",
      );
      expect(config.scopes).toContain("offline_access");
    });

    it("uses the correct redirect path with underscore slug", () => {
      const config = adapter.getOAuthConfig();
      expect(config.redirectPath).toBe(
        "/api/oauth/microsoft_teams/callback",
      );
    });
  });
});
