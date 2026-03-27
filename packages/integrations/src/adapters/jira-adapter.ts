import type { OAuthConfig } from "../types/provider.js";
import type { CredentialBlob } from "../types/credentials.js";
import type { ProviderHealthStatus } from "../types/health.js";
import { BaseAdapter } from "./base-adapter.js";

// ---------------------------------------------------------------------------
// Jira OAuth 2.0 3LO Configuration
// ---------------------------------------------------------------------------

/**
 * Jira Cloud uses OAuth 2.0 Authorization Code Grant (3LO).
 * After token exchange, the accessible-resources endpoint must be called
 * to discover the cloudId (required for all API calls).
 *
 * Scopes:
 * - read:jira-work — read worklogs, issues, projects
 * - offline_access — receive a refresh token for long-lived access
 */
const JIRA_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: "JIRA_CLIENT_ID",
  clientSecretEnvVar: "JIRA_CLIENT_SECRET",
  authorizationUrl: "https://auth.atlassian.com/authorize",
  tokenUrl: "https://auth.atlassian.com/oauth/token",
  scopes: ["read:jira-work", "offline_access"],
  redirectPath: "/api/oauth/jira/callback",
};

/**
 * Extra parameters required by Atlassian's OAuth flow.
 * - audience: Required by Atlassian to identify the API resource
 * - prompt: Forces consent screen to ensure refresh token is returned
 */
export const JIRA_EXTRA_AUTH_PARAMS: Record<string, string> = {
  audience: "api.atlassian.com",
  prompt: "consent",
};

// ---------------------------------------------------------------------------
// Jira Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for Jira Cloud (worklog import).
 *
 * Supports:
 * - OAuth 2.0 3LO Authorization Code Grant
 * - Cloud ID discovery via accessible-resources endpoint
 * - Health status checks via sync log
 *
 * Does NOT support webhooks in this phase (D-09: on-demand polling only).
 * Full Jira integration with issue sync deferred to Phase 19 (D-12).
 *
 * Env vars required:
 * - JIRA_CLIENT_ID, JIRA_CLIENT_SECRET — for OAuth
 * - JIRA_ENCRYPTION_KEY — for credential encryption at rest
 */
export class JiraAdapter extends BaseAdapter {
  readonly slug = "jira";
  readonly displayName = "Jira";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  getOAuthConfig(): OAuthConfig {
    return JIRA_OAUTH_CONFIG;
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<CredentialBlob> {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "JIRA_CLIENT_ID and JIRA_CLIENT_SECRET environment variables are required",
      );
    }

    const response = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira OAuth exchange failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(
        Date.now() + data.expires_in * 1000,
      ).toISOString(),
    };
  }

  async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "JIRA_CLIENT_ID and JIRA_CLIENT_SECRET environment variables are required",
      );
    }

    if (!credentials.refreshToken) {
      throw new Error("No refresh token available for Jira");
    }

    const response = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: credentials.refreshToken,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira token refresh failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(
        Date.now() + data.expires_in * 1000,
      ).toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Cloud ID Discovery
  // -------------------------------------------------------------------------

  /**
   * Discovers accessible Jira Cloud sites after OAuth authorization.
   * Returns the first accessible resource's cloudId and site URL.
   *
   * Must be called after token exchange to obtain the cloudId needed
   * for all subsequent Jira API calls. The cloudId should be stored
   * in IntegrationConnection.configJson.
   *
   * @param accessToken - The OAuth access token from token exchange
   * @returns The cloudId and site name for the accessible Jira instance
   */
  async discoverCloudId(
    accessToken: string,
  ): Promise<{ cloudId: string; siteName: string; siteUrl: string }> {
    const response = await fetch(
      "https://api.atlassian.com/oauth/token/accessible-resources",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira accessible-resources discovery failed: ${text}`);
    }

    const resources = (await response.json()) as Array<{
      id: string;
      name: string;
      url: string;
      scopes: string[];
    }>;

    if (resources.length === 0) {
      throw new Error(
        "No accessible Jira Cloud sites found. The authorized user may not have access to any Jira instances.",
      );
    }

    const site = resources[0]!;
    return {
      cloudId: site.id,
      siteName: site.name,
      siteUrl: site.url,
    };
  }

  // -------------------------------------------------------------------------
  // Health Status
  // -------------------------------------------------------------------------

  async getHealthStatus(connectionId: string): Promise<ProviderHealthStatus> {
    const { prisma } = await import("@contractor-ops/db");

    const connection = await prisma.integrationConnection.findUnique({
      where: { id: connectionId },
      select: {
        provider: true,
        displayName: true,
        connectedAt: true,
        lastSyncAt: true,
        lastSuccessAt: true,
        lastErrorAt: true,
        lastErrorMessage: true,
        tokenExpiresAt: true,
        status: true,
      },
    });

    if (!connection) {
      return {
        status: "DISCONNECTED",
        provider: "jira",
        recentSyncs: [],
        recentWebhooks: [],
        errorCountLast24h: 0,
      };
    }

    // Fetch recent sync logs
    const recentSyncs = await prisma.integrationSyncLog.findMany({
      where: { integrationConnectionId: connectionId },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        id: true,
        syncType: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    // Count errors in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const errorCountLast24h = await prisma.integrationSyncLog.count({
      where: {
        integrationConnectionId: connectionId,
        status: "FAILED",
        startedAt: { gte: oneDayAgo },
      },
    });

    // Determine status
    let status: ProviderHealthStatus["status"];
    if (connection.status !== "CONNECTED") {
      status = "DISCONNECTED";
    } else if (connection.lastErrorAt && !connection.lastSuccessAt) {
      status = "ERROR";
    } else if (
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt < new Date()
    ) {
      status = "REAUTH_REQUIRED";
    } else if (
      recentSyncs.length > 0 &&
      recentSyncs[0]!.status === "FAILED"
    ) {
      status = "ERROR";
    } else {
      status = "CONNECTED";
    }

    return {
      status,
      provider: "jira",
      displayName: connection.displayName,
      connectedAt: connection.connectedAt,
      lastSyncAt: connection.lastSyncAt,
      lastSuccessAt: connection.lastSuccessAt,
      lastErrorAt: connection.lastErrorAt,
      lastErrorMessage: connection.lastErrorMessage,
      tokenExpiresAt: connection.tokenExpiresAt,
      recentSyncs: recentSyncs.map((s) => ({
        id: s.id,
        syncType: s.syncType,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      recentWebhooks: [], // No webhooks in this phase (D-09)
      errorCountLast24h,
    };
  }
}
