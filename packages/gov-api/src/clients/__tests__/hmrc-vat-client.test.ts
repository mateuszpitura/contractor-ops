// HmrcVatClient unit tests.
//
// Covers:
//   - OAuth 2.0 client-credentials flow (POST /oauth/token)
//   - Token cache across calls
//   - 401-refresh-once-then-retry
//   - Two consecutive 401s → HmrcApiError
//   - Verified vs unverified lookup paths
//   - 404 → invalid
//   - Pre-flight isValidGbVat short-circuit (no network call)
//   - Rate-limit exhaustion → HmrcApiError(429)
//   - Fraud-prevention headers on lookup
//   - checkVatNumber signature EXCLUDES requesterVrn (tenant enumeration prevention)

import { MemoryStore } from '@contractor-ops/secrets';
import { createMockServer, HttpResponse, http } from '@contractor-ops/test-utils';
import { clearHmrcTokenRefreshLedger, hmrcHandlers } from '@contractor-ops/test-utils/msw/handlers';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { HmrcVatClientDeps } from '../hmrc-vat-client.js';
import { HmrcApiError, HmrcVatClient } from '../hmrc-vat-client.js';

// ---------------------------------------------------------------------------
// Mock server setup
// ---------------------------------------------------------------------------

const { server } = createMockServer({ handlersOnly: true, extraHandlers: hmrcHandlers() });

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  clearHmrcTokenRefreshLedger();
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const HMRC_TEST_BASE = 'https://test-api.service.hmrc.gov.uk';

async function makeClient(overrides: Partial<HmrcVatClientDeps> = {}): Promise<HmrcVatClient> {
  const secretStore = new MemoryStore();
  await secretStore.set('hmrc/client_id', 'test-client-id');
  await secretStore.set('hmrc/client_secret', 'test-client-secret');

  const deps: HmrcVatClientDeps = {
    config: {
      baseUrls: {
        sandbox: HMRC_TEST_BASE,
        production: 'https://api.service.hmrc.gov.uk',
      },
      retry: { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 5 },
      timeoutMs: 5000,
    },
    environment: 'sandbox',
    secretStore,
    platformVrn: '987654321',
    pkgVersion: '0.0.0-test',
    ...overrides,
  };

  return new HmrcVatClient(deps);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HmrcVatClient — getApiName', () => {
  it('returns "hmrc-vat"', async () => {
    const client = await makeClient();
    expect(client.getApiName()).toBe('hmrc-vat');
  });
});

describe('HmrcVatClient — verified lookup (PAY-03)', () => {
  it('returns { status: "valid", confirmationRef: "C-2026-0001" } on happy path', async () => {
    const client = await makeClient();
    const result = await client.checkVatNumber('GB193054661', {
      organizationId: 'org-1',
      useVerifiedLookup: true,
    });
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.confirmationRef).toBe('C-2026-0001');
      expect(result.raw.target.vatNumber).toBeTruthy();
    }
  });
});

describe('HmrcVatClient — unverified lookup (PAY-03)', () => {
  it('returns { status: "valid", confirmationRef: null } on happy path', async () => {
    const client = await makeClient();
    const result = await client.checkVatNumber('GB193054661', {
      organizationId: 'org-1',
    });
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.confirmationRef).toBeNull();
    }
  });
});

describe('HmrcVatClient — 404 handling (PAY-03)', () => {
  it('returns { status: "invalid", raw: null } on 404', async () => {
    const client = await makeClient();
    const result = await client.checkVatNumber('GB555555554', {
      organizationId: 'org-1',
    });
    // NOTE: 555555554 is a valid-format GB VRN (passes mod-97 check?)
    // We need an actual VRN that passes isValidGbVat but maps to HMRC_SANDBOX_INVALID_VRN.
    // Use override handler to force 404:
    server.use(
      http.get(`${HMRC_TEST_BASE}/organisations/vat/check-vat-number/lookup/:targetVrn`, () =>
        HttpResponse.json({ code: 'NOT_FOUND', message: 'VRN not found' }, { status: 404 }),
      ),
    );
    const result2 = await client.checkVatNumber('GB193054661', {
      organizationId: 'org-1',
    });
    expect(result2.status).toBe('invalid');
    if (result2.status === 'invalid') {
      expect(result2.raw).toBeNull();
    }
    // Silence unused warning on first result
    expect(result).toBeDefined();
  });
});

describe('HmrcVatClient — pre-flight GB VAT format short-circuit', () => {
  it('returns invalid WITHOUT making a network call for malformed VRN', async () => {
    const client = await makeClient();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await client.checkVatNumber('BAD-FORMAT', {
      organizationId: 'org-1',
    });
    expect(result.status).toBe('invalid');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('HmrcVatClient — OAuth token caching', () => {
  it('makes only ONE /oauth/token POST for two VAT lookups', async () => {
    const client = await makeClient();
    let tokenCalls = 0;
    server.use(
      http.post(`${HMRC_TEST_BASE}/oauth/token`, () => {
        tokenCalls += 1;
        return HttpResponse.json({
          access_token: 'cached-token-xyz',
          token_type: 'bearer' as const,
          expires_in: 14400,
          scope: 'read:vat',
        });
      }),
    );

    await client.checkVatNumber('GB193054661', { organizationId: 'org-1' });
    await client.checkVatNumber('GB193054661', { organizationId: 'org-1' });
    expect(tokenCalls).toBe(1);
  });
});

describe('HmrcVatClient — 401 refresh-once-then-retry', () => {
  it('refreshes token on 401 and retries successfully', async () => {
    const client = await makeClient();
    let lookupCalls = 0;
    server.use(
      http.get(`${HMRC_TEST_BASE}/organisations/vat/check-vat-number/lookup/:targetVrn`, () => {
        lookupCalls += 1;
        if (lookupCalls === 1) {
          return HttpResponse.json(
            { code: 'INVALID_CREDENTIALS', message: 'Token expired' },
            { status: 401 },
          );
        }
        return HttpResponse.json({
          processingDate: '2026-04-12T10:00:00Z',
          target: {
            name: 'TEST LTD',
            vatNumber: 'GB193054661',
            address: { line1: '1 St', postcode: 'SW1A 1AA', countryCode: 'GB' },
          },
        });
      }),
    );

    const result = await client.checkVatNumber('GB193054661', {
      organizationId: 'org-1',
    });
    expect(result.status).toBe('valid');
    expect(lookupCalls).toBe(2);
  });

  it('throws HmrcApiError(401) when two consecutive 401s occur', async () => {
    const client = await makeClient();
    server.use(
      http.get(`${HMRC_TEST_BASE}/organisations/vat/check-vat-number/lookup/:targetVrn`, () =>
        HttpResponse.json(
          { code: 'INVALID_CREDENTIALS', message: 'Token expired' },
          { status: 401 },
        ),
      ),
    );

    await expect(
      client.checkVatNumber('GB193054661', { organizationId: 'org-1' }),
    ).rejects.toBeInstanceOf(HmrcApiError);
    await expect(
      client.checkVatNumber('GB193054661', { organizationId: 'org-1' }),
    ).rejects.toMatchObject({ httpStatus: 401 });
  });
});

describe('HmrcVatClient — rate limiting', () => {
  it('throws HmrcApiError(503, INTERNAL_RATE_LIMIT_EXCEEDED) on internal self-throttle', async () => {
    // Bug-hunt fix: internal rate-limit denials surface as 503 with code
    // INTERNAL_RATE_LIMIT_EXCEEDED so observability can distinguish
    // "we self-throttled" from "HMRC throttled us with a real 429".
    const client = await makeClient();
    (
      client as unknown as {
        rateLimiter: { checkLimit: (id: string) => Promise<{ allowed: boolean }> };
      }
    ).rateLimiter = {
      checkLimit: async () => ({ allowed: false, remaining: 0, resetMs: 1000 }),
    };

    await expect(
      client.checkVatNumber('GB193054661', { organizationId: 'org-1' }),
    ).rejects.toMatchObject({
      httpStatus: 503,
      upstreamCode: 'INTERNAL_RATE_LIMIT_EXCEEDED',
    });
  });
});

describe('HmrcVatClient — fraud-prevention headers', () => {
  it('sends Gov-Client-* headers on the lookup request', async () => {
    const client = await makeClient();
    let capturedHeaders: Headers | null = null;
    server.use(
      http.get(
        `${HMRC_TEST_BASE}/organisations/vat/check-vat-number/lookup/:targetVrn`,
        ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({
            processingDate: '2026-04-12T10:00:00Z',
            target: {
              name: 'T',
              vatNumber: 'GB193054661',
              address: { line1: '1', postcode: 'P', countryCode: 'GB' },
            },
          });
        },
      ),
    );

    await client.checkVatNumber('GB193054661', { organizationId: 'org-42' });
    expect(capturedHeaders).not.toBeNull();
    const h = capturedHeaders as unknown as Headers;
    expect(h.get('Accept')).toBe('application/vnd.hmrc.2.0+json');
    expect(h.get('Gov-Client-Connection-Method')).toBe('WEB_APP_VIA_SERVER');
    // Bug-hunt fix: orgId is hashed (SHA-256, truncated to 16 hex chars)
    // before it leaves our perimeter. The raw Prisma key never appears
    // in the HMRC fraud-prevention header.
    const userIdHeader = h.get('Gov-Client-User-IDs') ?? '';
    expect(userIdHeader).toMatch(/^os=contractor-ops;orgId=[0-9a-f]{16}$/);
    expect(userIdHeader).not.toContain('org-42');
    expect(h.get('Gov-Vendor-Product-Name')).toBe('contractor-ops');
    expect(h.get('Gov-Vendor-Version')).toBe('0.0.0-test');
    expect(h.get('Authorization')).toMatch(/^Bearer /);
  });

  it('hashes the same orgId to a stable value across calls', async () => {
    const client = await makeClient();
    const captured: string[] = [];
    server.use(
      http.get(
        `${HMRC_TEST_BASE}/organisations/vat/check-vat-number/lookup/:targetVrn`,
        ({ request }) => {
          captured.push(request.headers.get('Gov-Client-User-IDs') ?? '');
          return HttpResponse.json({
            processingDate: '2026-04-12T10:00:00Z',
            target: {
              name: 'T',
              vatNumber: 'GB193054661',
              address: { line1: '1', postcode: 'P', countryCode: 'GB' },
            },
          });
        },
      ),
    );

    await client.checkVatNumber('GB193054661', { organizationId: 'org-stable' });
    await client.checkVatNumber('GB193054661', { organizationId: 'org-stable' });
    expect(captured[0]).toBe(captured[1]);
  });
});

describe('HmrcVatClient — security: requesterVrn is never user-supplied', () => {
  it('checkVatNumber signature has NO requesterVrn parameter', async () => {
    const client = await makeClient({ platformVrn: 'PLATFORM-999' });
    let capturedPath = '';
    server.use(
      http.get(
        `${HMRC_TEST_BASE}/organisations/vat/check-vat-number/lookup/:targetVrn/:requesterVrn`,
        ({ request }) => {
          capturedPath = new URL(request.url).pathname;
          return HttpResponse.json({
            processingDate: '2026-04-12T10:00:00Z',
            target: {
              name: 'T',
              vatNumber: 'GB193054661',
              address: { line1: '1', postcode: 'P', countryCode: 'GB' },
            },
            requester: 'PLATFORM-999',
            consultationNumber: 'C-2026-0001',
          });
        },
      ),
    );

    await client.checkVatNumber('GB193054661', {
      organizationId: 'org-1',
      useVerifiedLookup: true,
    });
    expect(capturedPath).toContain('/PLATFORM-999');
    expect(capturedPath).not.toContain('undefined');
  });
});
