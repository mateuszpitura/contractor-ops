import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindUnique,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock('../../services/credential-service.js', () => ({
  decryptCredentials: vi.fn(() => ({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  })),
}));

import { AutentiAdapter } from '../autenti-adapter.js';

function mockFetch(ok: boolean, body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

describe('AutentiAdapter', () => {
  let adapter: AutentiAdapter;

  beforeEach(() => {
    adapter = new AutentiAdapter();
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: 'conn-1',
      status: 'CONNECTED',
      credentialsRef: 'enc',
      configJson: {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.AUTENTI_CLIENT_ID;
    delete process.env.AUTENTI_CLIENT_SECRET;
    delete process.env.AUTENTI_WEBHOOK_SECRET;
  });

  it('exposes slug, displayName, OAuth and webhooks; no embedded signing', () => {
    expect(adapter.slug).toBe('autenti');
    expect(adapter.displayName).toBe('Autenti');
    expect(adapter.supportsOAuth).toBe(true);
    expect(adapter.supportsWebhooks).toBe(true);
    expect(adapter.supportsEmbeddedSigning).toBe(false);
  });

  it('getOAuthConfig points to Autenti authorize and token URLs', () => {
    const c = adapter.getOAuthConfig();
    expect(c.authorizationUrl).toContain('autenti.com');
    expect(c.tokenUrl).toContain('auth/token');
    expect(c.scopes.join('')).toContain('document-process');
  });

  it('exchangeCodeForTokens posts form body and maps tokens', async () => {
    process.env.AUTENTI_CLIENT_ID = 'id';
    process.env.AUTENTI_CLIENT_SECRET = 'secret';

    const fetchMock = mockFetch(true, {
      access_token: 'at',
      refresh_token: 'rt',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await adapter.exchangeCodeForTokens('code', 'http://localhost/cb');

    expect(out.accessToken).toBe('at');
    expect(out.refreshToken).toBe('rt');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('exchangeCodeForTokens throws on non-ok response', async () => {
    process.env.AUTENTI_CLIENT_ID = 'id';
    process.env.AUTENTI_CLIENT_SECRET = 'secret';
    vi.stubGlobal('fetch', mockFetch(false, 'err', 400));

    await expect(adapter.exchangeCodeForTokens('code', 'http://localhost/cb')).rejects.toThrow(
      /Autenti OAuth exchange failed/,
    );
  });

  it('refreshToken sends refresh_token grant', async () => {
    process.env.AUTENTI_CLIENT_ID = 'id';
    process.env.AUTENTI_CLIENT_SECRET = 'secret';
    const fetchMock = mockFetch(true, {
      access_token: 'at2',
      refresh_token: 'rt2',
      expires_in: 7200,
      token_type: 'Bearer',
    });
    vi.stubGlobal('fetch', fetchMock);

    await adapter.refreshToken({
      accessToken: 'old',
      refreshToken: 'rt',
      tokenType: 'Bearer',
      scope: 'x',
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
  });

  it('getEmbeddedSigningUrl throws with Autenti-specific message', async () => {
    await expect(adapter.getEmbeddedSigningUrl('c', 'e', 'a@b.com', 'http://x')).rejects.toThrow(
      /does not support embedded signing/,
    );
  });

  it('getSignedDocument fetches file list then binary content', async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]).buffer;
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/files?filePurpose=SIGNED')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve([{ id: 'f1', fileName: 'out.pdf' }]),
          text: () => Promise.resolve(''),
        };
      }
      if (u.includes('/files/f1/content')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          arrayBuffer: () => Promise.resolve(pdfBytes),
          text: () => Promise.resolve(''),
        };
      }
      throw new Error(`unexpected fetch ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await adapter.getSignedDocument('conn-1', 'dp-1');

    expect(out.fileName).toBe('out.pdf');
    expect(out.mimeType).toBe('application/pdf');
    expect(Buffer.from(out.documentBase64, 'base64').length).toBeGreaterThan(0);
  });

  describe('normalizeWebhookEvent', () => {
    it('maps SIGNED status to ENVELOPE_COMPLETED', () => {
      const ev = adapter.normalizeWebhookEvent({
        documentProcessId: 'dp-1',
        status: 'SIGNED',
        eventId: 'evt-1',
      });
      expect(ev.eventType).toBe('ENVELOPE_COMPLETED');
      expect(ev.externalEnvelopeId).toBe('dp-1');
      expect(ev.envelopeStatus).toBe('COMPLETED');
      expect(ev.providerEventId).toBe('evt-1');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns valid when hex HMAC matches', () => {
      process.env.AUTENTI_WEBHOOK_SECRET = 'sec';
      const raw = '{"x":1}';
      const sig = createHmac('sha256', 'sec').update(raw).digest('hex');
      const result = adapter.verifyWebhookSignature(raw, {
        'x-autenti-signature': sig,
      });
      expect(result).toEqual({ valid: true, eventType: 'document-change' });
    });

    it('accepts x-webhook-signature header', () => {
      process.env.AUTENTI_WEBHOOK_SECRET = 'sec';
      const raw = '{}';
      const sig = createHmac('sha256', 'sec').update(raw).digest('hex');
      expect(adapter.verifyWebhookSignature(raw, { 'x-webhook-signature': sig }).valid).toBe(true);
    });

    it('returns invalid without secret', () => {
      expect(adapter.verifyWebhookSignature('{}', { 'x-autenti-signature': 'a' }).valid).toBe(
        false,
      );
    });
  });
});
