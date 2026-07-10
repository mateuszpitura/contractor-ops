import { getServerEnv } from '@contractor-ops/validators';
import { z } from 'zod';

import { DEFAULT_FETCH_TIMEOUT_MS, fetchWithTimeout } from '../services/fetch-helpers.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { HrisEmployeeRecord, HrisPushInput } from '../types/hris.js';
import { BaseAdapter } from './base-adapter.js';
import type { RateLimiter } from './hris-rate-limiter.js';
import { createHrisRateLimiter } from './hris-rate-limiter.js';

// ---------------------------------------------------------------------------
// Personio Adapter (API v2)
// ---------------------------------------------------------------------------
//
// Personio authenticates with a proprietary client-credentials BEARER (NOT
// RFC-6749 OAuth 2.0 — a generic OAuth2 client mishandles it), so this adapter
// mirrors the non-OAuth KSeF shape. The pull hits /v2/persons with offset/limit
// pagination (≤200) under a conservative ≤200 req/min limiter and safeParses
// every page — attribute-scoped credentials silently omit unpermitted fields,
// so a missing attribute is normal, never an error. API v1 deprecates
// 2026-07-31; this adapter targets v2 only.

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const PERSONIO_API_BASE = 'https://api.personio.de';
const PAGE_LIMIT = 200;

const personioPageSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]),
        attributes: z.record(z.string(), z.unknown()).optional(),
        updated_at: z.string().optional(),
      }),
    )
    .optional(),
});

const personioAuthSchema = z.object({
  access_token: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
  expires_in: z.number().finite().nonnegative().optional(),
});

/**
 * Normalize a raw Personio /v2/persons page into `HrisEmployeeRecord[]`.
 * safeParses the payload — a malformed/unexpected body yields `[]` rather than
 * throwing or coercing with an unsafe cast.
 */
export function normalizePersonioPersons(payload: unknown): HrisEmployeeRecord[] {
  const parsed = personioPageSchema.safeParse(payload);
  if (!(parsed.success && parsed.data.data)) return [];
  return parsed.data.data.map(person => ({
    externalId: String(person.id),
    provider: 'PERSONIO' as const,
    attributes: person.attributes ?? {},
    updatedAt: person.updated_at,
  }));
}

export interface PersonioAdapterDeps {
  fetchImpl?: FetchLike;
  limiter?: RateLimiter;
  apiBaseUrl?: string;
}

export class PersonioAdapter extends BaseAdapter {
  readonly slug = 'personio';
  readonly displayName = 'Personio';
  readonly supportsOAuth = false;
  readonly supportsWebhooks = false;

  // Deliberately NO `refreshToken` handler: Personio bearers are minted fresh
  // from the client-credentials pair on demand (see `bearer`), so there is no
  // stored refresh token to rotate. The proactive token-refresh cron keys off
  // the presence of this handler, so leaving it undefined is what makes the
  // cron skip Personio instead of failing it into REAUTH_REQUIRED.

  private readonly fetchImpl: FetchLike;
  private readonly limiter: RateLimiter;
  private readonly apiBaseUrl: string;

  constructor(deps: PersonioAdapterDeps = {}) {
    super();
    this.fetchImpl =
      deps.fetchImpl ??
      ((url, init) => fetchWithTimeout(url, init ?? {}, { timeoutMs: DEFAULT_FETCH_TIMEOUT_MS }));
    this.limiter = deps.limiter ?? createHrisRateLimiter();
    this.apiBaseUrl = deps.apiBaseUrl ?? PERSONIO_API_BASE;
  }

  /**
   * Resolve a usable bearer. A valid cached token short-circuits (the recorded-
   * fixture + normal path); otherwise mint one from the client-credentials pair.
   * The live mint is dark until PERSONIO_CLIENT_ID / PERSONIO_CLIENT_SECRET land.
   */
  private async bearer(creds: CredentialBlob): Promise<string> {
    if (creds.accessToken && (!creds.expiresAt || new Date(creds.expiresAt) > new Date())) {
      return creds.accessToken;
    }
    const env = getServerEnv();
    if (!(env.PERSONIO_CLIENT_ID && env.PERSONIO_CLIENT_SECRET)) {
      throw new Error(
        'PERSONIO_CLIENT_ID and PERSONIO_CLIENT_SECRET are required to mint a live Personio bearer',
      );
    }
    await this.limiter.acquire();
    const res = await this.fetchImpl(`${this.apiBaseUrl}/v2/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.PERSONIO_CLIENT_ID,
        client_secret: env.PERSONIO_CLIENT_SECRET,
      }),
    });
    if (!res.ok) {
      throw new Error(`Personio auth failed with status ${res.status}`);
    }
    const parsed = personioAuthSchema.safeParse(await res.json());
    const token = parsed.success ? (parsed.data.access_token ?? parsed.data.token) : undefined;
    if (!token) {
      throw new Error('Personio auth returned an unexpected response body');
    }
    return token;
  }

  /**
   * Pull all persons via /v2/persons with offset/limit≤200 pagination under the
   * rate limiter. `updatedSince` (when supplied) requests only the delta.
   */
  async listEmployees(
    creds: CredentialBlob,
    opts?: { updatedSince?: string },
  ): Promise<HrisEmployeeRecord[]> {
    const bearer = await this.bearer(creds);
    const results: HrisEmployeeRecord[] = [];
    let offset = 0;

    for (;;) {
      await this.limiter.acquire();
      const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_LIMIT) });
      if (opts?.updatedSince) params.set('updated_since', opts.updatedSince);

      const res = await this.fetchImpl(`${this.apiBaseUrl}/v2/persons?${params.toString()}`, {
        headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Personio list failed with status ${res.status}`);
      }

      const page = normalizePersonioPersons(await res.json());
      results.push(...page);
      if (page.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }

    return results;
  }

  /**
   * Push a CO business event to the connected person as an attribute update,
   * threading the outbox event id as the idempotency key. The exact target
   * attribute/endpoint is verified against the Personio contract at enablement;
   * the path is dark until credentials + the integration.personio-sync flag are
   * granted.
   */
  async pushEmployeeEvent(creds: CredentialBlob, input: HrisPushInput): Promise<void> {
    if (!input.externalId) {
      throw new Error('Personio push requires a linked HRIS external id');
    }
    const bearer = await this.bearer(creds);
    await this.limiter.acquire();
    const res = await this.fetchImpl(
      `${this.apiBaseUrl}/v2/persons/${encodeURIComponent(input.externalId)}/attributes`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
        },
        body: JSON.stringify({ event: input.kind, workerId: input.workerId }),
      },
    );
    if (!res.ok) {
      throw new Error(`Personio push failed with status ${res.status}`);
    }
  }
}
