import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@contractor-ops/db";
import type { CredentialBlob } from "../types/credentials.js";
import type { ProviderHealthStatus } from "../types/health.js";
import type { OAuthConfig } from "../types/provider.js";
import type { WebhookVerificationResult } from "../types/webhook.js";
import { BaseAdapter } from "./base-adapter.js";

// ---------------------------------------------------------------------------
// Linear OAuth 2.0 Configuration
// ---------------------------------------------------------------------------

/**
 * Linear uses OAuth 2.0 Authorization Code Grant.
 * Token exchange uses application/x-www-form-urlencoded (NOT JSON).
 * After authorization, teams and organization info are discovered via GraphQL.
 *
 * Scopes:
 * - read — read issues, teams, projects, users
 * - write — create/update issues, comments, labels
 */
const LINEAR_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: "LINEAR_CLIENT_ID",
  clientSecretEnvVar: "LINEAR_CLIENT_SECRET",
  authorizationUrl: "https://linear.app/oauth/authorize",
  tokenUrl: "https://api.linear.app/oauth/token",
  scopes: ["read", "write"],
  redirectPath: "/api/oauth/linear/callback",
};

// ---------------------------------------------------------------------------
// Linear Adapter
// ---------------------------------------------------------------------------

/**
 * Integration adapter for Linear (issue lifecycle + bidirectional status sync).
 *
 * Supports:
 * - OAuth 2.0 Authorization Code Grant (URL-encoded token exchange)
 * - Workspace discovery via GraphQL (teams, states, organization)
 * - Webhook signature verification (HMAC-SHA256 with Linear-Signature header)
 * - Health status checks via sync log
 *
 * Env vars required:
 * - LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET — for OAuth
 * - LINEAR_ENCRYPTION_KEY — for credential encryption at rest
 * - LINEAR_WEBHOOK_SECRET — for webhook signature verification (per-connection)
 */
export class LinearAdapter extends BaseAdapter {
  readonly slug = "linear";
  readonly displayName = "Linear";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  getOAuthConfig(): OAuthConfig {
    return LINEAR_OAUTH_CONFIG;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        "LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET environment variables are required",
      );
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch("https://api.linear.app/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Linear OAuth exchange failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string[] | string;
    };

    // Linear returns scope as an array of strings — join with comma for storage
    const scope = Array.isArray(data.scope) ? data.scope.join(",") : data.scope;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        "LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET environment variables are required",
      );
    }

    if (!credentials.refreshToken) {
      throw new Error("No refresh token available for Linear");
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credentials.refreshToken,
    });

    const response = await fetch("https://api.linear.app/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Linear token refresh failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope: string[] | string;
    };

    const scope = Array.isArray(data.scope) ? data.scope.join(",") : data.scope;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      tokenType: data.token_type,
      scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------

  /**
   * Verifies an inbound Linear webhook signature using HMAC-SHA256.
   *
   * Linear sends a `linear-signature` header containing the hex HMAC-SHA256
   * digest of the raw body, computed with the webhook signing secret.
   * The secret is passed via the `x-webhook-secret` header by the webhook
   * pipeline, or falls back to the LINEAR_WEBHOOK_SECRET env var.
   *
   * @param rawBody - The raw request body string
   * @param headers - Request headers (lowercased keys)
   * @returns Verification result with eventType extracted as type.action
   */
  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): WebhookVerificationResult {
    const signatureHeader = headers["linear-signature"] ?? headers["Linear-Signature"];
    const secret =
      headers["x-webhook-secret"] ??
      headers["X-Webhook-Secret"] ??
      process.env.LINEAR_WEBHOOK_SECRET;

    if (!secret) {
      // No secret configured — cannot verify
      return { valid: false };
    }

    if (!signatureHeader) {
      return { valid: false };
    }

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

    let valid: boolean;
    try {
      valid = timingSafeEqual(Buffer.from(signatureHeader, "hex"), Buffer.from(expected, "hex"));
    } catch {
      // Buffer length mismatch — invalid signature
      valid = false;
    }

    let eventType: string | undefined;
    if (valid) {
      try {
        const parsed = JSON.parse(rawBody) as {
          type?: string;
          action?: string;
        };
        if (parsed.type && parsed.action) {
          eventType = `${parsed.type}.${parsed.action}`;
        }
      } catch {
        // Payload parse failure handled downstream
      }
    }

    return { valid, eventType };
  }

  /**
   * Handles an inbound Linear webhook payload.
   *
   * This is a thin entry point called by the webhook pipeline.
   * The actual processing is delegated to the _process route which calls
   * processLinearWebhook from @contractor-ops/api.
   */
  async handleWebhook(
    _payload: unknown,
    _organizationId: string,
    _connectionId: string,
  ): Promise<void> {
    // Webhook processing is handled by the _process route which calls
    // processLinearWebhook from @contractor-ops/api. This method exists
    // to satisfy the BaseAdapter interface and signal webhook support.
  }

  // -------------------------------------------------------------------------
  // Scopes
  // -------------------------------------------------------------------------

  /**
   * Returns the full set of OAuth scopes required by the Linear adapter.
   */
  getRequiredScopes(): string[] {
    return ["read", "write"];
  }

  // -------------------------------------------------------------------------
  // Workspace Discovery
  // -------------------------------------------------------------------------

  /**
   * Discovers Linear workspace teams and organization info via GraphQL.
   * Called after token exchange to populate the connection config with
   * team IDs, names, keys, and workflow states for status mapping.
   *
   * @param accessToken - The OAuth access token from token exchange
   * @returns Organization and teams with their workflow states
   */
  async discoverWorkspace(accessToken: string): Promise<{
    organizationId: string;
    organizationName: string;
    urlKey: string;
    teams: Array<{
      id: string;
      name: string;
      key: string;
      states: Array<{
        id: string;
        name: string;
        type: string;
        color: string;
        position: number;
      }>;
    }>;
  }> {
    const query = `{
      teams {
        nodes {
          id
          name
          key
          states {
            nodes {
              id
              name
              type
              color
              position
            }
          }
        }
      }
      organization {
        id
        name
        urlKey
      }
    }`;

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Linear workspace discovery failed: ${text}`);
    }

    const result = (await response.json()) as {
      data: {
        teams: {
          nodes: Array<{
            id: string;
            name: string;
            key: string;
            states: {
              nodes: Array<{
                id: string;
                name: string;
                type: string;
                color: string;
                position: number;
              }>;
            };
          }>;
        };
        organization: {
          id: string;
          name: string;
          urlKey: string;
        };
      };
    };

    return {
      organizationId: result.data.organization.id,
      organizationName: result.data.organization.name,
      urlKey: result.data.organization.urlKey,
      teams: result.data.teams.nodes.map((team) => ({
        id: team.id,
        name: team.name,
        key: team.key,
        states: team.states.nodes.map((state) => ({
          id: state.id,
          name: state.name,
          type: state.type,
          color: state.color,
          position: state.position,
        })),
      })),
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
        provider: "linear",
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
    if (connection.status !== "CONNECTED" && connection.status !== "PENDING_MAPPING") {
      status = "DISCONNECTED";
    } else if (connection.lastErrorAt && !connection.lastSuccessAt) {
      status = "ERROR";
    } else if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      status = "REAUTH_REQUIRED";
    } else if (recentSyncs[0]?.status === "FAILED") {
      status = "ERROR";
    } else {
      status = "CONNECTED";
    }

    return {
      status,
      provider: "linear",
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
