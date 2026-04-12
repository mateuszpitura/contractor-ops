import { prisma } from '@contractor-ops/db';
import type { CredentialBlob } from '../types/credentials.js';
import type { ProviderHealthStatus } from '../types/health.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// Confluence OAuth 2.0 Configuration
// ---------------------------------------------------------------------------

/**
 * Confluence Cloud uses OAuth 2.0 Authorization Code Grant (3LO).
 *
 * IMPORTANT: Use a separate OAuth app from Jira (Pitfall 3) to avoid
 * scope conflicts and allow independent lifecycle management.
 *
 * Env vars required:
 * - CONFLUENCE_CLIENT_ID, CONFLUENCE_CLIENT_SECRET — for OAuth
 * - CONFLUENCE_ENCRYPTION_KEY — for credential encryption at rest
 */
const CONFLUENCE_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: 'CONFLUENCE_CLIENT_ID',
  clientSecretEnvVar: 'CONFLUENCE_CLIENT_SECRET',
  authorizationUrl: 'https://auth.atlassian.com/authorize',
  tokenUrl: 'https://auth.atlassian.com/oauth/token',
  scopes: ['search:confluence', 'read:confluence-content.summary', 'offline_access'],
  redirectPath: '/api/oauth/confluence/callback',
};

/**
 * Extra parameters required by Atlassian's OAuth flow.
 * - audience: Required by Atlassian to identify the API resource
 * - prompt: Forces consent screen to ensure refresh token is returned
 */
export const CONFLUENCE_EXTRA_AUTH_PARAMS: Record<string, string> = {
  audience: 'api.atlassian.com',
  prompt: 'consent',
};

// ---------------------------------------------------------------------------
// Confluence Adapter
// ---------------------------------------------------------------------------

export class ConfluenceAdapter extends BaseAdapter {
  readonly slug = 'confluence';
  readonly displayName = 'Confluence';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  getOAuthConfig(): OAuthConfig {
    return CONFLUENCE_OAUTH_CONFIG;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.CONFLUENCE_CLIENT_ID;
    const clientSecret = process.env.CONFLUENCE_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'CONFLUENCE_CLIENT_ID and CONFLUENCE_CLIENT_SECRET environment variables are required',
      );
    }

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
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
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Confluence OAuth exchange failed: ${text}`);
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
    const clientId = process.env.CONFLUENCE_CLIENT_ID;
    const clientSecret = process.env.CONFLUENCE_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'CONFLUENCE_CLIENT_ID and CONFLUENCE_CLIENT_SECRET environment variables are required',
      );
    }

    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for Confluence');
    }

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
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
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Confluence token refresh failed: ${text}`);
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
  // Cloud ID Discovery
  // -------------------------------------------------------------------------

  /**
   * Discovers accessible Confluence Cloud sites after OAuth authorization.
   * Returns the first accessible resource's cloudId and site URL.
   *
   * Same endpoint as Jira — Atlassian's accessible-resources returns all
   * products available to the OAuth app.
   *
   * @param accessToken - The OAuth access token from token exchange
   * @returns The cloudId and site info for the accessible Confluence instance
   */
  async discoverCloudId(
    accessToken: string,
  ): Promise<{ cloudId: string; siteName: string; siteUrl: string }> {
    const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Confluence accessible-resources discovery failed: ${text}`);
    }

    const resources = (await response.json()) as Array<{
      id: string;
      name: string;
      url: string;
      scopes: string[];
    }>;

    if (resources.length === 0) {
      throw new Error(
        'No accessible Confluence Cloud sites found. The authorized user may not have access to any Confluence instances.',
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
  // Page Search
  // -------------------------------------------------------------------------

  /**
   * Searches Confluence pages using CQL (Confluence Query Language).
   *
   * @param accessToken - The OAuth access token
   * @param cloudId - The Confluence Cloud instance ID
   * @param query - Search query string
   * @returns Array of matching pages with title, space, and URL
   */
  async searchPages(
    accessToken: string,
    cloudId: string,
    query: string,
  ): Promise<
    Array<{
      id: string;
      title: string;
      spaceKey: string;
      spaceName: string;
      url: string;
    }>
  > {
    const cql = `type=page AND title~"${query}"`;
    const searchUrl = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api/search?cql=${encodeURIComponent(cql)}&limit=10`;

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Confluence search failed: ${text}`);
    }

    const data = (await response.json()) as {
      results: Array<{
        content: {
          id: string;
          title: string;
          _links?: { webui?: string };
        };
        resultGlobalContainer?: {
          title: string;
          displayUrl?: string;
        };
      }>;
      _links?: { base?: string };
    };

    const baseUrl = data._links?.base ?? `https://${cloudId}.atlassian.net/wiki`;

    return data.results.map(r => {
      const spaceKey =
        r.resultGlobalContainer?.displayUrl?.split('/spaces/')?.[1]?.split('/')?.[0] ?? '';
      const spaceName = r.resultGlobalContainer?.title ?? '';
      const webui = r.content._links?.webui ?? '';

      return {
        id: r.content.id,
        title: r.content.title,
        spaceKey,
        spaceName,
        url: `${baseUrl}${webui}`,
      };
    });
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
        status: 'DISCONNECTED',
        provider: 'confluence',
        recentSyncs: [],
        recentWebhooks: [],
        errorCountLast24h: 0,
      };
    }

    const recentSyncs = await prisma.integrationSyncLog.findMany({
      where: { integrationConnectionId: connectionId },
      orderBy: { startedAt: 'desc' },
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
        status: 'FAILED',
        startedAt: { gte: oneDayAgo },
      },
    });

    let status: ProviderHealthStatus['status'];
    if (connection.status !== 'CONNECTED') {
      status = 'DISCONNECTED';
    } else if (connection.lastErrorAt && !connection.lastSuccessAt) {
      status = 'ERROR';
    } else if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      status = 'REAUTH_REQUIRED';
    } else if (recentSyncs[0]?.status === 'FAILED') {
      status = 'ERROR';
    } else {
      status = 'CONNECTED';
    }

    return {
      status,
      provider: 'confluence',
      displayName: connection.displayName,
      connectedAt: connection.connectedAt,
      lastSyncAt: connection.lastSyncAt,
      lastSuccessAt: connection.lastSuccessAt,
      lastErrorAt: connection.lastErrorAt,
      lastErrorMessage: connection.lastErrorMessage,
      tokenExpiresAt: connection.tokenExpiresAt,
      recentSyncs: recentSyncs.map(s => ({
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
