import { prisma } from '@contractor-ops/db';
import { provenanceLookup } from '@contractor-ops/idp-saga';
import { z } from 'zod';
import type { ErrorClass } from '../idp/error-classifier.js';
import { classifyError } from '../idp/error-classifier.js';
import type { ImpactPreview } from '../idp/impact-preview.js';
import { GOOGLE_WORKSPACE_DEPROVISION_SCOPES } from '../scopes/google-workspace-deprovision-scopes.js';
import { pLimit } from '../services/concurrency.js';
import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { parseJsonResponse } from '../services/parse-json-response.js';
import { withResilience } from '../services/resilience.js';
import {
  canonicalizeRequest,
  canonicalizeResponse,
  sha256Hex,
} from '../services/saga-canonicalize.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { Deprovisionable, DeprovisionResult } from '../types/deprovisionable.js';
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
// Deprovision Admin SDK mutations (suspend, revoke-tokens, signOut, verify,
// describeImpact). 15s wall-clock, no retries — QStash retries the whole
// step on transient failure via #mapDeprovisionFailure throwing.
const DEPROVISION_TIMEOUT_MS = 15_000;

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

export class GoogleWorkspaceAdapter extends BaseAdapter implements Deprovisionable {
  /**
   * Slug uses underscore so `.toUpperCase()` produces `GOOGLE_WORKSPACE`
   * matching the Prisma IntegrationProvider enum value.
   */
  readonly slug = 'google_workspace';
  readonly displayName = 'Google Workspace';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  /**
   * Phase 76 — access token used by the Deprovisionable methods. The saga
   * step-runner (Plan 76-06) resolves the connection credential and configures
   * it via {@link withAccessToken} before invoking suspend/revoke. Existing
   * read methods (listAllDirectoryUsers / listUserGroups) keep taking the token
   * as a parameter; the Deprovisionable interface signatures take only
   * externalUserId, so the token is carried on the instance.
   */
  #deprovisionAccessToken = '';

  /** Configure the access token for the Deprovisionable methods (saga step-runner). */
  withAccessToken(accessToken: string): this {
    this.#deprovisionAccessToken = accessToken;
    return this;
  }

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
  // Deprovisionable (Phase 76 D-13 / Phase 77 D-04/D-05) — Admin SDK Directory API.
  // Errors are classified via `classifyError` (77-01): TRANSIENT_* are re-thrown
  // so the QStash step-runner retries the whole step; PERMANENT_NOT_FOUND maps to
  // an idempotent LIKELY_GONE success; other PERMANENT classes return FAILED.
  // -------------------------------------------------------------------------

  #usersUrl(externalUserId: string): string {
    return `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(externalUserId)}`;
  }

  #authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.#deprovisionAccessToken}` };
  }

  /** Best-effort provider error code from a non-2xx Admin SDK error body. */
  static #providerErrorCode(body: unknown): string | undefined {
    const errors = (body as { error?: { errors?: Array<{ reason?: string }>; status?: string } })
      ?.error;
    return errors?.errors?.[0]?.reason ?? errors?.status ?? undefined;
  }

  async suspendAccount(externalUserId: string): Promise<DeprovisionResult> {
    const requestPayload = { suspended: true };
    const requestSha256 = sha256Hex(canonicalizeRequest({ method: 'PATCH', body: requestPayload }));

    const res = await fetchWithTimeout(
      this.#usersUrl(externalUserId),
      {
        method: 'PATCH',
        headers: { ...this.#authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      },
      { timeoutMs: DEPROVISION_TIMEOUT_MS, retries: 0 },
    );

    const body = await res.json().catch(() => ({}));
    const responseSha256 = sha256Hex(canonicalizeResponse({ status: res.status, body }));

    if (res.ok) {
      return { status: 'SUCCEEDED', requestSha256, responseSha256 };
    }
    return this.#mapDeprovisionFailure(res.status, body, requestSha256, responseSha256, {
      notFoundReason: 'user_not_found',
    });
  }

  async revokeAllSessions(externalUserId: string): Promise<DeprovisionResult> {
    // Sub-action (a) — revoke OAuth grants: list tokens, delete each (idempotent).
    const tokensReqSha = sha256Hex(canonicalizeRequest({ method: 'GET', target: 'tokens.list' }));
    const listRes = await fetchWithTimeout(
      `${this.#usersUrl(externalUserId)}/tokens`,
      { headers: this.#authHeaders() },
      { timeoutMs: DEPROVISION_TIMEOUT_MS, retries: 0 },
    );
    const listBody = await listRes.json().catch(() => ({}));

    if (!listRes.ok && listRes.status !== 404) {
      const tokensResSha = sha256Hex(canonicalizeResponse({ status: listRes.status }));
      return this.#mapDeprovisionFailure(listRes.status, listBody, tokensReqSha, tokensResSha, {
        notFoundReason: 'user_not_found',
      });
    }

    const tokens = (listBody as { items?: Array<{ clientId?: string }> }).items ?? [];
    const limit = pLimit(5);
    const deleteOutcomes = await Promise.all(
      tokens
        .map(t => t.clientId)
        .filter((c): c is string => typeof c === 'string')
        .map(clientId =>
          limit(async () => {
            const delRes = await fetchWithTimeout(
              `${this.#usersUrl(externalUserId)}/tokens/${encodeURIComponent(clientId)}`,
              { method: 'DELETE', headers: this.#authHeaders() },
              { timeoutMs: DEPROVISION_TIMEOUT_MS, retries: 0 },
            );
            // 404 ⇒ token already revoked (idempotent success).
            return { status: delRes.status, ok: delRes.ok || delRes.status === 404 };
          }),
        ),
    );
    const failedDelete = deleteOutcomes.find(o => !o.ok);
    const tokensResSha = sha256Hex(
      canonicalizeResponse({ deleted: deleteOutcomes.length, allOk: !failedDelete }),
    );
    if (failedDelete) {
      const failed = this.#mapDeprovisionFailure(
        failedDelete.status,
        {},
        tokensReqSha,
        tokensResSha,
        {
          notFoundReason: 'user_not_found',
        },
      );
      // Already-gone on the token list is still a clean LIKELY_GONE outcome.
      if (failed.status === 'FAILED') return failed;
    }

    // Sub-action (b) — sign out of all sessions.
    const signOutReqSha = sha256Hex(canonicalizeRequest({ method: 'POST', target: 'signOut' }));
    const signOutRes = await fetchWithTimeout(
      `${this.#usersUrl(externalUserId)}/signOut`,
      { method: 'POST', headers: this.#authHeaders() },
      { timeoutMs: DEPROVISION_TIMEOUT_MS, retries: 0 },
    );
    const signOutText = await signOutRes.text().catch(() => '');
    const signOutResSha = sha256Hex(
      canonicalizeResponse({ status: signOutRes.status, bodyLength: signOutText.length }),
    );

    const subActions = [
      { kind: 'revoke_oauth_grants', requestSha256: tokensReqSha, responseSha256: tokensResSha },
      { kind: 'sign_out_sessions', requestSha256: signOutReqSha, responseSha256: signOutResSha },
    ];

    if (signOutRes.ok) {
      return {
        status: 'SUCCEEDED',
        requestSha256: signOutReqSha,
        responseSha256: signOutResSha,
        subActions,
      };
    }
    const result = this.#mapDeprovisionFailure(
      signOutRes.status,
      {},
      signOutReqSha,
      signOutResSha,
      { notFoundReason: 'user_not_found' },
    );
    return { ...result, subActions };
  }

  async verifyDeprovisioned(externalUserId: string): Promise<boolean> {
    const res = await fetchWithTimeout(
      this.#usersUrl(externalUserId),
      { headers: this.#authHeaders() },
      { timeoutMs: DEPROVISION_TIMEOUT_MS, retries: 0 },
    );
    if (res.status === 404) return true; // user gone is also "deprovisioned"
    const data = (await res.json().catch(() => ({}))) as { suspended?: boolean };
    return Boolean(data?.suspended);
  }

  async describeImpact(externalUserId: string): Promise<ImpactPreview> {
    const cacheKey = `co:idp:preview:GOOGLE_WORKSPACE:${externalUserId}`;
    const fetchedAt = new Date().toISOString();

    // users.get — accountStatus + isSuperAdmin + displayName.
    const userRes = await fetchWithTimeout(
      this.#usersUrl(externalUserId),
      { headers: this.#authHeaders() },
      { timeoutMs: DEPROVISION_TIMEOUT_MS, retries: 0 },
    );
    if (userRes.status === 404) {
      return {
        provider: 'GOOGLE_WORKSPACE',
        commonMetrics: {
          externalUserId,
          externalUserDisplayName: externalUserId,
          accountStatus: 'NOT_FOUND',
          sessionCount: null,
        },
        customMetrics: { oauthGrants: [], isSuperAdmin: false, drivesOwnedCount: null },
        fetchedAt,
        cacheKey,
      };
    }
    const user = (await userRes.json().catch(() => ({}))) as {
      suspended?: boolean;
      isAdmin?: boolean;
      name?: { fullName?: string };
    };

    // tokens.list — oauthGrants (best-effort; degrade to [] on failure).
    let oauthGrants: Array<{ appName: string; scopes: string[] }> = [];
    try {
      const tokRes = await fetchWithTimeout(
        `${this.#usersUrl(externalUserId)}/tokens`,
        { headers: this.#authHeaders() },
        { timeoutMs: DEPROVISION_TIMEOUT_MS, retries: 0 },
      );
      if (tokRes.ok) {
        const tok = (await tokRes.json().catch(() => ({}))) as {
          items?: Array<{ displayText?: string; clientId?: string; scopes?: string[] }>;
        };
        oauthGrants = (tok.items ?? []).map(t => ({
          appName: t.displayText ?? t.clientId ?? 'unknown',
          scopes: t.scopes ?? [],
        }));
      }
    } catch {
      oauthGrants = [];
    }

    // drives.list — drivesOwnedCount (best-effort; null when Drive API/scope absent).
    let drivesOwnedCount: number | null = null;
    try {
      const driveRes = await fetchWithTimeout(
        'https://www.googleapis.com/drive/v3/drives?useDomainAdminAccess=false&pageSize=100',
        { headers: this.#authHeaders() },
        { timeoutMs: DEPROVISION_TIMEOUT_MS, retries: 0 },
      );
      if (driveRes.ok) {
        const drives = (await driveRes.json().catch(() => ({}))) as { drives?: unknown[] };
        drivesOwnedCount = Array.isArray(drives.drives) ? drives.drives.length : null;
      }
    } catch {
      drivesOwnedCount = null;
    }

    return {
      provider: 'GOOGLE_WORKSPACE',
      commonMetrics: {
        externalUserId,
        externalUserDisplayName: user.name?.fullName ?? externalUserId,
        accountStatus: user.suspended ? 'SUSPENDED' : 'ACTIVE',
        sessionCount: null, // no live Admin SDK session-count endpoint (D-04)
      },
      customMetrics: {
        oauthGrants,
        isSuperAdmin: Boolean(user.isAdmin),
        drivesOwnedCount,
      },
      fetchedAt,
      cacheKey,
    };
  }

  /**
   * Maps a non-2xx Admin SDK deprovision response to a DeprovisionResult via the
   * closed-enum classifier (77-01). TRANSIENT_* THROWS (QStash retries the step).
   */
  #mapDeprovisionFailure(
    httpStatus: number,
    body: unknown,
    requestSha256: string,
    responseSha256: string,
    opts: { notFoundReason: string },
  ): DeprovisionResult {
    const providerErrorCode = GoogleWorkspaceAdapter.#providerErrorCode(body);
    const errorClass: ErrorClass = classifyError({ httpStatus, providerErrorCode });

    if (errorClass === 'TRANSIENT_RATE_LIMIT' || errorClass === 'TRANSIENT_NETWORK') {
      // Re-throw so the QStash step-runner retries the whole step with backoff.
      throw new Error(`google-workspace transient failure (${httpStatus}/${errorClass})`);
    }
    if (errorClass === 'PERMANENT_NOT_FOUND') {
      return {
        status: 'LIKELY_GONE',
        skipped: false,
        reason: opts.notFoundReason,
        failureKind: 'USER_NOT_FOUND',
        errorClass,
        requestSha256,
        responseSha256,
      };
    }
    return {
      status: 'FAILED',
      failureKind: errorClass === 'PERMANENT_AUTH_EXPIRED' ? 'AUTH_REVOKED' : 'PROVIDER_ERROR',
      errorClass,
      errorMessage: `google-workspace deprovision failed (${httpStatus}/${errorClass})`,
      requestSha256,
      responseSha256,
    };
  }

  // -------------------------------------------------------------------------
  // Webhook self-trigger filter (Phase 76 D-09..D-12)
  // -------------------------------------------------------------------------

  override async handleWebhook(
    payload: unknown,
    organizationId: string,
    _connectionId: string,
  ): Promise<unknown> {
    if (typeof payload === 'object' && payload !== null && 'event' in payload) {
      const event = payload as { event: string; userId?: string };
      if (event.event === 'user.suspended' && event.userId) {
        const matched = await provenanceLookup(prisma, {
          organizationId,
          provider: 'GOOGLE_WORKSPACE',
          externalUserId: event.userId,
          actionKind: 'SUSPEND',
        });
        if (matched) {
          // D-09 — suppress our own deprovision call from re-firing the v3.0 path.
          return { suppressed: true, provenanceId: matched.id };
        }
      }
    }
    // D-11 — non-match (or non-suspend event) flows through to the default path.
    return;
  }

  // -------------------------------------------------------------------------
  // Health Status — uses BaseAdapter default (no custom behavior).
  // -------------------------------------------------------------------------
}
