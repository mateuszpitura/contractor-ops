/**
 * MSW integration test: HmrcVatClient issues real HTTP calls intercepted by
 * HMRC mock handlers (OAuth token + VAT lookup endpoints).
 */

import { MemoryStore } from '@contractor-ops/secrets';
import { createMockServer, HttpResponse, http, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { HmrcVatClientDeps } from '../hmrc-vat-client.js';
import { HmrcVatClient } from '../hmrc-vat-client.js';

// ---------------------------------------------------------------------------
// MSW server — HMRC handlers only
// ---------------------------------------------------------------------------

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['hmrc']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper: build a client with test-friendly defaults
// ---------------------------------------------------------------------------

const HMRC_TEST_BASE = 'https://test-api.service.hmrc.gov.uk';

async function makeClient(): Promise<HmrcVatClient> {
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
  };

  return new HmrcVatClient(deps);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HmrcVatClient MSW integration', () => {
  it('checkVatNumber returns valid result for sandbox VRN (193054661)', async () => {
    const client = await makeClient();

    const result = await client.checkVatNumber('GB193054661', {
      organizationId: 'org-msw-1',
    });

    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.raw.target.vatNumber).toBe('GB193054661');
      expect(result.raw.target.name).toBe('TEST COMPANY LTD');
      expect(result.raw.target.address.countryCode).toBe('GB');
      // Unverified lookup has no confirmationRef
      expect(result.confirmationRef).toBeNull();
    }
  });

  it('checkVatNumber returns invalid for a VRN that fails GB checksum preflight', async () => {
    // GB555555555 fails the inline isValidGbVat checksum, so the client
    // short-circuits to { status: 'invalid' } before reaching the network.
    // This validates the defense-in-depth preflight path.
    const client = await makeClient();

    const result = await client.checkVatNumber('GB555555555', {
      organizationId: 'org-msw-2',
    });

    expect(result.status).toBe('invalid');
    expect(result.raw).toBeNull();
  });

  it('checkVatNumber returns invalid after a real network 404 (post-network sad path)', async () => {
    // Validates the post-network 404 → invalid mapping: change a contractor's
    // VAT ID to an invalid VRN; the HMRC sandbox returns 404; the pill flips
    // to Invalid.
    //
    // The default HMRC handler returns 404 ONLY for HMRC_SANDBOX_INVALID_VRN
    // ('555555555'), but that VRN fails the inline checksum preflight and the
    // client short-circuits BEFORE the network. The existing line-77 test
    // covers that defense-in-depth path.
    //
    // To prove the post-network 404 → invalid mapping (lines 226-228 of
    // hmrc-vat-client.ts: `if (response.status === 404) return { status:
    // 'invalid', raw: null }`), override the handler at test scope to return
    // 404 for a checksum-PASSING VRN (the canonical sandbox valid), and
    // count handler invocations so a regression that re-introduces a
    // checksum-style early-return is caught.
    let handlerCallCount = 0;
    server.use(
      http.get(`${HMRC_TEST_BASE}/organisations/vat/check-vat-number/lookup/:targetVrn`, () => {
        handlerCallCount += 1;
        return HttpResponse.json(
          { code: 'NOT_FOUND', message: 'The provided VRN was not found' },
          { status: 404 },
        );
      }),
    );

    const client = await makeClient();

    const result = await client.checkVatNumber('GB193054661', {
      organizationId: 'org-msw-3',
    });

    expect(handlerCallCount).toBe(1);
    expect(result.status).toBe('invalid');
    expect(result.raw).toBeNull();
  });
});
