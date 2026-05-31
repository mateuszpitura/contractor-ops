import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { parseJsonResponse } from '../services/parse-json-response.js';
import { withResilience } from '../services/resilience.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { ProviderHealthStatus } from '../types/health.js';
import type { OAuthConfig } from '../types/provider.js';
import type { WebhookVerificationResult } from '../types/webhook.js';
import type { GetHealthStatusOptions } from './base-adapter.js';
import { BaseAdapter } from './base-adapter.js';

/**
 * Linear OAuth 2.0 token response (exchange + refresh share the same shape).
 * `scope` may be an array or a comma-joinable string. Validated at the
 * credential-persist boundary (fail closed).
 */
const linearTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().nonnegative(),
  token_type: z.string().min(1),
  scope: z.union([z.array(z.string()), z.string()]),
});

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
  clientIdEnvVar: 'LINEAR_CLIENT_ID',
  clientSecretEnvVar: 'LINEAR_CLIENT_SECRET',
  authorizationUrl: 'https://linear.app/oauth/authorize',
  tokenUrl: 'https://api.linear.app/oauth/token',
  scopes: ['read', 'write'],
  redirectPath: '/api/oauth/linear/callback',
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
  readonly slug = 'linear';
  readonly displayName = 'Linear';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  override getOAuthConfig(): OAuthConfig {
    return LINEAR_OAUTH_CONFIG;
  }

  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET environment variables are required',
      );
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://api.linear.app/oauth/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          },
          { timeoutMs: 10_000, retries: 0 },
        ),
      // Authorization-code redemption is non-idempotent.
      { provider: 'linear', retryAttempts: 0 },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Linear OAuth exchange failed: ${text}`);
    }

    const data = await parseJsonResponse(
      response,
      linearTokenResponseSchema,
      'linear:exchangeCodeForTokens',
    );

    // Linear returns scope as an array of strings — join with comma for storage
    const scope = Array.isArray(data.scope) ? data.scope.join(',') : data.scope;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  override async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET environment variables are required',
      );
    }

    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for Linear');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credentials.refreshToken,
    });

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://api.linear.app/oauth/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
          },
          { timeoutMs: 10_000, retries: 0 },
        ),
      { provider: 'linear' },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Linear token refresh failed: ${text}`);
    }

    const data = await parseJsonResponse(
      response,
      linearTokenResponseSchema,
      'linear:refreshToken',
    );

    const scope = Array.isArray(data.scope) ? data.scope.join(',') : data.scope;

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
   *
   * The secret MUST be resolved server-side from
   * `IntegrationConnection.configJson.webhookSecret` and passed in via
   * `configuredSecret`. The adapter no longer reads the secret from inbound
   * request headers (`x-webhook-secret`) or environment fallbacks — see
   * F-SEC-03. As a controlled escape hatch, a process-wide
   * `LINEAR_WEBHOOK_SECRET` env var is consulted if (and only if) no
   * per-connection secret was supplied; this is intended for development
   * setups where a single shared secret is convenient.
   *
   * @param rawBody - The raw request body string
   * @param headers - Request headers (lowercased keys)
   * @param configuredSecret - The webhook secret resolved server-side from the
   *   per-connection configuration. NEVER from a request header.
   * @returns Verification result with eventType extracted as type.action
   */
  override verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
    configuredSecret?: string | null,
  ): WebhookVerificationResult {
    const signatureHeader = headers['linear-signature'] ?? headers['Linear-Signature'];
    // Server-resolved secret first; LINEAR_WEBHOOK_SECRET is only a fallback for
    // dev convenience and is never overridden by an inbound request header.
    const secret = configuredSecret ?? process.env.LINEAR_WEBHOOK_SECRET;

    // F-SEC-03: fail closed when no secret is configured.
    if (!secret) {
      return { valid: false, reason: 'config' };
    }

    if (!signatureHeader) {
      return { valid: false, reason: 'headers' };
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    let valid: boolean;
    try {
      valid = timingSafeEqual(Buffer.from(signatureHeader, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      // Buffer length mismatch — invalid signature
      valid = false;
    }

    if (!valid) {
      return { valid: false, reason: 'signature' };
    }

    let eventType: string | undefined;
    try {
      const parsed = JSON.parse(rawBody) as {
        type?: string;
        action?: string;
      };
      if (parsed.type && parsed.action) {
        eventType = `${parsed.type}.${parsed.action}`;
      }
      // safe-swallow: webhook payload parse best-effort; eventType stays undefined and is handled downstream
    } catch {
      // Payload parse failure handled downstream
    }

    return { valid: true, eventType };
  }

  /**
   * Handles an inbound Linear webhook payload.
   *
   * This is a thin entry point called by the webhook pipeline.
   * The actual processing is delegated to the _process route which calls
   * processLinearWebhook from @contractor-ops/api.
   */
  override async handleWebhook(
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
    return ['read', 'write'];
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

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://api.linear.app/graphql',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          },
          { timeoutMs: 20_000, retries: 0 },
        ),
      { provider: 'linear' },
    );

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
      teams: result.data.teams.nodes.map(team => ({
        id: team.id,
        name: team.name,
        key: team.key,
        states: team.states.nodes.map(state => ({
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

  /**
   * Linear allows a connection to sit in `PENDING_MAPPING` between OAuth
   * and team selection — this is still considered "connected enough" for
   * health derivation. Defer everything else to the shared default.
   */
  override async getHealthStatus(
    connectionId: string,
    options?: GetHealthStatusOptions,
  ): Promise<ProviderHealthStatus> {
    return super.getHealthStatus(connectionId, {
      allowedConnectedStatuses: ['PENDING_MAPPING'],
      ...options,
    });
  }
}
