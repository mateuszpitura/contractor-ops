import { createHmac, timingSafeEqual } from 'node:crypto';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { withResilience } from '../services/resilience.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { OAuthConfig } from '../types/provider.js';
import type { WebhookVerificationResult } from '../types/webhook.js';
import { BaseAdapter } from './base-adapter.js';

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
  clientIdEnvVar: 'JIRA_CLIENT_ID',
  clientSecretEnvVar: 'JIRA_CLIENT_SECRET',
  authorizationUrl: 'https://auth.atlassian.com/authorize',
  tokenUrl: 'https://auth.atlassian.com/oauth/token',
  scopes: ['read:jira-work', 'write:jira-work', 'manage:jira-webhook', 'offline_access'],
  redirectPath: '/api/oauth/jira/callback',
};

/**
 * Extra parameters required by Atlassian's OAuth flow.
 * - audience: Required by Atlassian to identify the API resource
 * - prompt: Forces consent screen to ensure refresh token is returned
 */
export const JIRA_EXTRA_AUTH_PARAMS: Record<string, string> = {
  audience: 'api.atlassian.com',
  prompt: 'consent',
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
  readonly slug = 'jira';
  readonly displayName = 'Jira';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  override getOAuthConfig(): OAuthConfig {
    return JIRA_OAUTH_CONFIG;
  }

  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error('JIRA_CLIENT_ID and JIRA_CLIENT_SECRET environment variables are required');
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://auth.atlassian.com/oauth/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: redirectUri,
            }),
          },
          // Authorization-code redemption is non-idempotent — bound wall-clock
          // only, retry decisions are owned by the outer resilience layer.
          { timeoutMs: 10_000, retries: 0 },
        ),
      { provider: 'jira', retryAttempts: 0 },
    );

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
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  override async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error('JIRA_CLIENT_ID and JIRA_CLIENT_SECRET environment variables are required');
    }

    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for Jira');
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://auth.atlassian.com/oauth/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'refresh_token',
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: credentials.refreshToken,
            }),
          },
          { timeoutMs: 10_000, retries: 0 },
        ),
      { provider: 'jira' },
    );

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
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------

  /**
   * Verifies an inbound Jira webhook signature using HMAC-SHA256.
   *
   * Jira sends an `X-Hub-Signature` header with format `sha256=<hex>`.
   * The secret MUST be resolved server-side from
   * `IntegrationConnection.configJson.webhookSecret` and passed in via
   * `configuredSecret`. The adapter no longer reads any secret from inbound
   * request headers — see F-SEC-02 / F-INT-08.
   *
   * Behaviour:
   * - `configuredSecret` is null / empty → reject (`reason: 'config'`).
   *   Previously the adapter fell through with `valid: true`, which let
   *   unauthenticated payloads be persisted and dispatched.
   * - `X-Hub-Signature` header is missing → reject (`reason: 'headers'`).
   * - Non-sha256 method or HMAC mismatch → reject (`reason: 'signature'`).
   *
   * @param rawBody - The raw request body string
   * @param headers - Request headers (lowercased keys)
   * @param configuredSecret - The webhook secret resolved server-side from the
   *   per-connection configuration. NEVER from a request header.
   * @returns Verification result with eventType extracted from payload
   */
  override verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
    configuredSecret?: string | null,
  ): WebhookVerificationResult {
    const signatureHeader = headers['x-hub-signature'] ?? headers['X-Hub-Signature'];

    // F-SEC-02: never accept a missing-secret short-circuit. If the
    // organization has not configured a webhook secret we cannot verify
    // authenticity — fail closed.
    if (!configuredSecret) {
      return { valid: false, reason: 'config' };
    }

    if (!signatureHeader) {
      return { valid: false, reason: 'headers' };
    }

    const [method, signature] = signatureHeader.split('=');
    if (method !== 'sha256' || !signature) {
      return { valid: false, reason: 'signature' };
    }

    const expected = createHmac('sha256', configuredSecret).update(rawBody).digest('hex');

    let valid: boolean;
    try {
      valid = timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      // Buffer length mismatch — invalid signature
      valid = false;
    }

    if (!valid) {
      return { valid: false, reason: 'signature' };
    }

    let eventType: string | undefined;
    try {
      const parsed = JSON.parse(rawBody) as { webhookEvent?: string };
      eventType = parsed.webhookEvent;
    } catch {
      // Payload parse failure handled downstream
    }

    return { valid: true, eventType };
  }

  /**
   * Handles an inbound Jira webhook payload.
   *
   * This is a thin entry point called by the Phase 12 webhook pipeline.
   * The actual processing is delegated to the jira-webhook-handler service
   * which is invoked by the _process route after this method returns.
   */
  override async handleWebhook(
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
    return ['read:jira-work', 'write:jira-work', 'manage:jira-webhook', 'offline_access'];
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
    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://api.atlassian.com/oauth/token/accessible-resources',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          },
          { timeoutMs: 10_000, retries: 0 },
        ),
      { provider: 'jira' },
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
        'No accessible Jira Cloud sites found. The authorized user may not have access to any Jira instances.',
      );
    }

    const site = resources[0];
    if (!site) throw new Error('No accessible Jira Cloud sites found.');
    return {
      cloudId: site.id,
      siteName: site.name,
      siteUrl: site.url,
    };
  }

  // -------------------------------------------------------------------------
  // Health Status — uses BaseAdapter default (no custom behavior).
  // -------------------------------------------------------------------------
}
