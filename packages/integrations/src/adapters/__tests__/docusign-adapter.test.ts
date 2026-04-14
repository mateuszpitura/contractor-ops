import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFindUnique,
  mockCreateEnvelope,
  mockCreateRecipientView,
  mockGetDocument,
  mockUpdateEnvelope,
  mockGetEnvelope,
  mockListRecipients,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreateEnvelope: vi.fn(async () => ({
    envelopeId: 'env-abc',
    status: 'sent',
  })),
  mockCreateRecipientView: vi.fn(async () => ({
    url: 'https://apps-d.docusign.com/signing/xyz',
  })),
  mockGetDocument: vi.fn(async () => Buffer.from('%PDF-1.4 fake')),
  mockUpdateEnvelope: vi.fn(async () => undefined),
  mockGetEnvelope: vi.fn(async () => ({
    envelopeId: 'env-abc',
    status: 'completed',
  })),
  mockListRecipients: vi.fn(async () => ({
    signers: [
      {
        recipientId: '1',
        email: 'signer@example.com',
        status: 'completed',
      },
    ],
  })),
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

vi.mock('docusign-esign', () => {
  const docusignEsign = {
    ApiClient: class ApiClient {
      setBasePath() {
        /* no-op */
      }
      addDefaultHeader() {
        /* no-op */
      }
    },
    EnvelopesApi: class EnvelopesApi {
      createEnvelope = mockCreateEnvelope;
      createRecipientView = mockCreateRecipientView;
      getDocument = mockGetDocument;
      update = mockUpdateEnvelope;
      getEnvelope = mockGetEnvelope;
      listRecipients = mockListRecipients;
    },
    Document: { constructFromObject: (o: unknown) => o },
    Signer: { constructFromObject: (o: unknown) => o },
    Recipients: { constructFromObject: (o: unknown) => o },
    EnvelopeDefinition: { constructFromObject: (o: unknown) => o },
    Envelope: { constructFromObject: (o: unknown) => o },
    Expirations: { constructFromObject: (o: unknown) => o },
    Reminders: { constructFromObject: (o: unknown) => o },
    Notification: { constructFromObject: (o: unknown) => o },
    RecipientViewRequest: { constructFromObject: (o: unknown) => o },
  };
  return { ...docusignEsign, default: docusignEsign };
});

import { DocuSignAdapter } from '../docusign-adapter.js';

function mockFetch(ok: boolean, body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

describe('DocuSignAdapter', () => {
  let adapter: DocuSignAdapter;

  beforeEach(() => {
    adapter = new DocuSignAdapter();
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: 'conn-1',
      status: 'CONNECTED',
      credentialsRef: 'enc',
      configJson: {
        accountId: 'acc-1',
        basePath: 'https://demo.docusign.net/restapi',
      },
    });
    process.env.APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.DOCUSIGN_CLIENT_ID;
    delete process.env.DOCUSIGN_CLIENT_SECRET;
    delete process.env.DOCUSIGN_WEBHOOK_SECRET;
    delete process.env.APP_URL;
  });

  it('exposes slug, displayName, OAuth and webhook flags, embedded signing', () => {
    expect(adapter.slug).toBe('docusign');
    expect(adapter.displayName).toBe('DocuSign');
    expect(adapter.supportsOAuth).toBe(true);
    expect(adapter.supportsWebhooks).toBe(true);
    expect(adapter.supportsEmbeddedSigning).toBe(true);
  });

  it('getOAuthConfig points to DocuSign OAuth and signature scope', () => {
    const c = adapter.getOAuthConfig();
    expect(c.authorizationUrl).toContain('docusign.com/oauth/auth');
    expect(c.tokenUrl).toContain('docusign.com/oauth/token');
    expect(c.scopes).toContain('signature');
  });

  it('exchangeCodeForTokens posts to token URL and maps response', async () => {
    process.env.DOCUSIGN_CLIENT_ID = 'id';
    process.env.DOCUSIGN_CLIENT_SECRET = 'secret';

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
    expect(out.tokenType).toBe('Bearer');
    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
  });

  it('exchangeCodeForTokens throws on non-ok response', async () => {
    process.env.DOCUSIGN_CLIENT_ID = 'id';
    process.env.DOCUSIGN_CLIENT_SECRET = 'secret';
    vi.stubGlobal('fetch', mockFetch(false, 'bad', 401));

    await expect(adapter.exchangeCodeForTokens('code', 'http://localhost/cb')).rejects.toThrow(
      /DocuSign OAuth exchange failed/,
    );
  });

  it('refreshToken posts refresh_token grant', async () => {
    process.env.DOCUSIGN_CLIENT_ID = 'id';
    process.env.DOCUSIGN_CLIENT_SECRET = 'secret';
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
      scope: 'signature',
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams((init as RequestInit).body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
  });

  it('createEnvelope calls SDK and returns external envelope id', async () => {
    const req = {
      documentBase64: Buffer.from('%PDF').toString('base64'),
      documentName: 'contract.pdf',
      signers: [
        {
          name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'signer' as const,
          routingOrder: 1,
        },
      ],
    };

    const result = await adapter.createEnvelope('conn-1', req);

    expect(mockCreateEnvelope).toHaveBeenCalled();
    expect(result.externalEnvelopeId).toBe('env-abc');
    expect(result.status).toBe('sent');
    expect(result.signers[0]?.email).toBe('jane@example.com');
  });

  it('getEmbeddedSigningUrl returns recipient view url', async () => {
    const out = await adapter.getEmbeddedSigningUrl(
      'conn-1',
      'env-abc',
      'signer@example.com',
      'http://localhost/done',
    );
    expect(out.url).toContain('docusign.com');
    expect(mockCreateRecipientView).toHaveBeenCalled();
  });

  it('getSignedDocument returns base64 pdf', async () => {
    const out = await adapter.getSignedDocument('conn-1', 'env-abc');
    expect(out.mimeType).toBe('application/pdf');
    expect(out.documentBase64.length).toBeGreaterThan(0);
    expect(mockGetDocument).toHaveBeenCalledWith('acc-1', 'env-abc', 'combined');
  });

  it('voidEnvelope updates envelope to voided', async () => {
    await adapter.voidEnvelope('conn-1', 'env-abc', 'wrong terms');
    expect(mockUpdateEnvelope).toHaveBeenCalled();
  });

  describe('normalizeWebhookEvent', () => {
    it('maps recipient completed to RECIPIENT_SIGNED', () => {
      const ev = adapter.normalizeWebhookEvent({
        envelopeId: 'env-x',
        data: {
          envelopeId: 'env-x',
          envelopeSummary: {
            status: 'sent',
            recipients: {
              signers: [
                {
                  email: 'a@b.com',
                  name: 'A',
                  status: 'completed',
                },
              ],
            },
          },
        },
      });
      expect(ev.eventType).toBe('RECIPIENT_SIGNED');
      expect(ev.recipientEmail).toBe('a@b.com');
      expect(ev.externalEnvelopeId).toBe('env-x');
    });

    it('maps envelope-level completed when no recipient row', () => {
      const ev = adapter.normalizeWebhookEvent({
        status: 'completed',
        envelopeId: 'env-9',
      });
      expect(ev.eventType).toBe('ENVELOPE_COMPLETED');
      expect(ev.envelopeStatus).toBe('COMPLETED');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns valid when HMAC matches', () => {
      process.env.DOCUSIGN_WEBHOOK_SECRET = 'whsec';
      const raw = '{"test":true}';
      const sig = createHmac('sha256', 'whsec').update(raw).digest('base64');
      const result = adapter.verifyWebhookSignature(raw, {
        'x-docusign-signature-1': sig,
      });
      expect(result).toEqual({ valid: true, eventType: 'docusign-connect' });
    });

    it('returns invalid when secret missing', () => {
      const result = adapter.verifyWebhookSignature('{}', {
        'x-docusign-signature-1': 'x',
      });
      expect(result.valid).toBe(false);
    });

    it('returns invalid when signature header missing', () => {
      process.env.DOCUSIGN_WEBHOOK_SECRET = 'whsec';
      expect(adapter.verifyWebhookSignature('{}', {}).valid).toBe(false);
    });
  });
});
