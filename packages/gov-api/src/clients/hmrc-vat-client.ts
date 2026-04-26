// ---------------------------------------------------------------------------
// Phase 57 · Plan 02 — HmrcVatClient
// ---------------------------------------------------------------------------
//
// GovApiClient subclass encapsulating the HMRC VAT Registration API:
//   - OAuth 2.0 client-credentials flow (/oauth/token)
//   - GET /organisations/vat/check-vat-number/lookup/{targetVrn}[/{requesterVrn}]
//   - Accept: application/vnd.hmrc.2.0+json (HMRC API v2 — Pitfall 1)
//   - Fraud-prevention headers (Gov-Client-*, Gov-Vendor-*)
//   - Token cache (4h TTL, 5min buffer) + refresh-once-on-401-then-retry
//   - Local format pre-flight (GB VAT regex; keeps malformed VRNs off HMRC)
//   - Per-organization sliding-window rate limiter (3 req/s ≈ 180 req/min)
//   - Zod boundary parse (hmrcVatLookupResponseSchema + hmrcOauthTokenSchema)
//
// Security invariants (threat model T-57-02-04):
//   - `requesterVrn` in the HMRC path is ALWAYS sourced from `deps.platformVrn`.
//     The public `checkVatNumber` signature has NO `requesterVrn` parameter —
//     tenant enumeration via caller-supplied VRNs is impossible.
//   - Structured logging never emits Authorization, client_secret, or raw VRNs.
// ---------------------------------------------------------------------------

import type { SecretStore } from '@contractor-ops/secrets';

import { GovApiClient } from '../client.js';
import { GovApiRateLimiter } from '../rate-limiter.js';
import type { HmrcVatLookupResponse } from '../schemas/hmrc-vat.schema.js';
import { hmrcOauthTokenSchema, hmrcVatLookupResponseSchema } from '../schemas/hmrc-vat.schema.js';
import type { GovApiConfig, GovApiEnvironment } from '../types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VAT_LOOKUP_PREFIX = '/organisations/vat/check-vat-number/lookup';
const OAUTH_TOKEN_PATH = '/oauth/token';
const HMRC_ACCEPT_HEADER = 'application/vnd.hmrc.2.0+json';
const TOKEN_REFRESH_BUFFER_MS = 300_000; // 5 min early-refresh window
const HMRC_RATE_LIMIT = { maxRequests: 3, windowMs: 1000 } as const;

const SECRET_PATH_CLIENT_ID = 'hmrc/client_id';
const SECRET_PATH_CLIENT_SECRET = 'hmrc/client_secret';

// Minimal GB VAT format check — mirrors Phase 56 `isValidGbVat` public contract
// (see packages/validators/src/uk-validators.ts). Duplicated inline to avoid a
// workspace dependency cycle (gov-api ← einvoice ← validators ← einvoice).
// The orchestrator (Plan 57-03) invokes the full `isValidGbVat` validator
// before calling into this client; this inline check is defense-in-depth.
const GB_VAT_WEIGHTS = [8, 7, 6, 5, 4, 3, 2] as const;
function isValidGbVatInline(raw: string): boolean {
  const vat = raw.replace(/[\s-]/g, '').toUpperCase();
  if (/^GBGD[5-9]\d{2}$/.test(vat)) return true;
  if (/^GBHA[0-4]\d{2}$/.test(vat)) return true;
  const match = vat.match(/^GB(\d{9})(?:\d{3})?$/);
  if (!match) return false;
  const body = match[1] ?? '';
  const digits = body.split('').map(Number);
  const check = (digits[7] ?? 0) * 10 + (digits[8] ?? 0);
  const weighted = GB_VAT_WEIGHTS.reduce((sum, w, i) => sum + w * (digits[i] ?? 0), 0);
  const mod97 = (97 - (weighted % 97)) % 97;
  const mod9755 = (97 - ((weighted + 55) % 97)) % 97;
  return check === mod97 || check === mod9755;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HmrcVatLookupResult =
  | { status: 'valid'; raw: HmrcVatLookupResponse; confirmationRef: string | null }
  | { status: 'invalid'; raw: null };

export class HmrcApiError extends Error {
  public readonly httpStatus: number;
  public readonly upstreamCode?: string;

  constructor(message: string, httpStatus: number, upstreamCode?: string) {
    super(message);
    this.name = 'HmrcApiError';
    this.httpStatus = httpStatus;
    this.upstreamCode = upstreamCode;
  }
}

export interface HmrcVatClientDeps {
  /** Full gov-api configuration (baseUrls, retry, timeout). */
  config: GovApiConfig;
  /** Active environment — selects sandbox vs production base URL. */
  environment: GovApiEnvironment;
  /** Source of HMRC client credentials (`hmrc/client_id`, `hmrc/client_secret`). */
  secretStore: SecretStore;
  /**
   * Platform VRN used in verified-lookup paths.
   *
   * SECURITY: MUST come from the `HMRC_PLATFORM_VRN` env var at construction.
   * Never accept this from caller input — doing so would allow tenant
   * enumeration via crafted `requesterVrn` values (threat T-57-02-04).
   */
  platformVrn: string;
  /** Platform version string for the `Gov-Vendor-Version` fraud-prevention header. */
  pkgVersion: string;
}

interface CachedToken {
  value: string;
  /** Absolute epoch-ms after which the token is considered expired. */
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class HmrcVatClient extends GovApiClient {
  private readonly hmrcSecretStore: SecretStore;
  private readonly platformVrn: string;
  private readonly pkgVersion: string;
  protected rateLimiter: GovApiRateLimiter;
  private accessToken: CachedToken | null = null;

  constructor(deps: HmrcVatClientDeps) {
    super(deps.config, deps.environment);
    this.hmrcSecretStore = deps.secretStore;
    this.platformVrn = deps.platformVrn;
    this.pkgVersion = deps.pkgVersion;
    this.rateLimiter = new GovApiRateLimiter('hmrc-vat', HMRC_RATE_LIMIT);
  }

  override getApiName(): 'hmrc-vat' {
    return 'hmrc-vat';
  }

  // -------------------------------------------------------------------------
  // OAuth 2.0 client-credentials — /oauth/token
  // -------------------------------------------------------------------------

  /**
   * Resolves a valid access token, refreshing via /oauth/token when the
   * cached value is absent or within the 5-minute early-refresh window.
   *
   * @throws HmrcApiError when the OAuth endpoint responds !ok
   */
  private async ensureAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now()) {
      return this.accessToken.value;
    }
    return this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<string> {
    const clientId = await this.hmrcSecretStore.get(SECRET_PATH_CLIENT_ID);
    const clientSecret = await this.hmrcSecretStore.get(SECRET_PATH_CLIENT_SECRET);
    if (!(clientId && clientSecret)) {
      throw new HmrcApiError('HMRC client credentials not found in secret store', 500);
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'read:vat',
    });

    const url = `${this.getBaseUrl()}${OAUTH_TOKEN_PATH}`;
    const response = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      // Never log the response body — HMRC may echo client_id in error messages.
      throw new HmrcApiError('HMRC OAuth token request failed', response.status);
    }

    const parsed = hmrcOauthTokenSchema.parse(await response.json());
    this.accessToken = {
      value: parsed.access_token,
      expiresAt: Date.now() + parsed.expires_in * 1000 - TOKEN_REFRESH_BUFFER_MS,
    };
    return this.accessToken.value;
  }

  // -------------------------------------------------------------------------
  // checkVatNumber
  // -------------------------------------------------------------------------

  /**
   * Look up a GB VAT registration number against the HMRC Check-a-VAT API.
   *
   * @param targetVrn - the VRN to validate (e.g. `GB193054661`)
   * @param opts.organizationId - the tenant org ID (used for rate-limit bucket)
   * @param opts.useVerifiedLookup - when `true`, issues the two-arg request
   *   that yields a `consultationNumber` (returned as `confirmationRef`).
   *   Defaults to `false` (unverified, `confirmationRef` = null).
   *
   * SECURITY: this signature intentionally has NO `requesterVrn` parameter —
   * the platform VRN is always sourced from `deps.platformVrn` (threat
   * T-57-02-04).
   */
  async checkVatNumber(
    targetVrn: string,
    opts: { organizationId: string; useVerifiedLookup?: boolean },
  ): Promise<HmrcVatLookupResult> {
    // Pre-flight: local format check avoids spending HMRC quota on typos.
    if (!isValidGbVatInline(targetVrn)) {
      return { status: 'invalid', raw: null };
    }

    // Per-org rate-limit gate.
    const limit = await this.rateLimiter.checkLimit(opts.organizationId);
    if (!limit.allowed) {
      throw new HmrcApiError('HMRC rate limit exceeded', 429);
    }

    const path = opts.useVerifiedLookup
      ? `${VAT_LOOKUP_PREFIX}/${encodeURIComponent(targetVrn)}/${encodeURIComponent(this.platformVrn)}`
      : `${VAT_LOOKUP_PREFIX}/${encodeURIComponent(targetVrn)}`;

    // First attempt.
    let response = await this.performLookup(path, opts.organizationId);

    // Single-shot token refresh on 401.
    if (response.status === 401) {
      this.accessToken = null;
      await this.ensureAccessToken();
      response = await this.performLookup(path, opts.organizationId);
      if (response.status === 401) {
        throw new HmrcApiError('HMRC returned 401 after token refresh', 401);
      }
    }

    if (response.status === 404) {
      return { status: 'invalid', raw: null };
    }

    if (!response.ok) {
      throw new HmrcApiError(`HMRC lookup returned ${response.status}`, response.status);
    }

    const parsed = hmrcVatLookupResponseSchema.parse(await response.json());
    return {
      status: 'valid',
      raw: parsed,
      confirmationRef: parsed.consultationNumber ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Internal: single HTTP lookup with fraud-prevention + Authorization headers
  // -------------------------------------------------------------------------

  private async performLookup(path: string, organizationId: string): Promise<Response> {
    const token = await this.ensureAccessToken();
    const headers = {
      Accept: HMRC_ACCEPT_HEADER,
      Authorization: `Bearer ${token}`,
      'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
      'Gov-Client-User-IDs': `os=contractor-ops;orgId=${organizationId}`,
      'Gov-Vendor-Product-Name': 'contractor-ops',
      'Gov-Vendor-Version': this.pkgVersion,
    } as Record<string, string>;

    return this.fetch(path, { method: 'GET', headers }, { organizationId, skipAudit: false });
  }
}
