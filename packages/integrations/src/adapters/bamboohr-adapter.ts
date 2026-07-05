import { getServerEnv } from '@contractor-ops/validators';
import { z } from 'zod';

import { DEFAULT_FETCH_TIMEOUT_MS, fetchWithTimeout } from '../services/fetch-helpers.js';
import { parseJsonResponse } from '../services/parse-json-response.js';
import { withResilience } from '../services/resilience.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { HrisEmployeeRecord, HrisPushInput } from '../types/hris.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';
import type { RateLimiter } from './hris-rate-limiter.js';
import { createHrisRateLimiter } from './hris-rate-limiter.js';

// ---------------------------------------------------------------------------
// BambooHR Adapter (OAuth 2.0)
// ---------------------------------------------------------------------------
//
// BambooHR authenticates with OAuth 2.0 (the legacy Basic-auth API key is
// deprecated for B2B multi-tenant), so this adapter mirrors the Jira OAuth
// shape. The employee directory (/v1/employees/directory) is un-paginated, so
// the pull returns the full snapshot and the orchestrator diffs it via syncHash.
//
// The custom-attribute contract is UNVERIFIED: standard-field sync ships now;
// custom fields are stripped from the pull unless BAMBOOHR_CUSTOM_ATTR_VERIFIED
// is set, so an unconfirmed custom-attribute shape can never corrupt a mapping.

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const BAMBOOHR_API_BASE = 'https://api.bamboohr.com';

const BAMBOOHR_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: 'BAMBOOHR_CLIENT_ID',
  clientSecretEnvVar: 'BAMBOOHR_CLIENT_SECRET',
  // The live authorize/token endpoints are company-subdomain specific
  // (https://<company>.bamboohr.com/authorize.php|token.php); the concrete
  // subdomain is resolved from the connection at enablement.
  authorizationUrl: 'https://bamboohr.com/authorize.php',
  tokenUrl: 'https://bamboohr.com/token.php',
  scopes: ['openid', 'email'],
  redirectPath: '/api/oauth/bamboohr/callback',
};

/**
 * The known BambooHR directory fields. Anything outside this set is a custom
 * attribute and is withheld from the pull until the custom-attribute contract
 * is verified (BAMBOOHR_CUSTOM_ATTR_VERIFIED).
 */
const BAMBOOHR_STANDARD_FIELDS = new Set([
  'displayName',
  'firstName',
  'lastName',
  'preferredName',
  'workEmail',
  'jobTitle',
  'department',
  'division',
  'location',
  'status',
  'employmentStatus',
  'hireDate',
  'terminationDate',
  'supervisor',
  'mobilePhone',
  'workPhone',
]);

const bambooDirectorySchema = z.object({
  employees: z
    .array(z.object({ id: z.union([z.string(), z.number()]) }).catchall(z.unknown()))
    .optional(),
});

const bambooTokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  token_type: z.string().min(1).optional(),
  scope: z.string().optional(),
  expires_in: z.number().finite().nonnegative().optional(),
});

/**
 * Safe read of the custom-attribute verification gate. Wrapped so a missing /
 * unvalidated env (unit tests, boot before validate) degrades to "not verified"
 * — standard-field sync only — rather than throwing.
 */
function customAttrContractVerified(): boolean {
  try {
    return Boolean(getServerEnv().BAMBOOHR_CUSTOM_ATTR_VERIFIED);
  } catch {
    return false;
  }
}

/**
 * Normalize a BambooHR /v1/employees/directory snapshot into
 * `HrisEmployeeRecord[]`. When `includeCustom` is false, non-standard fields are
 * withheld (the custom-attribute contract gate). safeParses — a malformed body
 * yields `[]`.
 */
export function normalizeBambooDirectory(
  payload: unknown,
  includeCustom: boolean,
): HrisEmployeeRecord[] {
  const parsed = bambooDirectorySchema.safeParse(payload);
  if (!(parsed.success && parsed.data.employees)) return [];
  return parsed.data.employees.map(emp => {
    const attributes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(emp)) {
      if (key === 'id') continue;
      if (!(includeCustom || BAMBOOHR_STANDARD_FIELDS.has(key))) continue;
      attributes[key] = value;
    }
    return { externalId: String(emp.id), provider: 'BAMBOOHR' as const, attributes };
  });
}

export interface BambooHrAdapterDeps {
  fetchImpl?: FetchLike;
  limiter?: RateLimiter;
  apiBaseUrl?: string;
  /** Override the custom-attribute gate (defaults to BAMBOOHR_CUSTOM_ATTR_VERIFIED). */
  includeCustomAttributes?: boolean;
}

export class BambooHrAdapter extends BaseAdapter {
  readonly slug = 'bamboohr';
  readonly displayName = 'BambooHR';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  private readonly fetchImpl: FetchLike;
  private readonly limiter: RateLimiter;
  private readonly apiBaseUrl: string;
  private readonly includeCustomAttributes: boolean;

  constructor(deps: BambooHrAdapterDeps = {}) {
    super();
    this.fetchImpl =
      deps.fetchImpl ??
      ((url, init) => fetchWithTimeout(url, init ?? {}, { timeoutMs: DEFAULT_FETCH_TIMEOUT_MS }));
    this.limiter = deps.limiter ?? createHrisRateLimiter();
    this.apiBaseUrl = deps.apiBaseUrl ?? BAMBOOHR_API_BASE;
    this.includeCustomAttributes = deps.includeCustomAttributes ?? customAttrContractVerified();
  }

  override getOAuthConfig(): OAuthConfig {
    return BAMBOOHR_OAUTH_CONFIG;
  }

  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    const env = getServerEnv();
    if (!(env.BAMBOOHR_CLIENT_ID && env.BAMBOOHR_CLIENT_SECRET)) {
      throw new Error('BAMBOOHR_CLIENT_ID and BAMBOOHR_CLIENT_SECRET are required');
    }
    const response = await withResilience(
      () =>
        this.fetchImpl(BAMBOOHR_OAUTH_CONFIG.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: env.BAMBOOHR_CLIENT_ID,
            client_secret: env.BAMBOOHR_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
          }),
        }),
      { provider: 'bamboohr', retryAttempts: 0 },
    );
    if (!response.ok) {
      throw new Error(`BambooHR OAuth exchange failed with status ${response.status}`);
    }
    const data = await parseJsonResponse(
      response,
      bambooTokenSchema,
      'bamboohr:exchangeCodeForTokens',
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined,
    };
  }

  override async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    const env = getServerEnv();
    if (!(env.BAMBOOHR_CLIENT_ID && env.BAMBOOHR_CLIENT_SECRET)) {
      throw new Error('BAMBOOHR_CLIENT_ID and BAMBOOHR_CLIENT_SECRET are required');
    }
    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for BambooHR');
    }
    const response = await withResilience(
      () =>
        this.fetchImpl(BAMBOOHR_OAUTH_CONFIG.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            client_id: env.BAMBOOHR_CLIENT_ID,
            client_secret: env.BAMBOOHR_CLIENT_SECRET,
            refresh_token: credentials.refreshToken,
          }),
        }),
      { provider: 'bamboohr' },
    );
    if (!response.ok) {
      throw new Error(`BambooHR token refresh failed with status ${response.status}`);
    }
    const data = await parseJsonResponse(response, bambooTokenSchema, 'bamboohr:refreshToken');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined,
    };
  }

  /**
   * Pull the un-paginated employee directory. Standard fields always; custom
   * fields only when the custom-attribute contract is verified (D-06 gate).
   */
  async listEmployees(
    creds: CredentialBlob,
    _opts?: { updatedSince?: string },
  ): Promise<HrisEmployeeRecord[]> {
    await this.limiter.acquire();
    const res = await this.fetchImpl(`${this.apiBaseUrl}/v1/employees/directory`, {
      headers: { Authorization: `Bearer ${creds.accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    return normalizeBambooDirectory(await res.json(), this.includeCustomAttributes);
  }

  /**
   * Push a CO business event to the connected employee, threading the outbox
   * event id as the idempotency key. Dark until credentials + the
   * integration.bamboohr-sync flag are granted.
   */
  async pushEmployeeEvent(creds: CredentialBlob, input: HrisPushInput): Promise<void> {
    if (!input.externalId) return;
    await this.limiter.acquire();
    const res = await this.fetchImpl(
      `${this.apiBaseUrl}/v1/employees/${encodeURIComponent(input.externalId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
        },
        body: JSON.stringify({ event: input.kind, workerId: input.workerId }),
      },
    );
    if (!res.ok) {
      throw new Error(`BambooHR push failed with status ${res.status}`);
    }
  }
}
