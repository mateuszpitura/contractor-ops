// ---------------------------------------------------------------------------
// Phase 57 · Plan 02 — ViesClient
// ---------------------------------------------------------------------------
//
// GovApiClient subclass for the EU VIES REST API (unauthenticated, TLS-only):
//   - GET /rest-api/ms/{countryCode}/vat/{vatNumber}
//     [?requesterMemberStateCode=&requesterNumber=]  (qualified confirmation)
//   - Simple (no requester params) → returns isValid true/false
//   - Qualified (with requester params) → returns requestIdentifier
//     (surfaced as `confirmationRef`)
//   - userError enum (MS_UNAVAILABLE, SERVICE_UNAVAILABLE, TIMEOUT, …) →
//     `status: 'unavailable'` + `userError` for the orchestrator's D-08
//     stale-fallback branch
//   - Zod `.safeParse()` at response boundary (VIES response drift mitigation,
//     threat T-57-02-02). `.refine()` on the schema guarantees either
//     `isValid` or `userError` is set.
//   - HTTP 500 → soft-fail as `unavailable` (D-08)
//   - Local DE format short-circuit via inlined `isValidUstIdNr`
//   - Per-org rate limiter (10 req/s) — polite throttle; VIES itself is soft
// ---------------------------------------------------------------------------

import { GovApiClient } from '../client.js';
import { GovApiRateLimiter } from '../rate-limiter.js';
import {
  viesLookupResponseSchema,
  type ViesLookupResponse,
} from '../schemas/vies.schema.js';
import type { GovApiConfig, GovApiEnvironment } from '../types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIES_LOOKUP_PREFIX = '/rest-api/ms';
const VIES_RATE_LIMIT = { maxRequests: 10, windowMs: 1000 } as const;

// Minimal DE USt-IdNr check — mirrors Phase 56 `isValidUstIdNr` (ISO 7064
// MOD 11,10 Pure System). Duplicated inline to avoid a workspace dependency
// cycle (gov-api ← einvoice ← validators ← einvoice). The orchestrator
// (Plan 57-03) invokes the full validator first; this is defense-in-depth.
function mod11_10CheckDigit(digits: readonly number[]): number {
  let product = 10;
  for (const d of digits) {
    let sum = (d + product) % 10;
    if (sum === 0) sum = 10;
    product = (sum * 2) % 11;
  }
  return (11 - product) % 10;
}

function isValidUstIdNrInline(raw: string): boolean {
  const vat = raw.replace(/[\s-]/g, '').toUpperCase();
  const m = vat.match(/^DE(\d{9})$/);
  if (!m) return false;
  const digits = m[1]!.split('').map(Number);
  const body = digits.slice(0, 8);
  const check = digits[8]!;
  return mod11_10CheckDigit(body) === check;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ViesLookupResult =
  | { status: 'valid'; raw: ViesLookupResponse; confirmationRef: string | null }
  | { status: 'invalid'; raw: ViesLookupResponse }
  | { status: 'unavailable'; userError: string; raw: ViesLookupResponse };

export class ViesApiError extends Error {
  public readonly httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = 'ViesApiError';
    this.httpStatus = httpStatus;
  }
}

export interface ViesClientDeps {
  /** Full gov-api configuration (baseUrls, retry, timeout). */
  config: GovApiConfig;
  /** Active environment — VIES has no formal sandbox; MSW stubs in tests. */
  environment: GovApiEnvironment;
  /** Platform MS code for qualified (consultation-number) lookups. */
  requesterMemberStateCode?: string;
  /** Platform VAT number for qualified lookups. */
  requesterNumber?: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class ViesClient extends GovApiClient {
  private readonly requesterMemberStateCode?: string;
  private readonly requesterNumber?: string;
  protected rateLimiter: GovApiRateLimiter;

  constructor(deps: ViesClientDeps) {
    super(deps.config, deps.environment);
    this.requesterMemberStateCode = deps.requesterMemberStateCode;
    this.requesterNumber = deps.requesterNumber;
    this.rateLimiter = new GovApiRateLimiter('vies', VIES_RATE_LIMIT);
  }

  override getApiName(): 'vies' {
    return 'vies';
  }

  /**
   * Look up a VAT number against the EU VIES REST API.
   *
   * @param countryCode - ISO-3166-1 alpha-2 member-state code (e.g. `DE`)
   * @param vatNumber - VAT number (MS-specific format)
   * @param opts.organizationId - tenant org ID (rate-limit bucket + audit)
   * @param opts.qualified - when `true`, adds `requesterMemberStateCode` +
   *   `requesterNumber` query params and returns `requestIdentifier` as
   *   `confirmationRef`. Requires both dep fields to be set.
   */
  async checkVatNumber(
    countryCode: string,
    vatNumber: string,
    opts: { organizationId: string; qualified?: boolean },
  ): Promise<ViesLookupResult> {
    // Qualified lookup requires requester identity up-front — fail before network.
    if (opts.qualified && (!this.requesterMemberStateCode || !this.requesterNumber)) {
      throw new ViesApiError(
        'Qualified lookup requires requesterMemberStateCode+requesterNumber',
        400,
      );
    }

    // Pre-flight: DE-specific format check keeps obvious typos off VIES.
    // Other EU countries skip pre-flight (format validators land in later phases).
    if (countryCode === 'DE' && !isValidUstIdNrInline(`DE${vatNumber}`)) {
      return {
        status: 'invalid',
        raw: {
          countryCode,
          vatNumber,
          isValid: false,
        } as ViesLookupResponse,
      };
    }

    // Per-org rate-limit gate.
    const limit = await this.rateLimiter.checkLimit(opts.organizationId);
    if (!limit.allowed) {
      throw new ViesApiError('VIES rate limit exceeded', 429);
    }

    // Build path + optional qualified query string.
    const qs = new URLSearchParams();
    if (opts.qualified && this.requesterMemberStateCode && this.requesterNumber) {
      qs.set('requesterMemberStateCode', this.requesterMemberStateCode);
      qs.set('requesterNumber', this.requesterNumber);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const path = `${VIES_LOOKUP_PREFIX}/${encodeURIComponent(countryCode)}/vat/${encodeURIComponent(vatNumber)}${suffix}`;

    const response = await this.fetch(
      path,
      { method: 'GET' },
      { organizationId: opts.organizationId },
    );

    // HTTP 5xx → soft-fail to 'unavailable' for the orchestrator's stale-fallback (D-08).
    if (response.status >= 500) {
      return {
        status: 'unavailable',
        userError: 'SERVICE_UNAVAILABLE',
        raw: {
          countryCode,
          vatNumber,
          userError: 'SERVICE_UNAVAILABLE',
        } as ViesLookupResponse,
      };
    }

    if (!response.ok) {
      throw new ViesApiError(`VIES returned ${response.status}`, response.status);
    }

    // Zod boundary — safeParse so malformed bodies are caught gracefully.
    const parseResult = viesLookupResponseSchema.safeParse(await response.json());
    if (!parseResult.success) {
      throw new ViesApiError('VIES response schema violation', 500);
    }
    const raw = parseResult.data;

    if (raw.userError !== undefined) {
      return { status: 'unavailable', userError: raw.userError, raw };
    }
    if (raw.isValid === true) {
      return {
        status: 'valid',
        raw,
        confirmationRef: raw.requestIdentifier ?? null,
      };
    }
    // isValid === false
    return { status: 'invalid', raw };
  }
}
