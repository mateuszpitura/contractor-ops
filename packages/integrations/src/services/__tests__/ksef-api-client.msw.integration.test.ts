/**
 * MSW integration test: KsefApiClient issues real HTTP calls intercepted by
 * KSeF mock handlers (public key, challenge, token redeem, session poll).
 */

import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { KsefApiClient } from '../ksef-api-client.js';

// ---------------------------------------------------------------------------
// MSW server — KSeF handlers only
// ---------------------------------------------------------------------------

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['ksef']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('KsefApiClient MSW integration', () => {
  it('authenticate() returns session with jwt and referenceNumber', async () => {
    const client = new KsefApiClient('test');

    const session = await client.authenticate('test-auth-token', '1234567890');

    expect(session.jwt).toMatch(/^ksef_jwt_/);
    expect(session.referenceNumber).toMatch(/^ref-/);
    expect(session.encryptionKey).toBeInstanceOf(Buffer);
    expect(session.encryptionKey.length).toBe(32);
  });

  it('verifyCredentials() returns true for valid credentials', async () => {
    const client = new KsefApiClient('test');

    const result = await client.verifyCredentials('test-auth-token', '1234567890');

    expect(result).toBe(true);
  });
});
