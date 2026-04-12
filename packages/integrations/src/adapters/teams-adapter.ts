import { prisma } from "@contractor-ops/db";
import { decryptCredentials } from "../services/credential-service.js";
import type { CredentialBlob } from "../types/credentials.js";
import type { ProviderHealthStatus } from "../types/health.js";
import type { OAuthConfig } from "../types/provider.js";
import { BaseAdapter } from "./base-adapter.js";

// ---------------------------------------------------------------------------
// Azure AD / Microsoft Teams OAuth 2.0 Configuration
// ---------------------------------------------------------------------------

/**
 * Microsoft Teams uses Azure AD OAuth 2.0 Authorization Code Grant.
 * The bot communicates via Bot Framework; generic webhooks are not used.
 *
 * Scopes:
 * - Team.ReadBasic.All   -- list joined teams
 * - Channel.ReadBasic.All -- list team channels
 * - User.Read            -- read user profile
 * - offline_access       -- refresh tokens
 */
const TEAMS_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: "AZURE_BOT_APP_ID",
  clientSecretEnvVar: "AZURE_BOT_APP_SECRET",
  authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  scopes: [
    "https://graph.microsoft.com/Team.ReadBasic.All",
    "https://graph.microsoft.com/Channel.ReadBasic.All",
    "https://graph.microsoft.com/User.Read",
    "offline_access",
  ],
  redirectPath: "/api/oauth/microsoft_teams/callback",
};

// ---------------------------------------------------------------------------
// Teams Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for Microsoft Teams (approval cards, reminders, alerts).
 *
 * Supports:
 * - OAuth 2.0 Authorization Code Grant via Azure AD
 * - Token refresh with AES-256-GCM encrypted credential storage
 * - Health status checks via integration connection state
 *
 * Does NOT use generic webhooks — Bot Framework handles its own messaging
 * channel via the Bot Framework Adapter (see Plan 03).
 *
 * Env vars required:
 * - AZURE_BOT_APP_ID, AZURE_BOT_APP_SECRET — for OAuth + Bot Framework
 * - MICROSOFT_TEAMS_ENCRYPTION_KEY — for credential encryption at rest
 */
export class TeamsAdapter extends BaseAdapter {
  readonly slug = "microsoft_teams";
  readonly displayName = "Microsoft Teams";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  getOAuthConfig(): OAuthConfig {
    return TEAMS_OAUTH_CONFIG;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.AZURE_BOT_APP_ID;
    const clientSecret = process.env.AZURE_BOT_APP_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "AZURE_BOT_APP_ID and AZURE_BOT_APP_SECRET environment variables are required",
      );
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      scope: TEAMS_OAUTH_CONFIG.scopes.join(" "),
    });

    const response = await fetch(TEAMS_OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Microsoft Teams OAuth exchange failed: ${text}`);
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
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const clientId = process.env.AZURE_BOT_APP_ID;
    const clientSecret = process.env.AZURE_BOT_APP_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "AZURE_BOT_APP_ID and AZURE_BOT_APP_SECRET environment variables are required",
      );
    }

    // Decrypt stored credentials using AES-256-GCM per-provider encryption
    const decrypted = decryptCredentials(credentials.accessToken, "microsoft_teams");

    if (!decrypted.refreshToken) {
      throw new Error("No refresh token available for Microsoft Teams");
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decrypted.refreshToken,
      scope: TEAMS_OAUTH_CONFIG.scopes.join(" "),
    });

    const response = await fetch(TEAMS_OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Microsoft Teams token refresh failed: ${text}`);
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
      refreshToken: data.refresh_token ?? decrypted.refreshToken,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Health Status
  // -------------------------------------------------------------------------

  async getHealthStatus(connectionId: string): Promise<ProviderHealthStatus> {
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
        provider: "microsoft_teams",
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
    } else if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      status = "REAUTH_REQUIRED";
    } else if (recentSyncs.length > 0 && recentSyncs[0]!.status === "FAILED") {
      status = "ERROR";
    } else {
      status = "CONNECTED";
    }

    return {
      status,
      provider: "microsoft_teams",
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
      recentWebhooks: [],
      errorCountLast24h,
    };
  }
}
