import { z } from 'zod';
import { GOOGLE_WORKSPACE_DEPROVISION_SCOPES } from '../scopes/google-workspace-deprovision-scopes.js';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { parseJsonResponse } from '../services/parse-json-response.js';
import { withResilience } from '../services/resilience.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

/**
 * Google OAuth 2.0 token responses. Validated at the credential-persist
 * boundary (fail closed). Refresh responses omit refresh_token (Google does
 * not re-issue it), so it has its own schema.
 */
const googleTokenExchangeSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().nonnegative(),
  token_type: z.string().min(1),
  scope: z.string(),
});
const googleTokenRefreshSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().nonnegative(),
  token_type: z.string().min(1),
  scope: z.string(),
});

// ---------------------------------------------------------------------------
// Timeout budgets (F-INT-01 / F-INT-02)
// ---------------------------------------------------------------------------
//
// OAuth token redemption + refresh — non-idempotent POST. 30s wall-clock,
// no retries (replaying can claim multiple sessions or invalidate the
// refresh token). Matches Slack/DocuSign precedent.
const OAUTH_TIMEOUT_MS = 30_000;
// Directory + Groups list pages — read-only GET. 15s + 2 retries on
// 429/5xx; the helper honors Retry-After automatically. Per-page
// granularity (the do/while loop continues against pageToken from the
// last successful response).
const DIRECTORY_TIMEOUT_MS = 15_000;
const DIRECTORY_RETRIES = 2;

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
  clientIdEnvVar: 'GOOGLE_WORKSPACE_CLIENT_ID',
  clientSecretEnvVar: 'GOOGLE_WORKSPACE_CLIENT_SECRET',
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/admin.directory.user.readonly',
    'https://www.googleapis.com/auth/admin.directory.group.readonly',
    // Phase 76 SC#3 — additive write scope for contractor deprovisioning.
    // Read-only directory-import continues working; prompt=consent forces re-OAuth
    // for the new scope. Traced by lint:scopes (D-15) to the typed-const.
    ...GOOGLE_WORKSPACE_DEPROVISION_SCOPES,
  ],
  redirectPath: '/api/oauth/google_workspace/callback',
  extraAuthParams: {
    access_type: 'offline',
    prompt: 'consent',
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
  readonly slug = 'google_workspace';
  readonly displayName = 'Google Workspace';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  // -------------------------------------------------------------------------
  // OAuth
  // -------------------------------------------------------------------------

  override getOAuthConfig(): OAuthConfig {
    return GOOGLE_WORKSPACE_OAUTH_CONFIG;
  }

  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const clientId = process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'GOOGLE_WORKSPACE_CLIENT_ID and GOOGLE_WORKSPACE_CLIENT_SECRET environment variables are required',
      );
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://oauth2.googleapis.com/token',
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
          { timeoutMs: OAUTH_TIMEOUT_MS, retries: 0 },
        ),
      // Authorization-code redemption is non-idempotent.
      { provider: 'google-workspace', retryAttempts: 0 },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Workspace OAuth exchange failed: ${text}`);
    }

    const data = await parseJsonResponse(
      response,
      googleTokenExchangeSchema,
      'google-workspace:exchangeCodeForTokens',
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  override async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const clientId = process.env.GOOGLE_WORKSPACE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_WORKSPACE_CLIENT_SECRET;

    if (!(clientId && clientSecret)) {
      throw new Error(
        'GOOGLE_WORKSPACE_CLIENT_ID and GOOGLE_WORKSPACE_CLIENT_SECRET environment variables are required',
      );
    }

    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for Google Workspace');
    }

    const response = await withResilience(
      () =>
        fetchWithTimeout(
          'https://oauth2.googleapis.com/token',
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
          { timeoutMs: OAUTH_TIMEOUT_MS, retries: 0 },
        ),
      { provider: 'google-workspace' },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Workspace token refresh failed: ${text}`);
    }

    const data = await parseJsonResponse(
      response,
      googleTokenRefreshSchema,
      'google-workspace:refreshToken',
    );

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
      const url = new URL('https://admin.googleapis.com/admin/directory/v1/users');
      url.searchParams.set('customer', 'my_customer');
      url.searchParams.set('maxResults', '500');
      url.searchParams.set('projection', 'FULL');
      url.searchParams.set('orderBy', 'EMAIL');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await withResilience(
        () =>
          fetchWithTimeout(
            url.toString(),
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
            { timeoutMs: DIRECTORY_TIMEOUT_MS, retries: 0 },
          ),
        { provider: 'google-workspace', retryAttempts: DIRECTORY_RETRIES },
      );

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
        const activeUsers = data.users.filter(u => !u.suspended);
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
      const url = new URL('https://admin.googleapis.com/admin/directory/v1/groups');
      url.searchParams.set('userKey', userEmail);
      url.searchParams.set('maxResults', '200');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await withResilience(
        () =>
          fetchWithTimeout(
            url.toString(),
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
            { timeoutMs: DIRECTORY_TIMEOUT_MS, retries: 0 },
          ),
        { provider: 'google-workspace', retryAttempts: DIRECTORY_RETRIES },
      );

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
  // Health Status — uses BaseAdapter default (no custom behavior).
  // -------------------------------------------------------------------------
}
