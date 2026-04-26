import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: { findUnique: vi.fn() },
  },
}));

vi.mock('../../services/credential-service.js', () => ({
  decryptCredentials: vi.fn(() => ({
    accessToken: 'docusign-test-access-token',
    refreshToken: 'docusign-test-refresh-token',
  })),
}));

vi.mock('../../services/esign-webhook-handler.js', () => ({
  handleSigningWebhook: vi.fn(),
}));

import { DocuSignAdapter } from '../docusign-adapter.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['docusign']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DocuSignAdapter MSW integration', () => {
  let adapter: DocuSignAdapter;

  beforeEach(() => {
    adapter = new DocuSignAdapter();
    process.env.DOCUSIGN_CLIENT_ID = 'test-client-id';
    process.env.DOCUSIGN_CLIENT_SECRET = 'test-client-secret';
  });

  afterEach(() => {
    delete process.env.DOCUSIGN_CLIENT_ID;
    delete process.env.DOCUSIGN_CLIENT_SECRET;
  });

  it('exchangeCodeForTokens() returns tokens from DocuSign OAuth endpoint', async () => {
    const result = await adapter.exchangeCodeForTokens(
      'auth-code-789',
      'http://localhost:3000/callback',
    );

    expect(result.accessToken).toMatch(/^docusign_mock_/);
    expect(result.refreshToken).toMatch(/^docusign_refresh_/);
    expect(result.tokenType).toBe('Bearer');
    expect(result.scope).toBe('signature');
    expect(result.expiresAt).toBeDefined();
  });

  it('refreshToken() returns new tokens from DocuSign OAuth endpoint', async () => {
    const result = await adapter.refreshToken({
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      tokenType: 'Bearer',
      scope: 'signature',
      expiresAt: new Date().toISOString(),
    });

    expect(result.accessToken).toMatch(/^docusign_mock_/);
    expect(result.refreshToken).toMatch(/^docusign_refresh_/);
    expect(result.tokenType).toBe('Bearer');
    expect(result.scope).toBe('signature');
    expect(result.expiresAt).toBeDefined();
  });
});
