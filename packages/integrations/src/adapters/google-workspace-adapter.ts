import { prisma } from "@contractor-ops/db";
import type { CredentialBlob } from "../types/credentials.js";
import type { ProviderHealthStatus } from "../types/health.js";
import type { OAuthConfig } from "../types/provider.js";
import { BaseAdapter } from "./base-adapter.js";

// ---------------------------------------------------------------------------
// Google Workspace Admin SDK Types
// ---------------------------------------------------------------------------

export interface GoogleDirectoryUser {
  id: string;
  primaryEmail: string;
  name: { givenName: string; familyName: string; fullName: string };
  thumbnailPhotoUrl?: string;
  orgUnitPath?: string;
  organizations?: Array<{
    department?: string;
    title?: string;
    primary?: boolean;
  }>;
  suspended?: boolean;
  isAdmin?: boolean;
}

export interface GoogleGroup {
  id: string;
  email: string;
  name: string;
  description?: string;
  directMembersCount?: string;
}

// ---------------------------------------------------------------------------
// Google Workspace OAuth 2.0 Configuration
// ---------------------------------------------------------------------------

/**
 * Google Workspace uses OAuth 2.0 Authorization Code Grant with Admin SDK scopes.
 *
 * Scopes:
 * - admin.directory.user.readonly — list directory users
 * - admin.directory.group.readonly — list group memberships
 *
 * Env vars required:
 * - GOOGLE_WORKSPACE_CLIENT_ID, GOOGLE_WORKSPACE_CLIENT_SECRET — for OAuth
 * - GOOGLE_WORKSPACE_ENCRYPTION_KEY — for credential encryption at rest
 *
 * Slug uses underscore so `.toUpperCase()` maps to `GOOGLE_WORKSPACE` Prisma enum.
 */
const GOOGLE_WORKSPACE_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: "GOOGLE_WORKSPACE_CLIENT_ID",
  clientSecretEnvVar: "GOOGLE_WORKSPACE_CLIENT_SECRET",
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: [
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
    "https://www.googleapis.com/auth/admin.directory.group.readonly",
  ],
  redirectPath: "/api/oauth/google_workspace/callback",
  extraAuthParams: {
    access_type: "offline",
    prompt: "consent",
  },
};

// ---------------------------------------------------------------------------
// Google Workspace Adapter
// ---------------------------------------------------------------------------

export class GoogleWorkspaceAdapter extends BaseAdapter {
  /**
   * Slug uses underscore so `.toUpperCase()` produces `GOOGLE_WORKSPACE`
   * matching the Prisma IntegrationProvider enum value.
   */
  readonly slug = "google_workspace";
  readonly displayName = "Google Workspace";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  getOAuthConfig(): OAuthConfig {
    return GOOGLE_WORKSPACE_OAUTH_CONFIG;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "GOOGLE_WORKSPACE_CLIENT_ID and GOOGLE_WORKSPACE_CLIENT_SECRET environment variables are required",
      );
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
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
      throw new Error(`Google Workspace OAuth exchange failed: ${text}`);
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
    const clientId = process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "GOOGLE_WORKSPACE_CLIENT_ID and GOOGLE_WORKSPACE_CLIENT_SECRET environment variables are required",
      );
    }

    if (!credentials.refreshToken) {
      throw new Error("No refresh token available for Google Workspace");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
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
      throw new Error(`Google Workspace token refresh failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: credentials.refreshToken, // Google doesn't rotate refresh tokens
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Directory API
  // -------------------------------------------------------------------------

  /**
   * Lists all non-suspended users in the Google Workspace directory.
   * Paginates through the Admin SDK Directory API with `customer=my_customer`
   * to list all users across the domain.
   */
  async listAllDirectoryUsers(accessToken: string): Promise<GoogleDirectoryUser[]> {
    const allUsers: GoogleDirectoryUser[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL("https://admin.googleapis.com/admin/directory/v1/users");
      url.searchParams.set("customer", "my_customer");
      url.searchParams.set("maxResults", "500");
      url.searchParams.set("projection", "FULL");
      url.searchParams.set("orderBy", "EMAIL");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google Workspace Directory API failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as {
        users?: GoogleDirectoryUser[];
        nextPageToken?: string;
      };

      if (data.users) {
        // Filter out suspended users
        const activeUsers = data.users.filter((u) => !u.suspended);
        allUsers.push(...activeUsers);
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    return allUsers;
  }

  /**
   * Lists all groups a user belongs to in the Google Workspace directory.
   * Returns empty array on 404 (user not in any groups).
   */
  async listUserGroups(accessToken: string, userEmail: string): Promise<GoogleGroup[]> {
    const allGroups: GoogleGroup[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL("https://admin.googleapis.com/admin/directory/v1/groups");
      url.searchParams.set("userKey", userEmail);
      url.searchParams.set("maxResults", "200");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // 404 means user is not a member of any groups
      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google Workspace Groups API failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as {
        groups?: GoogleGroup[];
        nextPageToken?: string;
      };

      if (data.groups) {
        allGroups.push(...data.groups);
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    return allGroups;
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
        provider: "google_workspace",
        recentSyncs: [],
        recentWebhooks: [],
        errorCountLast24h: 0,
      };
    }

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

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const errorCountLast24h = await prisma.integrationSyncLog.count({
      where: {
        integrationConnectionId: connectionId,
        status: "FAILED",
        startedAt: { gte: oneDayAgo },
      },
    });

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
      provider: "google_workspace",
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
