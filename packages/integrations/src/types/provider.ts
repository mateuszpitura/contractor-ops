import type { CredentialBlob } from './credentials.js';
import type { ProviderHealthStatus } from './health.js';
import type { WebhookVerificationResult } from './webhook.js';

/**
 * Connection sub-kind discriminator. A provider may have more than one logical
 * connection per org — e.g. Slack has the existing workspace-level connection
 * AND a separate org-grid connection (org-level OAuth grant) used exclusively
 * for deprovisioning. Connections without a sub-kind are the provider's
 * default/workspace connection.
 */
export type ConnectionSubKind = 'SLACK_ORG_GRID';

/**
 * OAuth configuration for providers that support OAuth 2.0 authorization.
 */
export interface OAuthConfig {
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** e.g., "/api/oauth/slack/callback" */
  redirectPath: string;
  /** Extra query parameters appended to the authorization URL (e.g., access_type, prompt). */
  extraAuthParams?: Record<string, string>;
  /**
   * Marks a non-default connection sub-kind (e.g. the Slack org-grid
   * deprovisioning connection). Absent on the default/workspace OAuth.
   */
  connectionSubKind?: ConnectionSubKind;
}

/**
 * Core adapter interface that every integration provider must implement.
 * Optional methods are only required for providers that support the
 * corresponding capability (OAuth, webhooks, health checks).
 */
export interface IntegrationProviderAdapter {
  readonly slug: string;
  readonly displayName: string;
  readonly supportsOAuth: boolean;
  readonly supportsWebhooks: boolean;

  /** Returns OAuth configuration for providers that support OAuth. */
  getOAuthConfig?(): OAuthConfig;

  /** Exchanges an authorization code for access/refresh tokens. */
  exchangeCodeForTokens?(code: string, redirectUri: string): Promise<CredentialBlob>;

  /** Refreshes an expired access token using the refresh token. */
  refreshToken?(credentials: CredentialBlob): Promise<CredentialBlob>;

  /**
   * Verifies the cryptographic signature of an incoming webhook.
   *
   * @param rawBody - The raw request body string
   * @param headers - The inbound request headers (lowercased keys recommended)
   * @param configuredSecret - The webhook secret resolved server-side from the
   *   integration connection (e.g. `IntegrationConnection.configJson.webhookSecret`).
   *   MUST NOT be derived from any inbound request header. Adapters that resolve
   *   their secret from a static env var (e.g. Slack signing secret) may ignore
   *   this parameter; adapters with per-connection secrets (Jira, Linear) MUST
   *   use it and reject when null.
   */
  verifyWebhookSignature?(
    rawBody: string,
    headers: Record<string, string>,
    configuredSecret?: string | null,
  ): WebhookVerificationResult;

  /** Processes a verified webhook payload. Returns provider-specific result or void. */
  handleWebhook?(payload: unknown, organizationId: string, connectionId: string): Promise<unknown>;

  /** Returns health status for a connection (recent syncs, errors, etc.). */
  getHealthStatus?(connectionId: string): Promise<ProviderHealthStatus>;
}
