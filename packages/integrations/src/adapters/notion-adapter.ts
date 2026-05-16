import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { withResilience } from '../services/resilience.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// Timeout budgets (F-INT-01 / F-INT-02)
// ---------------------------------------------------------------------------
//
// OAuth token redemption + refresh — non-idempotent POST (Notion uses HTTP
// Basic auth). 30s wall-clock, no retries. Replaying a token redemption
// could claim multiple sessions or invalidate the refresh token.
const OAUTH_TIMEOUT_MS = 30_000;
// Search API — POST but treated as idempotent (read-only query). 15s
// wall-clock with retries on 429/5xx; we explicitly opt in via
// `retryNonIdempotent` because the helper otherwise refuses to retry POSTs.
const SEARCH_TIMEOUT_MS = 15_000;
const SEARCH_RETRIES = 2;

// ---------------------------------------------------------------------------
// Notion OAuth 2.0 Configuration
// ---------------------------------------------------------------------------

/**
 * Notion uses OAuth 2.0 Authorization Code Grant.
 *
 * CRITICAL: Notion requires HTTP Basic authentication for token exchange
 * (Pitfall 1). Do NOT put client_id/client_secret in the JSON body.
 *
 * Notion does not use scopes — capabilities are configured on the
 * integration page (Pitfall 2).
 *
 * Env vars required:
 * - NOTION_CLIENT_ID, NOTION_CLIENT_SECRET — for OAuth
 * - NOTION_ENCRYPTION_KEY — for credential encryption at rest
 */
const NOTION_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: 'NOTION_CLIENT_ID',
  clientSecretEnvVar: 'NOTION_CLIENT_SECRET',
  authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
  tokenUrl: 'https://api.notion.com/v1/oauth/token',
  scopes: [], // Notion uses integration capabilities, not scopes (Pitfall 2)
  redirectPath: '/api/oauth/notion/callback',
};

/** Notion API version header — pinned to stable version (Pitfall 7) */
const NOTION_API_VERSION = '2022-06-28';

// ---------------------------------------------------------------------------
// Notion Adapter
// ---------------------------------------------------------------------------

export class NotionAdapter extends BaseAdapter {
  readonly slug = 'notion';
  readonly displayName = 'Notion';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  override getOAuthConfig(): OAuthConfig {
    return NOTION_OAUTH_CONFIG;
  }

  /**
   * Exchanges an authorization code for access/refresh tokens.
   *
   * CRITICAL: Notion requires HTTP Basic auth header with
   * `Authorization: Basic base64(clientId:clientSecret)` (Pitfall 1).
   * Putting credentials in the JSON body will fail.
   */
  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'NOTION_CLIENT_ID and NOTION_CLIENT_SECRET environment variables are required',
      );
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://api.notion.com/v1/oauth/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              code,
              redirect_uri: redirectUri,
            }),
          },
          { timeoutMs: OAUTH_TIMEOUT_MS, retries: 0 },
        ),
      // Authorization-code redemption is non-idempotent.
      { provider: 'notion', retryAttempts: 0 },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion OAuth exchange failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      token_type: string;
      bot_id: string;
      workspace_id: string;
      workspace_name: string;
      workspace_icon: string | null;
      duplicated_template_id: string | null;
      owner: unknown;
    };

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      extra: {
        botId: data.bot_id,
        workspaceId: data.workspace_id,
        workspaceName: data.workspace_name,
      },
    };
  }

  /**
   * Refreshes the Notion access token.
   *
   * Uses HTTP Basic auth header (same as token exchange).
   */
  override async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'NOTION_CLIENT_ID and NOTION_CLIENT_SECRET environment variables are required',
      );
    }

    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for Notion');
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://api.notion.com/v1/oauth/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: JSON.stringify({
              grant_type: 'refresh_token',
              refresh_token: credentials.refreshToken,
            }),
          },
          { timeoutMs: OAUTH_TIMEOUT_MS, retries: 0 },
        ),
      { provider: 'notion' },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion token refresh failed: ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      token_type: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: credentials.refreshToken,
      tokenType: data.token_type,
    };
  }

  // -------------------------------------------------------------------------
  // Page Search
  // -------------------------------------------------------------------------

  /**
   * Searches Notion pages accessible by the integration.
   *
   * Uses the Notion Search API with page filter and pinned API version header.
   *
   * @param accessToken - The OAuth access token
   * @param query - Search query string
   * @returns Array of matching pages with title, icon, and URL
   */
  async searchPages(
    accessToken: string,
    query: string,
  ): Promise<
    Array<{
      id: string;
      title: string;
      icon: string | null;
      lastEditedTime: string;
      url: string;
    }>
  > {
    // Search is a POST but is read-only and idempotent — outer resilience
    // layer owns retry on 429/5xx via withResilience.
    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://api.notion.com/v1/search',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Notion-Version': NOTION_API_VERSION,
            },
            body: JSON.stringify({
              query,
              filter: { property: 'object', value: 'page' },
              page_size: 10,
            }),
          },
          { timeoutMs: SEARCH_TIMEOUT_MS, retries: 0 },
        ),
      { provider: 'notion', retryAttempts: SEARCH_RETRIES },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion search failed: ${text}`);
    }

    const data = (await response.json()) as {
      results: Array<{
        id: string;
        object: string;
        last_edited_time: string;
        icon?: { type: string; emoji?: string; external?: { url: string } } | null;
        properties?: {
          title?: {
            title?: Array<{ plain_text: string }>;
          };
        };
      }>;
    };

    return data.results.map(page => {
      const titleProp = page.properties?.title?.title;
      const title = titleProp?.[0]?.plain_text ?? 'Untitled';

      let icon: string | null = null;
      if (page.icon?.type === 'emoji') {
        icon = page.icon.emoji ?? null;
      } else if (page.icon?.type === 'external') {
        icon = page.icon.external?.url ?? null;
      }

      const url = `https://notion.so/${page.id.replace(/-/g, '')}`;

      return {
        id: page.id,
        title,
        icon,
        lastEditedTime: page.last_edited_time,
        url,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Health Status — uses BaseAdapter default (no custom behavior).
  // -------------------------------------------------------------------------
}
