// ---------------------------------------------------------------------------
// Phase 84 · Plan 04 — UspsAddressClient (US-FIELD-03, D-03)
// ---------------------------------------------------------------------------
//
// USPS Addresses 3.0 adapter. Mirrors the hmrc-vat-client.ts template:
//   - OAuth 2.0 client-credentials flow (POST /oauth2/v3/token)
//   - GET /addresses/v3/address?streetAddress=&secondaryAddress=&city=&state=&ZIPCode=&ZIPPlus4=
//   - In-memory token cache (8h TTL − 5min buffer) + single-flight refresh:
//     concurrent expiries share one in-flight /oauth2/v3/token POST.
//   - Sliding-window rate limiter keyed on a FIXED GLOBAL id ('usps-global'),
//     config { maxRequests: 60, windowMs: 3_600_000 }. The 60/hr cap is
//     per-credential GLOBAL — keying on organizationId would let N orgs each
//     claim 60/hr and blow the real cap (Pitfall 4, D-03 correction).
//   - Address-result cache keyed by sha256(canonical input) to amortize the
//     60/hr budget across repeat saves of the same address.
//   - Zod safeParse boundary — schema drift / malformed bodies become
//     `unverified`, never an unsafe cast or a thrown SyntaxError.
//
// Advisory / fail-open (D-03): USPS NEVER blocks the save path. On self-throttle
// (60/hr hit) OR 5xx OR network error OR Redis/limiter failure OR a malformed /
// safeParse-failed response OR missing credentials (LOCAL-ONLY), `validateAddress`
// returns `{ verified: false, status }` WITHOUT throwing to the caller.
//
// Dependency injection: the limiter, address cache, and `fetch` are injected so
// the adapter is fully unit-testable with no live USPS creds or Redis. The
// rate-limiter and cache abstractions are satisfied in production by
// `GovApiRateLimiter` (Upstash) and an Upstash-Redis-backed cache; both fail
// open by design when their backing store is absent.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import type { Logger } from '@contractor-ops/logger';
import { createLogger } from '@contractor-ops/logger';

import { uspsAddressResponseSchema, uspsOauthTokenSchema } from '../schemas/usps-address.schema.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OAUTH_TOKEN_PATH = '/oauth2/v3/token';
const ADDRESS_PATH = '/addresses/v3/address';

/** 5-minute early-refresh window so a token never expires mid-request. */
const TOKEN_REFRESH_BUFFER_MS = 300_000;

/**
 * Fixed GLOBAL rate-limit identifier. The USPS 60/hr cap is per-credential and
 * shared across the whole platform — this MUST NOT be organizationId (Pitfall 4).
 */
const USPS_GLOBAL_LIMITER_ID = 'usps-global';

/** Per-credential GLOBAL USPS cap: 60 requests per hour. */
export const USPS_RATE_LIMIT = { maxRequests: 60, windowMs: 3_600_000 } as const;

/** Cache TTL for an address-validation result (1h — one limiter window). */
const ADDRESS_CACHE_TTL_SECONDS = 3_600;

/** First N chars of an unexpected response body to include in diagnostic logs. */
const ERROR_BODY_SAMPLE_LEN = 200;

// ---------------------------------------------------------------------------
// Public contract (consumed by Plan 05 on-save orchestration)
// ---------------------------------------------------------------------------

/** The address fields a caller submits for validation. */
export interface UspsAddressInput {
  streetAddress: string;
  secondaryAddress?: string;
  city: string;
  state: string;
  ZIPCode: string;
  ZIPPlus4?: string;
}

/** The CASS-normalized address USPS returns on a match. */
export interface UspsNormalizedResult {
  streetAddress: string;
  secondaryAddress?: string;
  city: string;
  state: string;
  ZIPCode: string;
  ZIPPlus4?: string;
}

/**
 * Result statuses:
 *   - `verified`    — USPS confirmed deliverability (DPV-confirmed match)
 *   - `unverified`  — USPS reachable but no confirmed match (or malformed body)
 *   - `unavailable` — USPS not consulted (self-throttle, 5xx, network/Redis down,
 *                     missing creds). Advisory; the save still proceeds.
 */
export type UspsValidationStatus = 'verified' | 'unverified' | 'unavailable';

export interface UspsValidationResult {
  verified: boolean;
  status: UspsValidationStatus;
  normalized?: UspsNormalizedResult;
}

/**
 * The sliding-window limiter contract (satisfied by `GovApiRateLimiter`).
 * Kept structural so the adapter is testable with an injected stub.
 */
export interface UspsRateLimiter {
  checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetMs: number }>;
}

/**
 * The address-result cache contract (satisfied by an Upstash-Redis wrapper).
 * `get` returns the cached `UspsValidationResult` JSON or `null` on a miss.
 */
export interface UspsAddressCache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
}

export interface UspsAddressClientDeps {
  /** USPS OAuth client id (from optional env USPS_CLIENT_ID; absent locally). */
  clientId?: string;
  /** USPS OAuth client secret (from optional env USPS_CLIENT_SECRET). */
  clientSecret?: string;
  /** USPS API base URL (default https://apis.usps.com). */
  baseUrl?: string;
  /** Injected fetch (defaults to the global fetch). */
  fetch?: typeof globalThis.fetch;
  /** GLOBAL-keyed sliding-window limiter (60/hr). */
  rateLimiter: UspsRateLimiter;
  /** Address-result cache (sha256-keyed). */
  cache: UspsAddressCache;
  /** Inject a Pino logger; defaults to a gov-api child logger. */
  logger?: Logger;
}

interface CachedToken {
  value: string;
  /** Absolute epoch-ms after which the token is considered expired. */
  expiresAt: number;
}

const DEFAULT_USPS_BASE_URL = 'https://apis.usps.com';

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class UspsAddressClient {
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly rateLimiter: UspsRateLimiter;
  private readonly cache: UspsAddressCache;
  private readonly log: Logger;

  private accessToken: CachedToken | null = null;
  /**
   * Single-flight: when set, an OAuth POST is in-flight; concurrent callers
   * await the same promise instead of stampeding the USPS IDP.
   */
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(deps: UspsAddressClientDeps) {
    this.clientId = deps.clientId;
    this.clientSecret = deps.clientSecret;
    this.baseUrl = (deps.baseUrl ?? DEFAULT_USPS_BASE_URL).replace(/\/$/, '');
    this.fetchImpl = deps.fetch ?? globalThis.fetch;
    this.rateLimiter = deps.rateLimiter;
    this.cache = deps.cache;
    this.log = deps.logger ?? createLogger({ service: 'gov-api', apiName: 'usps-address' });
  }

  getApiName(): 'usps-address' {
    return 'usps-address';
  }

  // -------------------------------------------------------------------------
  // validateAddress — the only public method
  // -------------------------------------------------------------------------

  /**
   * Validate/normalize a US address against USPS Addresses 3.0.
   *
   * NEVER throws to the caller (D-03 advisory): every failure path resolves to
   * `{ verified: false, status }` so a USPS / Redis / credential outage can
   * never block a contractor save.
   */
  async validateAddress(input: UspsAddressInput): Promise<UspsValidationResult> {
    const cacheKey = this.cacheKey(input);

    // 1) Address-result cache — amortizes the 60/hr budget across repeat saves.
    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    // 2) Missing creds (LOCAL-ONLY) → unavailable, never crash.
    if (!(this.clientId && this.clientSecret)) {
      this.log.info(
        { apiName: 'usps-address' },
        'USPS credentials absent — returning unavailable (fail-open)',
      );
      return { verified: false, status: 'unavailable' };
    }

    // 3) GLOBAL self-throttle gate. Limiter failure fails OPEN (allow).
    if (!(await this.withinRateLimit())) {
      this.log.warn(
        { apiName: 'usps-address', identifier: USPS_GLOBAL_LIMITER_ID },
        'gov-api self-throttle: usps-global bucket empty — returning unavailable',
      );
      return { verified: false, status: 'unavailable' };
    }

    // 4) Consult USPS. Any failure → advisory unavailable/unverified, no throw.
    const result = await this.callUsps(input);

    // 5) Cache the outcome (only meaningful results; unavailable is transient).
    if (result.status !== 'unavailable') {
      await this.writeCache(cacheKey, result);
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Rate limit (fail-open)
  // -------------------------------------------------------------------------

  private async withinRateLimit(): Promise<boolean> {
    try {
      const limit = await this.rateLimiter.checkLimit(USPS_GLOBAL_LIMITER_ID);
      return limit.allowed;
    } catch (err) {
      // Redis / limiter failure — fail OPEN (allow the request). The limiter's
      // own implementation also fails open, but the adapter must not throw if
      // an injected limiter rejects.
      this.log.warn(
        { err, apiName: 'usps-address' },
        'USPS rate-limiter check failed — failing open',
      );
      return true;
    }
  }

  // -------------------------------------------------------------------------
  // USPS round-trip (token + address), all failures → advisory result
  // -------------------------------------------------------------------------

  private async callUsps(input: UspsAddressInput): Promise<UspsValidationResult> {
    let token: string | null;
    try {
      token = await this.ensureAccessToken();
    } catch (err) {
      this.log.warn({ err, apiName: 'usps-address' }, 'USPS OAuth token fetch failed');
      return { verified: false, status: 'unavailable' };
    }
    if (!token) return { verified: false, status: 'unavailable' };

    let response: Response;
    try {
      response = await this.fetchImpl(this.addressUrl(input), {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      // Network error → advisory unavailable.
      this.log.warn({ err, apiName: 'usps-address' }, 'USPS address request threw');
      return { verified: false, status: 'unavailable' };
    }

    if (response.status >= 500) {
      this.log.warn(
        { status: response.status, apiName: 'usps-address' },
        'USPS address request 5xx — returning unavailable',
      );
      return { verified: false, status: 'unavailable' };
    }

    // 4xx (e.g. no match / bad request) — reachable but not confirmed.
    if (!response.ok) {
      return { verified: false, status: 'unverified' };
    }

    const json = await this.readJsonOrNull(response);
    if (json === null) return { verified: false, status: 'unverified' };

    const parsed = uspsAddressResponseSchema.safeParse(json);
    if (!parsed.success) {
      // safeParse boundary — schema drift / malformed body → unverified, no throw.
      this.log.warn(
        { apiName: 'usps-address', issue: parsed.error.message.slice(0, ERROR_BODY_SAMPLE_LEN) },
        'USPS response failed schema validation — returning unverified',
      );
      return { verified: false, status: 'unverified' };
    }

    const { address, additionalInfo } = parsed.data;
    const normalized: UspsNormalizedResult = {
      streetAddress: address.streetAddress,
      ...(address.secondaryAddress ? { secondaryAddress: address.secondaryAddress } : {}),
      city: address.city,
      state: address.state,
      ZIPCode: address.ZIPCode,
      ...(address.ZIPPlus4 ? { ZIPPlus4: address.ZIPPlus4 } : {}),
    };

    // CASS deliverability: DPVConfirmation 'Y' (or 'D'/'S' partials) = confirmed.
    const dpv = additionalInfo?.DPVConfirmation;
    const verified = dpv === 'Y' || dpv === 'D' || dpv === 'S';

    return verified
      ? { verified: true, status: 'verified', normalized }
      : { verified: false, status: 'unverified', normalized };
  }

  // -------------------------------------------------------------------------
  // OAuth 2.0 client-credentials — single-flight + TTL−5min cache
  // -------------------------------------------------------------------------

  private async ensureAccessToken(): Promise<string | null> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now()) {
      return this.accessToken.value;
    }
    return this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.doRefreshAccessToken().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async doRefreshAccessToken(): Promise<string | null> {
    if (!(this.clientId && this.clientSecret)) return null;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await this.fetchImpl(`${this.baseUrl}${OAUTH_TOKEN_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      // Never log the body — USPS may echo client_id in error envelopes.
      this.log.warn(
        { status: response.status, apiName: 'usps-address' },
        'USPS OAuth token request failed',
      );
      return null;
    }

    const json = await this.readJsonOrNull(response);
    if (json === null) return null;

    const parsed = uspsOauthTokenSchema.safeParse(json);
    if (!parsed.success) {
      this.log.warn({ apiName: 'usps-address' }, 'USPS OAuth token response schema violation');
      return null;
    }

    this.accessToken = {
      value: parsed.data.access_token,
      expiresAt: Date.now() + parsed.data.expires_in * 1000 - TOKEN_REFRESH_BUFFER_MS,
    };
    return this.accessToken.value;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private addressUrl(input: UspsAddressInput): string {
    const params = new URLSearchParams({
      streetAddress: input.streetAddress,
      city: input.city,
      state: input.state,
      ZIPCode: input.ZIPCode,
    });
    if (input.secondaryAddress) params.set('secondaryAddress', input.secondaryAddress);
    if (input.ZIPPlus4) params.set('ZIPPlus4', input.ZIPPlus4);
    return `${this.baseUrl}${ADDRESS_PATH}?${params.toString()}`;
  }

  /**
   * Canonical cache key: sha256 of the trimmed, upper-cased, ordered address
   * components. Casing/whitespace-insensitive so `1 Main St` and `1 MAIN ST `
   * share a cache slot and a single USPS call.
   */
  private cacheKey(input: UspsAddressInput): string {
    const canonical = [
      input.streetAddress,
      input.secondaryAddress ?? '',
      input.city,
      input.state,
      input.ZIPCode,
      input.ZIPPlus4 ?? '',
    ]
      .map(s => s.trim().toUpperCase())
      .join('|');
    return `usps:addr:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
  }

  private async readCache(key: string): Promise<UspsValidationResult | null> {
    try {
      const cached = await this.cache.get(key);
      if (cached && typeof cached === 'object') {
        return cached as UspsValidationResult;
      }
      return null;
    } catch (err) {
      // Cache (Redis) failure → treat as a miss, fail open.
      this.log.warn({ err, apiName: 'usps-address' }, 'USPS address cache read failed');
      return null;
    }
  }

  private async writeCache(key: string, value: UspsValidationResult): Promise<void> {
    try {
      await this.cache.set(key, value, ADDRESS_CACHE_TTL_SECONDS);
    } catch (err) {
      // Cache write failure is non-fatal — never block on it.
      this.log.warn({ err, apiName: 'usps-address' }, 'USPS address cache write failed');
    }
  }

  /** Read a Response body as JSON, returning null on any read/parse failure. */
  private async readJsonOrNull(response: Response): Promise<unknown> {
    let raw: string;
    try {
      raw = await response.text();
    } catch {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      this.log.warn(
        { status: response.status, sample: raw.slice(0, ERROR_BODY_SAMPLE_LEN) },
        'USPS: non-JSON response body',
      );
      return null;
    }
  }
}
