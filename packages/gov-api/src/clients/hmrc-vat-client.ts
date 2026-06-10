// ---------------------------------------------------------------------------
// HmrcVatClient
// ---------------------------------------------------------------------------
//
// GovApiClient subclass encapsulating the HMRC VAT Registration API:
//   - OAuth 2.0 client-credentials flow (/oauth/token)
//   - GET /organisations/vat/check-vat-number/lookup/{targetVrn}[/{requesterVrn}]
//   - Accept: application/vnd.hmrc.2.0+json (HMRC API v2)
//   - Fraud-prevention headers (Gov-Client-*, Gov-Vendor-*)
//   - Token cache (4h TTL, 5min buffer) + refresh-once-on-401-then-retry
//   - Single-flight token refresh: concurrent expiries share one in-flight
//     /oauth/token POST (no stampede on the HMRC IDP).
//   - Local format pre-flight (GB VAT regex; keeps malformed VRNs off HMRC)
//   - Per-organization sliding-window rate limiter (3 req/s ≈ 180 req/min)
//   - Zod boundary parse via `safeParse` — schema drift is converted to
//     `HmrcApiError(502)` rather than leaking a Zod stack trace.
//   - Internal rate-limit denials surface as `HmrcApiError(503)` with code
//     `INTERNAL_RATE_LIMIT_EXCEEDED` so observability can distinguish
//     "we self-throttled" from "HMRC throttled us (429)".
//
// Security invariants:
//   - `requesterVrn` in the HMRC path is ALWAYS sourced from `deps.platformVrn`.
//     The public `checkVatNumber` signature has NO `requesterVrn` parameter —
//     tenant enumeration via caller-supplied VRNs is impossible.
//   - `Gov-Client-User-IDs` carries a SHA-256 hash of the org ID, not the
//     raw internal Prisma key — see `hashOrgId()` for the scheme.
//   - Structured logging never emits Authorization, client_secret, or raw VRNs.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
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

/**
 * Length (hex chars) of the truncated SHA-256 used for the
 * `Gov-Client-User-IDs` header. 16 hex chars = 64 bits of entropy, plenty
 * for HMRC fraud-prevention correlation while leaking no info about the
 * internal Prisma org key shape.
 */
const ORG_ID_HASH_HEX_LEN = 16;

/** First N chars of an unexpected response body to include in error logs. */
const ERROR_BODY_SAMPLE_LEN = 200;

/** Internal-rate-limit error code so callers can distinguish self-throttle. */
export const INTERNAL_RATE_LIMIT_CODE = 'INTERNAL_RATE_LIMIT_EXCEEDED';

// Minimal GB VAT format check — mirrors `isValidGbVat` in packages/validators
// (see uk-validators.ts). Duplicated inline to avoid a workspace dependency
// cycle (gov-api ← einvoice ← validators ← einvoice). The orchestrator invokes
// the full `isValidGbVat` validator before calling into this client; this
// inline check is defense-in-depth.
//
// A regression test in `__tests__/format-parity.test.ts` re-runs the canonical
// validator's table-driven vectors against this inline copy to catch drift.
const GB_VAT_WEIGHTS = [8, 7, 6, 5, 4, 3, 2] as const;
export function isValidGbVatInline(raw: string): boolean {
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

/**
 * Hash an organization ID for the HMRC `Gov-Client-User-IDs` header.
 *
 * Stable, deterministic, and unkeyed — the value MUST be reproducible across
 * deployments so HMRC can correlate fraud-prevention reports back to the
 * same tenant. SHA-256 truncated to 16 hex chars (64 bits) is collision-safe
 * for any plausible tenant count and reveals nothing about our internal ID
 * format (UUID, ULID, numeric Prisma PK — all hash to fixed-length hex).
 */
function hashOrgId(organizationId: string): string {
  return createHash('sha256')
    .update(organizationId, 'utf8')
    .digest('hex')
    .slice(0, ORG_ID_HASH_HEX_LEN);
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
   * enumeration via crafted `requesterVrn` values.
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
  /**
   * Single-flight: when set, an /oauth/token POST is in-flight; concurrent
   * callers `await` the same promise instead of triggering parallel refreshes
   * (which would burn HMRC IDP quota and risk 429s on the OAuth endpoint).
   */
  private refreshInFlight: Promise<string> | null = null;

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
    // Single-flight: piggyback on an existing refresh if one is running.
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = this.doRefreshAccessToken().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async doRefreshAccessToken(): Promise<string> {
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

    // Route through the base-class fetch so the OAuth POST inherits:
    //   - timeout (config.timeoutMs)
    //   - AbortController
    //   - retry on 502/503/504 (HMRC IDP transient outages)
    //   - audit logging (with redacted body hash)
    // `skipAuth` because this call IS the auth bootstrap (no bearer yet).
    // `retryNonIdempotent: true` is safe here: an OAuth client-credentials
    // POST is effectively idempotent — replays just yield another token.
    const bodyHash = createHash('sha256')
      .update(body.toString(), 'utf8')
      .digest('hex')
      .slice(0, 16);
    const response = await this.fetch(
      OAUTH_TOKEN_PATH,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      },
      {
        skipAuth: true,
        retryNonIdempotent: true,
        // No organizationId on the OAuth bootstrap — `maybeAudit` will skip,
        // which is fine: the audit log models tenant-scoped requests, and
        // a synthetic `requestBodyHash` is logged via Pino below.
        skipAudit: true,
      },
    );

    if (!response.ok) {
      // Never log the response body — HMRC may echo client_id in error messages.
      this.log.warn(
        { status: response.status, bodyHash, endpoint: OAUTH_TOKEN_PATH },
        'HMRC OAuth token request failed',
      );
      throw new HmrcApiError('HMRC OAuth token request failed', response.status);
    }

    const json = await this.readJsonOrThrow(response, 'HMRC OAuth token');
    const parsed = hmrcOauthTokenSchema.safeParse(json);
    if (!parsed.success) {
      throw new HmrcApiError(
        'HMRC OAuth token response schema violation',
        502,
        parsed.error.message,
      );
    }
    this.accessToken = {
      value: parsed.data.access_token,
      expiresAt: Date.now() + parsed.data.expires_in * 1000 - TOKEN_REFRESH_BUFFER_MS,
    };
    return this.accessToken.value;
  }

  /**
   * Read a Response body as JSON, converting any parsing failure into an
   * `HmrcApiError(502)` with a short body sample for diagnostics. Government
   * APIs commonly proxy through CDNs that emit HTML on edge errors — the
   * untyped `await response.json()` would otherwise leak a `SyntaxError`
   * up the stack and bypass the typed-error path.
   */
  private async readJsonOrThrow(response: Response, context: string): Promise<unknown> {
    let raw: string;
    try {
      raw = await response.text();
    } catch (err) {
      throw new HmrcApiError(
        `${context}: failed to read response body`,
        502,
        err instanceof Error ? err.message : String(err),
      );
    }
    try {
      return JSON.parse(raw);
    } catch (err) {
      const sample = raw.slice(0, ERROR_BODY_SAMPLE_LEN);
      this.log.warn({ status: response.status, sample, context }, 'HMRC: non-JSON response body');
      throw new HmrcApiError(
        `${context}: non-JSON response body`,
        502,
        err instanceof Error ? err.message : String(err),
      );
    }
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
   * the platform VRN is always sourced from `deps.platformVrn` to prevent
   * tenant enumeration via caller-supplied values.
   */
  async checkVatNumber(
    targetVrn: string,
    opts: { organizationId: string; useVerifiedLookup?: boolean },
  ): Promise<HmrcVatLookupResult> {
    // Pre-flight: local format check avoids spending HMRC quota on typos.
    if (!isValidGbVatInline(targetVrn)) {
      return { status: 'invalid', raw: null };
    }

    // Per-org rate-limit gate (self-throttle).
    const limit = await this.rateLimiter.checkLimit(opts.organizationId);
    if (!limit.allowed) {
      this.log.warn(
        {
          apiName: 'hmrc-vat',
          organizationId: opts.organizationId,
          remaining: 0,
          resetMs: limit.resetMs,
        },
        'gov-api self-throttle: hmrc-vat bucket empty',
      );
      throw new HmrcApiError(
        'gov-api self-throttle: hmrc-vat bucket empty',
        503,
        INTERNAL_RATE_LIMIT_CODE,
      );
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

    const json = await this.readJsonOrThrow(response, 'HMRC VAT lookup');
    const parsed = hmrcVatLookupResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new HmrcApiError('HMRC response schema violation', 502, parsed.error.message);
    }
    return {
      status: 'valid',
      raw: parsed.data,
      confirmationRef: parsed.data.consultationNumber ?? null,
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
      // Hashed orgId — see `hashOrgId()` JSDoc. Avoids leaking the internal
      // Prisma key shape to HMRC fraud-prevention logs.
      'Gov-Client-User-IDs': `os=contractor-ops;orgId=${hashOrgId(organizationId)}`,
      'Gov-Vendor-Product-Name': 'contractor-ops',
      'Gov-Vendor-Version': this.pkgVersion,
    } as Record<string, string>;

    return this.fetch(path, { method: 'GET', headers }, { organizationId, skipAudit: false });
  }
}
