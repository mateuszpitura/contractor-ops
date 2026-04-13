// Phase 57 · Plan 02 — PAY-05 GREEN tests for ViesClient.
// See .planning/phases/57-government-api-clients/57-VALIDATION.md.
//
// Covers:
//   - Simple confirmation (unauthenticated GET, no requester params)
//   - Qualified confirmation (requesterMemberStateCode + requesterNumber in query)
//   - Qualified without requester deps → ViesApiError(400) pre-network
//   - isValid=false → invalid
//   - userError=MS_UNAVAILABLE → unavailable + userError surfaced
//   - Zod schema violation → ViesApiError(500)
//   - HTTP 500 → unavailable (D-08 soft-fail)
//   - Pre-flight isValidUstIdNr short-circuit for DE VAT
//   - Qualified request carries query params

import { createMockServer, http, HttpResponse } from '@contractor-ops/test-utils';
import { viesHandlers } from '@contractor-ops/test-utils/msw/handlers';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ViesApiError, ViesClient, type ViesClientDeps } from '../vies-client.js';

// ---------------------------------------------------------------------------
// Mock server setup
// ---------------------------------------------------------------------------

const { server } = createMockServer({ handlersOnly: true, extraHandlers: viesHandlers() });

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

const VIES_BASE = 'https://ec.europa.eu/taxation_customs/vies/rest-api';

// Valid DE USt-IdNr (python-stdnum canonical reference vector).
const DE_VALID_VAT = '136695976';
const DE_VALID_FULL = `DE${DE_VALID_VAT}`;

function makeClient(overrides: Partial<ViesClientDeps> = {}): ViesClient {
  const deps: ViesClientDeps = {
    config: {
      baseUrls: {
        sandbox: 'https://ec.europa.eu/taxation_customs/vies',
        production: 'https://ec.europa.eu/taxation_customs/vies',
      },
      retry: { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 5 },
      timeoutMs: 5000,
    },
    environment: 'production',
    ...overrides,
  };
  return new ViesClient(deps);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ViesClient — getApiName', () => {
  it('returns "vies"', () => {
    expect(makeClient().getApiName()).toBe('vies');
  });
});

describe('ViesClient — simple confirmation (PAY-05)', () => {
  it('returns { status: "valid", confirmationRef: null } on isValid=true without requester params', async () => {
    const client = makeClient();
    const result = await client.checkVatNumber('DE', DE_VALID_VAT, {
      organizationId: 'org-1',
    });
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.confirmationRef).toBeNull();
      expect(result.raw.isValid).toBe(true);
    }
  });
});

describe('ViesClient — qualified confirmation (PAY-05)', () => {
  it('returns { status: "valid", confirmationRef: "WAPIAAAAXEZNM9VJ" } with requester params', async () => {
    const client = makeClient({
      requesterMemberStateCode: 'DE',
      requesterNumber: '999999999',
    });
    const result = await client.checkVatNumber('DE', DE_VALID_VAT, {
      organizationId: 'org-1',
      qualified: true,
    });
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.confirmationRef).toBe('WAPIAAAAXEZNM9VJ');
    }
  });

  it('sends requesterMemberStateCode + requesterNumber in query string on qualified', async () => {
    const client = makeClient({
      requesterMemberStateCode: 'DE',
      requesterNumber: '111222333',
    });
    let capturedUrl = '';
    server.use(
      http.get(`${VIES_BASE}/ms/:ms/vat/:vrn`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          countryCode: 'DE',
          vatNumber: DE_VALID_VAT,
          requestDate: '2026-04-12',
          isValid: true,
          requestIdentifier: 'Q-ABC-001',
        });
      }),
    );

    await client.checkVatNumber('DE', DE_VALID_VAT, {
      organizationId: 'org-1',
      qualified: true,
    });
    expect(capturedUrl).toContain('requesterMemberStateCode=DE');
    expect(capturedUrl).toContain('requesterNumber=111222333');
  });
});

describe('ViesClient — qualified without requester deps', () => {
  it('throws ViesApiError(400) BEFORE any network call', async () => {
    const client = makeClient(); // no requesterMemberStateCode/Number
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(
      client.checkVatNumber('DE', DE_VALID_VAT, {
        organizationId: 'org-1',
        qualified: true,
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('ViesClient — isValid=false', () => {
  it('returns { status: "invalid", raw } when VIES reports isValid=false', async () => {
    const client = makeClient();
    // Use the MSW `INVALID` sentinel in path; skip DE pre-flight by using FR country.
    const result = await client.checkVatNumber('FR', 'INVALID', {
      organizationId: 'org-1',
    });
    expect(result.status).toBe('invalid');
  });
});

describe('ViesClient — userError MS_UNAVAILABLE (D-08)', () => {
  it('returns { status: "unavailable", userError: "MS_UNAVAILABLE", raw }', async () => {
    const client = makeClient();
    // Non-DE country to skip pre-flight; the MSW `MS_UNAVAILABLE` sentinel triggers the soft-fail body.
    const result = await client.checkVatNumber('FR', 'MS_UNAVAILABLE', {
      organizationId: 'org-1',
    });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.userError).toBe('MS_UNAVAILABLE');
    }
  });
});

describe('ViesClient — Zod schema rejection', () => {
  it('throws ViesApiError(500) on malformed body (neither isValid nor userError)', async () => {
    const client = makeClient();
    server.use(
      http.get(`${VIES_BASE}/ms/:ms/vat/:vrn`, () =>
        HttpResponse.json({ countryCode: 'FR', vatNumber: '123' }),
      ),
    );
    await expect(
      client.checkVatNumber('FR', '123', { organizationId: 'org-1' }),
    ).rejects.toMatchObject({ httpStatus: 500 });
  });
});

describe('ViesClient — HTTP 500 soft-fail (D-08)', () => {
  it('returns { status: "unavailable", userError: "SERVICE_UNAVAILABLE" } on HTTP 500', async () => {
    const client = makeClient();
    server.use(
      http.get(`${VIES_BASE}/ms/:ms/vat/:vrn`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    const result = await client.checkVatNumber('FR', '12345678901', {
      organizationId: 'org-1',
    });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.userError).toBe('SERVICE_UNAVAILABLE');
    }
  });
});

describe('ViesClient — pre-flight DE USt-IdNr short-circuit', () => {
  it('returns invalid WITHOUT network call for malformed DE VAT', async () => {
    const client = makeClient();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await client.checkVatNumber('DE', '123', {
      organizationId: 'org-1',
    });
    expect(result.status).toBe('invalid');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('does NOT short-circuit other EU countries (relies on VIES response)', async () => {
    const client = makeClient();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await client.checkVatNumber('FR', 'ANYTHING', {
      organizationId: 'org-1',
    });
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('ViesClient — rate limiting', () => {
  it('throws ViesApiError(429) when rate limit denies the request', async () => {
    const client = makeClient();
    (client as unknown as {
      rateLimiter: { checkLimit: (id: string) => Promise<{ allowed: boolean }> };
    }).rateLimiter = {
      checkLimit: async () => ({ allowed: false, remaining: 0, resetMs: 1000 }),
    };

    await expect(
      client.checkVatNumber('DE', DE_VALID_VAT, { organizationId: 'org-1' }),
    ).rejects.toMatchObject({ httpStatus: 429 });
  });
});

describe('ViesClient — DE_VALID_FULL sanity', () => {
  // Guard that the canonical DE vector is truly accepted (not a test env mistake)
  it('accepts canonical DE136695976 vector via full DE{vat} pre-flight', async () => {
    const client = makeClient();
    // Valid VAT must reach the network — mock a sane response.
    server.use(
      http.get(`${VIES_BASE}/ms/:ms/vat/:vrn`, () =>
        HttpResponse.json({
          countryCode: 'DE',
          vatNumber: DE_VALID_VAT,
          requestDate: '2026-04-12',
          isValid: true,
        }),
      ),
    );
    const result = await client.checkVatNumber('DE', DE_VALID_VAT, {
      organizationId: 'org-1',
    });
    expect(result.status).toBe('valid');
    expect(DE_VALID_FULL).toBe('DE136695976'); // doc anchor
  });
});
