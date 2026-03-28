import { createHmac, timingSafeEqual } from "node:crypto";
import type { OAuthConfig } from "../types/provider.js";
import type { CredentialBlob } from "../types/credentials.js";
import type { WebhookVerificationResult } from "../types/webhook.js";
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
 * - write:jira-work — create issues, execute transitions
 * - manage:jira-webhook — register/deregister dynamic webhooks
 * - offline_access — receive a refresh token for long-lived access
 */
const JIRA_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: "JIRA_CLIENT_ID",
  clientSecretEnvVar: "JIRA_CLIENT_SECRET",
  authorizationUrl: "https://auth.atlassian.com/authorize",
  tokenUrl: "https://auth.atlassian.com/oauth/token",
  scopes: ["read:jira-work", "write:jira-work", "manage:jira-webhook", "offline_access"],
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
 * Integration adapter for Jira Cloud (issue lifecycle + worklog import).
 *
 * Supports:
 * - OAuth 2.0 3LO Authorization Code Grant
 * - Cloud ID discovery via accessible-resources endpoint
 * - Webhook signature verification (HMAC-SHA256)
 * - Health status checks via sync log
 *
 * Env vars required:
 * - JIRA_CLIENT_ID, JIRA_CLIENT_SECRET — for OAuth
 * - JIRA_ENCRYPTION_KEY — for credential encryption at rest
 */
export class JiraAdapter extends BaseAdapter {
  readonly slug = "jira";
  readonly displayName = "Jira";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;

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
  // Webhooks
  // -------------------------------------------------------------------------

  /**
   * Verifies an inbound Jira webhook signature using HMAC-SHA256.
   *
   * Jira sends an `X-Hub-Signature` header with format `sha256=<hex>`.
   * The secret is stored in IntegrationConnection.configJson.webhookSecret
   * and passed through the `x-webhook-secret` header by the webhook pipeline.
   *
   * @param rawBody - The raw request body string
   * @param headers - Request headers (lowercased keys)
   * @returns Verification result with eventType extracted from payload
   */
  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
  ): WebhookVerificationResult {
    const signatureHeader =
      headers["x-hub-signature"] ?? headers["X-Hub-Signature"];
    const secret =
      headers["x-webhook-secret"] ?? headers["X-Webhook-Secret"];

    // If no secret is configured, allow through (3LO dynamic webhooks
    // may not support custom secrets — see RESEARCH.md open question #2).
    // The webhook pipeline falls back to ExternalLink matching for validation.
    if (!secret) {
      let eventType: string | undefined;
      try {
        const parsed = JSON.parse(rawBody) as { webhookEvent?: string };
        eventType = parsed.webhookEvent;
      } catch {
        // Payload parse failure — still mark as valid for pipeline to handle
      }
      return { valid: true, eventType };
    }

    if (!signatureHeader) {
      return { valid: false };
    }

    const [method, signature] = signatureHeader.split("=");
    if (method !== "sha256" || !signature) {
      return { valid: false };
    }

    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    let valid: boolean;
    try {
      valid = timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expected, "hex"),
      );
    } catch {
      // Buffer length mismatch — invalid signature
      valid = false;
    }

    let eventType: string | undefined;
    if (valid) {
      try {
        const parsed = JSON.parse(rawBody) as { webhookEvent?: string };
        eventType = parsed.webhookEvent;
      } catch {
        // Payload parse failure handled downstream
      }
    }

    return { valid, eventType };
  }

  /**
   * Handles an inbound Jira webhook payload.
   *
   * This is a thin entry point called by the Phase 12 webhook pipeline.
   * The actual processing is delegated to the jira-webhook-handler service
   * which is invoked by the _process route after this method returns.
   */
  async handleWebhook(
    _payload: unknown,
    _organizationId: string,
    _connectionId: string,
  ): Promise<void> {
    // Webhook processing is handled by the _process route which calls
    // processJiraWebhook from @contractor-ops/api. This method exists
    // to satisfy the BaseAdapter interface and signal webhook support.
  }

  // -------------------------------------------------------------------------
  // Scopes
  // -------------------------------------------------------------------------

  /**
   * Returns the full set of OAuth scopes required by the Jira adapter.
   * Used to detect whether an existing connection needs scope expansion
   * (e.g., Phase 18 read-only connections upgraded to Phase 19 write access).
   */
  getRequiredScopes(): string[] {
    return ["read:jira-work", "write:jira-work", "manage:jira-webhook", "offline_access"];
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
      recentWebhooks: [],
      errorCountLast24h,
    };
  }
}
