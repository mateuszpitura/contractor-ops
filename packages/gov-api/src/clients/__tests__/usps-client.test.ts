// Phase 84 · Plan 00 (Wave 0 RED) — US-FIELD-03 (D-03) USPS adapter contract.
// See .planning/milestones/v7.0-phases/84-.../84-VALIDATION.md.
//
// RED until Plan 04 creates `packages/gov-api/src/clients/usps-client.ts`
// exporting `UspsAddressClient` (subclass of GovApiClient, mirroring
// hmrc-vat-client.ts). The import below resolves to a not-yet-existing module
// so the suite fails (Cannot find module).
//
// Contract locked here (every US-FIELD-03 row in 84-VALIDATION.md):
//   - OAuth token cache: one /oauth2/v3/token POST across two validateAddress calls
//   - 60/hr GLOBAL self-throttle → { verified:false } WITHOUT throwing (D-03 fail-open)
//   - Redis-down / limiter failure → fails open (unverified, never throws to the save path)
//   - address-result cache hit avoids a second upstream fetch
//   - malformed USPS response caught by safeParse → unverified, no throw
//
// All network + Redis are mocked (mocked fetch + injected limiter/cache); no
// live USPS creds (LOCAL-ONLY).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UspsAddressClient } from '../usps-client.js';

const USPS_BASE = 'https://apis.usps.com';

const VALID_ADDRESS_INPUT = {
  streetAddress: '1 Main St',
  city: 'Anytown',
  state: 'NY',
  ZIPCode: '10001',
};

const TOKEN_BODY = {
  access_token: 'usps-token-abc',
  token_type: 'Bearer',
  expires_in: 28800,
};

const VALID_ADDRESS_BODY = {
  address: {
    streetAddress: '1 MAIN ST',
    city: 'ANYTOWN',
    state: 'NY',
    ZIPCode: '10001',
    ZIPPlus4: '0001',
  },
  additionalInfo: { DPVConfirmation: 'Y' },
};

/** A fetch mock that serves the OAuth token then the address response. */
function makeFetchMock(addressBody: unknown = VALID_ADDRESS_BODY, addressStatus = 200) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/oauth2/v3/token')) {
      return new Response(JSON.stringify(TOKEN_BODY), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(addressBody), {
      status: addressStatus,
      headers: { 'content-type': 'application/json' },
    });
  });
}

/** Injectable limiter that always allows (the happy path). */
const allowLimiter = {
  checkLimit: vi.fn(async () => ({ allowed: true, remaining: 59, resetMs: 3_600_000 })),
};

/** Injectable in-memory address cache. */
function makeCache() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: unknown) => {
      store.set(k, v);
    }),
  };
}

function makeClient(over: Record<string, unknown> = {}) {
  return new UspsAddressClient({
    clientId: 'usps-client-id',
    clientSecret: 'usps-client-secret',
    baseUrl: USPS_BASE,
    fetch: over.fetch ?? makeFetchMock(),
    rateLimiter: over.rateLimiter ?? allowLimiter,
    cache: over.cache ?? makeCache(),
    ...over,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  allowLimiter.checkLimit.mockResolvedValue({ allowed: true, remaining: 59, resetMs: 3_600_000 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// OAuth token cache
// ---------------------------------------------------------------------------

describe('UspsAddressClient — OAuth token cache', () => {
  it('fetches the OAuth token only ONCE across two validateAddress calls', async () => {
    const fetchMock = makeFetchMock();
    const client = makeClient({ fetch: fetchMock });
    await client.validateAddress(VALID_ADDRESS_INPUT);
    await client.validateAddress({ ...VALID_ADDRESS_INPUT, streetAddress: '2 Main St' });
    const tokenCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('/oauth2/v3/token'));
    expect(tokenCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Fail-open: global 60/hr self-throttle (D-03)
// ---------------------------------------------------------------------------

describe('UspsAddressClient — 60/hr global self-throttle (D-03 fail-open)', () => {
  it('returns { verified: false } WITHOUT throwing when the global limiter denies', async () => {
    const throttled = {
      checkLimit: vi.fn(async () => ({ allowed: false, remaining: 0, resetMs: 3_600_000 })),
    };
    const fetchMock = makeFetchMock();
    const client = makeClient({ fetch: fetchMock, rateLimiter: throttled });
    const result = await client.validateAddress(VALID_ADDRESS_INPUT);
    expect(result.verified).toBe(false);
    // Self-throttle must NOT spend an upstream call.
    const addressCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('/addresses/'));
    expect(addressCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Fail-open: Redis / limiter failure
// ---------------------------------------------------------------------------

describe('UspsAddressClient — Redis-down fail-open', () => {
  it('allows the request (unverified, no throw) when the limiter throws', async () => {
    const brokenLimiter = {
      checkLimit: vi.fn(async () => {
        throw new Error('Redis connection refused');
      }),
    };
    const client = makeClient({ rateLimiter: brokenLimiter });
    // A limiter (Redis) failure must never throw to the save path.
    await expect(client.validateAddress(VALID_ADDRESS_INPUT)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Address-result cache
// ---------------------------------------------------------------------------

describe('UspsAddressClient — address-result cache', () => {
  it('a cache hit avoids a second upstream address fetch', async () => {
    const fetchMock = makeFetchMock();
    const cache = makeCache();
    const client = makeClient({ fetch: fetchMock, cache });
    await client.validateAddress(VALID_ADDRESS_INPUT);
    await client.validateAddress(VALID_ADDRESS_INPUT); // identical input → cache hit
    const addressCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('/addresses/'));
    expect(addressCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// safeParse boundary
// ---------------------------------------------------------------------------

describe('UspsAddressClient — malformed response (safeParse)', () => {
  it('returns unverified (no throw) when USPS returns a schema-violating body', async () => {
    const fetchMock = makeFetchMock({ unexpected: 'garbage', address: 42 });
    const client = makeClient({ fetch: fetchMock });
    const result = await client.validateAddress(VALID_ADDRESS_INPUT);
    expect(result.verified).toBe(false);
  });

  it('returns unverified (no throw) on a USPS 5xx', async () => {
    const fetchMock = makeFetchMock({ error: 'upstream' }, 503);
    const client = makeClient({ fetch: fetchMock });
    await expect(client.validateAddress(VALID_ADDRESS_INPUT)).resolves.toMatchObject({
      verified: false,
    });
  });
});
