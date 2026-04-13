/**
 * MSW integration test: ViesClient issues real HTTP calls intercepted by
 * VIES mock handlers (unauthenticated REST API).
 */

import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { ViesClientDeps } from '../vies-client.js';
import { ViesClient } from '../vies-client.js';

// ---------------------------------------------------------------------------
// MSW server — VIES handlers only
// ---------------------------------------------------------------------------

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['vies']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper: build a client with test-friendly defaults
// ---------------------------------------------------------------------------

const VIES_BASE = 'https://ec.europa.eu/taxation_customs/vies';

function makeClient(overrides: Partial<ViesClientDeps> = {}): ViesClient {
  const deps: ViesClientDeps = {
    config: {
      baseUrls: {
        sandbox: VIES_BASE,
        production: VIES_BASE,
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

describe('ViesClient MSW integration', () => {
  it('simple checkVatNumber returns valid result with isValid=true', async () => {
    const client = makeClient();

    // Use FR to skip the DE-specific inline format preflight check.
    const result = await client.checkVatNumber('FR', '12345678901', {
      organizationId: 'org-msw-1',
    });

    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.raw.isValid).toBe(true);
      expect(result.raw.countryCode).toBe('FR');
      expect(result.raw.vatNumber).toBe('12345678901');
      expect(result.raw.name).toBe('Test GmbH');
      // Simple lookup has no requestIdentifier
      expect(result.confirmationRef).toBeNull();
    }
  });

  it('qualified checkVatNumber returns confirmationRef (requestIdentifier)', async () => {
    const client = makeClient({
      requesterMemberStateCode: 'PL',
      requesterNumber: '5252448481',
    });

    // Use FR to skip the DE-specific inline format preflight check.
    const result = await client.checkVatNumber('FR', '12345678901', {
      organizationId: 'org-msw-2',
      qualified: true,
    });

    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.raw.isValid).toBe(true);
      expect(result.confirmationRef).toBe('WAPIAAAAXEZNM9VJ');
      expect(result.raw.requestIdentifier).toBe('WAPIAAAAXEZNM9VJ');
    }
  });
});
