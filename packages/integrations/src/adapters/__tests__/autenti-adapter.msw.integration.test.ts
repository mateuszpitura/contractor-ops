import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('../../services/credential-service.js', () => ({
  decryptCredentials: vi.fn(() => ({
    accessToken: 'autenti-test-access-token',
    refreshToken: 'autenti-test-refresh-token',
  })),
}));

vi.mock('../../services/esign-webhook-handler.js', () => ({
  handleSigningWebhook: vi.fn(),
}));

import { AutentiAdapter } from '../autenti-adapter.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['autenti']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('AutentiAdapter MSW integration', () => {
  let adapter: AutentiAdapter;

  beforeEach(() => {
    adapter = new AutentiAdapter();
    process.env.AUTENTI_CLIENT_ID = 'test-client-id';
    process.env.AUTENTI_CLIENT_SECRET = 'test-client-secret';

    mockFindUnique.mockResolvedValue({
      id: 'conn-autenti-001',
      status: 'CONNECTED',
      credentialsRef: 'encrypted-ref',
      configJson: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.AUTENTI_CLIENT_ID;
    delete process.env.AUTENTI_CLIENT_SECRET;
  });

  it('exchangeCodeForTokens() returns tokens from Autenti OAuth endpoint', async () => {
    const result = await adapter.exchangeCodeForTokens(
      'auth-code-456',
      'http://localhost:3000/callback',
    );

    expect(result.accessToken).toMatch(/^autenti_mock_/);
    expect(result.refreshToken).toMatch(/^autenti_refresh_/);
    expect(result.tokenType).toBe('Bearer');
    expect(result.scope).toContain('document-process');
    expect(result.expiresAt).toBeDefined();
  });

  it('getEnvelopeStatus() returns envelope status with signers', async () => {
    const result = await adapter.getEnvelopeStatus('conn-autenti-001', 'process-abc');

    expect(result.externalEnvelopeId).toBe('process-abc');
    expect(result.status).toBe('completed');
    expect(Array.isArray(result.signers)).toBe(true);
    expect(result.signers.length).toBeGreaterThan(0);
    expect(result.signers[0]?.email).toBe('contractor@example.com');
    expect(result.signers[0]?.status).toBe('completed');
  });

  it('getSignedDocument() returns base64 document content', async () => {
    const result = await adapter.getSignedDocument('conn-autenti-001', 'process-abc');

    expect(result.documentBase64).toBeDefined();
    expect(typeof result.documentBase64).toBe('string');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.fileName).toBeDefined();
  });
});
