import { createHmac } from 'node:crypto';
import type { GovApiAuditLogger, GovApiRateLimiter } from '@contractor-ops/gov-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorecoveAdapter } from '../asp/storecove/adapter.js';
import { STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID } from '../profiles/xrechnung-de/constants.js';

// ---------------------------------------------------------------------------
// Mock fetch for all tests
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const TEST_CONFIG = {
  apiKey: 'test-api-key',
  baseUrl: 'https://api-sandbox.storecove.com/api/v2',
  webhookSecret: 'test-webhook-secret',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('StorecoveAdapter', () => {
  let adapter: StorecoveAdapter;

  beforeEach(() => {
    adapter = new StorecoveAdapter(TEST_CONFIG);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // registerParticipant
  // -----------------------------------------------------------------------

  it('registerParticipant creates legal entity', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: 42,
        party_name: 'Test Corp',
        peppol_identifiers: [
          {
            identifier: '123456789012345',
            scheme: '0192',
            superscheme: 'iso6523-actorid-upis',
          },
        ],
      }),
    );

    const result = await adapter.registerParticipant({
      participantId: '0192:123456789012345',
      schemeId: '0192',
      identifierValue: '123456789012345',
      organizationName: 'Test Corp',
    });

    expect(result.registrationId).toBe('42');
    expect(result.participantId).toBe('0192:123456789012345');
    expect(result.status).toBe('registered');
    expect(result.registeredAt).toBeInstanceOf(Date);

    // Verify the POST body
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/legal_entities');
    const body = JSON.parse(options.body as string);
    expect(body.party_name).toBe('Test Corp');
    expect(body.peppol_identifiers[0].superscheme).toBe('iso6523-actorid-upis');
  });

  // -----------------------------------------------------------------------
  // transmitInvoice
  // -----------------------------------------------------------------------

  it('transmitInvoice returns accepted result on 200', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        guid: 'tx-guid-001',
        status: 'sent',
        created_at: '2026-04-11T10:00:00Z',
      }),
    );

    const result = await adapter.transmitInvoice({
      xml: '<Invoice/>',
      senderParticipantId: '0192:111111111111111',
      receiverParticipantId: '0192:222222222222222',
      documentTypeId: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    });

    expect(result.transmissionId).toBe('tx-guid-001');
    expect(result.status).toBe('accepted');
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('transmitInvoice returns rejected result on 422', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [{ code: 'INVALID_DOCUMENT', message: 'Missing required field' }],
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await adapter.transmitInvoice({
      xml: '<Invoice/>',
      senderParticipantId: '0192:111111111111111',
      receiverParticipantId: '0192:222222222222222',
      documentTypeId: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    });

    expect(result.status).toBe('rejected');
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.code).toBe('INVALID_DOCUMENT');
  });

  // -----------------------------------------------------------------------
  // getTransmissionStatus
  // -----------------------------------------------------------------------

  it('getTransmissionStatus maps storecove statuses correctly', async () => {
    const testCases = [
      { storecoveStatus: 'sent', expectedStatus: 'transmitted' },
      { storecoveStatus: 'delivered', expectedStatus: 'delivered' },
      { storecoveStatus: 'error', expectedStatus: 'failed' },
      { storecoveStatus: 'processing', expectedStatus: 'pending' },
    ];

    for (const tc of testCases) {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          guid: 'tx-001',
          status: tc.storecoveStatus,
          created_at: '2026-04-11T10:00:00Z',
        }),
      );

      const result = await adapter.getTransmissionStatus('tx-001');
      expect(result.status).toBe(tc.expectedStatus);
    }
  });

  // -----------------------------------------------------------------------
  // verifyWebhookSignature
  // -----------------------------------------------------------------------

  it('verifyWebhookSignature rejects invalid HMAC', () => {
    const body = JSON.stringify({ guid: 'wh-001', event: 'document_received' });

    const result = adapter.verifyWebhookSignature(body, {
      'storecove-signature': '0000000000000000000000000000000000000000000000000000000000000000',
    });

    expect(result.valid).toBe(false);
  });

  it('verifyWebhookSignature accepts valid HMAC', () => {
    const body = JSON.stringify({ guid: 'wh-001', event: 'document_received' });
    const signature = createHmac('sha256', TEST_CONFIG.webhookSecret).update(body).digest('hex');

    const result = adapter.verifyWebhookSignature(body, {
      'storecove-signature': signature,
    });

    expect(result.valid).toBe(true);
    expect(result.eventType).toBe('document_received');
  });

  // -----------------------------------------------------------------------
  // parseWebhookPayload
  // -----------------------------------------------------------------------

  it('parseWebhookPayload extracts XML and sender', async () => {
    const body = JSON.stringify({
      guid: 'wh-001',
      event: 'document_received',
      document_guid: 'doc-001',
      document: '<Invoice><ID>INV-001</ID></Invoice>',
    });

    const result = await adapter.parseWebhookPayload(body, {});

    expect(result.documentId).toBe('doc-001');
    expect(result.xml).toBe('<Invoice><ID>INV-001</ID></Invoice>');
    expect(result.metadata).toMatchObject({
      event: 'document_received',
      guid: 'wh-001',
    });
  });

  // -----------------------------------------------------------------------
  // pollInboundInvoices
  // -----------------------------------------------------------------------

  it('pollInboundInvoices returns mapped payloads', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          guid: 'recv-001',
          source: 'peppol',
          document: '<Invoice/>',
          sender: { identifier: '111111111111111', scheme: '0192' },
          created_at: '2026-04-11T09:00:00Z',
        },
        {
          guid: 'recv-002',
          source: 'peppol',
          document: '<Invoice/>',
          sender: { identifier: '222222222222222', scheme: '0192' },
          created_at: '2026-04-11T10:00:00Z',
        },
      ]),
    );

    const results = await adapter.pollInboundInvoices(new Date('2026-04-11T08:00:00Z'));

    expect(results).toHaveLength(2);
    expect(results[0]?.senderParticipantId).toBe('0192:111111111111111');
    expect(results[1]?.documentId).toBe('recv-002');
  });

  // -----------------------------------------------------------------------
  // Format discriminator
  // -----------------------------------------------------------------------

  describe('transmitInvoice — format discriminator', () => {
    it('maps cii-xrechnung format to STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          guid: 'tx-cii-001',
          status: 'sent',
          created_at: '2026-04-11T10:00:00Z',
        }),
      );

      await adapter.transmitInvoice({
        xml: '<rsm:CrossIndustryInvoice/>',
        senderParticipantId: '0192:111111111111111',
        receiverParticipantId: '0060:GB123456',
        documentTypeId: 'ignored-when-format-set',
        format: {
          kind: 'cii-xrechnung',
          customizationId:
            'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0',
          profileId: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
        },
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.document.document_type).toBe(STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID);
    });

    it('honours legacy documentTypeId when format is omitted (peppol-ae zero regression)', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          guid: 'tx-ae-001',
          status: 'sent',
          created_at: '2026-04-11T10:00:00Z',
        }),
      );

      await adapter.transmitInvoice({
        xml: '<Invoice/>',
        senderParticipantId: '0192:111111111111111',
        receiverParticipantId: '0192:222222222222222',
        documentTypeId: 'urn:peppol:ae-pint',
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.document.document_type).toBe('urn:peppol:ae-pint');
    });
  });

  // -----------------------------------------------------------------------
  // lookupParticipantCapabilities
  // -----------------------------------------------------------------------

  describe('lookupParticipantCapabilities', () => {
    it('normalises a Storecove discovery payload to a flat documentTypes array', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          processes: [
            {
              documentTypes: [
                STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID,
                'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice',
              ],
            },
          ],
        }),
      );

      const result = await adapter.lookupParticipantCapabilities({
        schemeId: '0060',
        value: 'GB123456',
      });

      expect(result.schemeId).toBe('0060');
      expect(result.value).toBe('GB123456');
      expect(result.documentTypes).toContain(STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID);
      expect(result.fetchedAt).toBeInstanceOf(Date);

      // URL must be the pinned base with query params (SSRF safety).
      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain('https://api-sandbox.storecove.com/api/v2');
      expect(url).toContain('/discovery/receives');
      expect(url).toContain('scheme_id=0060');
      expect(url).toContain('identifier=GB123456');
    });

    it('returns empty documentTypes on 404 participant-not-found', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

      const result = await adapter.lookupParticipantCapabilities({
        schemeId: '0060',
        value: 'GB-nonexistent',
      });

      expect(result.documentTypes).toEqual([]);
      expect(result.schemeId).toBe('0060');
      expect(result.value).toBe('GB-nonexistent');
    });

    it('propagates 5xx as a thrown error (retryable upstream failure)', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

      await expect(
        adapter.lookupParticipantCapabilities({
          schemeId: '0060',
          value: 'GB-tx-fail',
        }),
      ).rejects.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // verifyWebhookSignature — additional edge cases
  // -----------------------------------------------------------------------

  it('verifyWebhookSignature returns false when no webhook secret configured', () => {
    const adapterNoSecret = new StorecoveAdapter({
      apiKey: 'test-api-key',
      baseUrl: 'https://api-sandbox.storecove.com/api/v2',
    });
    const body = JSON.stringify({ guid: 'wh-001', event: 'test' });
    const result = adapterNoSecret.verifyWebhookSignature(body, {
      'storecove-signature': 'anything',
    });
    expect(result.valid).toBe(false);
  });

  it('verifyWebhookSignature returns false when signature header missing', () => {
    const body = JSON.stringify({ guid: 'wh-001', event: 'test' });
    const result = adapter.verifyWebhookSignature(body, {});
    expect(result.valid).toBe(false);
  });

  it('verifyWebhookSignature accepts Storecove-Signature header (capitalized)', () => {
    const body = JSON.stringify({ guid: 'wh-001', event: 'document_received' });
    const signature = createHmac('sha256', TEST_CONFIG.webhookSecret).update(body).digest('hex');
    const result = adapter.verifyWebhookSignature(body, {
      'Storecove-Signature': signature,
    });
    expect(result.valid).toBe(true);
    expect(result.eventType).toBe('document_received');
  });

  it('verifyWebhookSignature returns valid:true without eventType for invalid JSON', () => {
    const body = 'not-json-at-all';
    const signature = createHmac('sha256', TEST_CONFIG.webhookSecret).update(body).digest('hex');
    const result = adapter.verifyWebhookSignature(body, {
      'storecove-signature': signature,
    });
    expect(result.valid).toBe(true);
    expect(result.eventType).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // getParticipantStatus
  // -----------------------------------------------------------------------

  it('getParticipantStatus returns active', async () => {
    const result = await adapter.getParticipantStatus('0192:123456789012345');
    expect(result.participantId).toBe('0192:123456789012345');
    expect(result.status).toBe('active');
  });

  // -----------------------------------------------------------------------
  // getTransmissionStatus — delivered and failed details
  // -----------------------------------------------------------------------

  it('getTransmissionStatus returns deliveredAt for delivered status', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        guid: 'tx-001',
        status: 'delivered',
        created_at: '2026-04-11T10:00:00Z',
      }),
    );
    const result = await adapter.getTransmissionStatus('tx-001');
    expect(result.status).toBe('delivered');
    expect(result.deliveredAt).toBeInstanceOf(Date);
  });

  it('getTransmissionStatus returns failureReason for failed status', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        guid: 'tx-001',
        status: 'failed',
        created_at: '2026-04-11T10:00:00Z',
      }),
    );
    const result = await adapter.getTransmissionStatus('tx-001');
    expect(result.status).toBe('failed');
    expect(result.failureReason).toContain('Storecove status: failed');
  });

  // -----------------------------------------------------------------------
  // transmitInvoice — non-422 error rethrow
  // -----------------------------------------------------------------------

  it('transmitInvoice rethrows non-422 API errors', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    await expect(
      adapter.transmitInvoice({
        xml: '<Invoice/>',
        senderParticipantId: '0192:111111111111111',
        receiverParticipantId: '0192:222222222222222',
        documentTypeId: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      }),
    ).rejects.toThrow();
  });

  // -----------------------------------------------------------------------
  // registerParticipant — error handling
  // -----------------------------------------------------------------------

  it('registerParticipant rethrows API errors', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Forbidden', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    await expect(
      adapter.registerParticipant({
        participantId: '0192:123456789012345',
        schemeId: '0192',
        identifierValue: '123456789012345',
        organizationName: 'Test Corp',
      }),
    ).rejects.toThrow();
  });

  // -----------------------------------------------------------------------
  // parseWebhookPayload — uses guid when document_guid is missing
  // -----------------------------------------------------------------------

  it('parseWebhookPayload falls back to guid when document_guid is missing', async () => {
    const body = JSON.stringify({
      guid: 'wh-001',
      event: 'document_received',
      document: '<Invoice/>',
    });
    const result = await adapter.parseWebhookPayload(body, {});
    expect(result.documentId).toBe('wh-001');
  });

  // -----------------------------------------------------------------------
  // checkHealth
  // -----------------------------------------------------------------------

  it('checkHealth returns healthy when API responds with 404', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } }),
    );
    const result = await adapter.checkHealth();
    expect(result.healthy).toBe(true);
    expect(result.latencyMs).toBeDefined();
  });

  it('checkHealth returns healthy on successful response', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 0, party_name: 'test', peppol_identifiers: [] }),
    );
    const result = await adapter.checkHealth();
    expect(result.healthy).toBe(true);
  });

  it('checkHealth returns unhealthy on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await adapter.checkHealth();
    expect(result.healthy).toBe(false);
    expect(result.error).toBe('Network error');
  });

  // -----------------------------------------------------------------------
  // Rate limiting and audit logging
  // -----------------------------------------------------------------------

  it('checks rate limit on transmitInvoice when organizationId provided', async () => {
    const checkLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetMs: 1000 });
    const log = vi.fn().mockResolvedValue(undefined);

    const adapterWithDeps = new StorecoveAdapter(TEST_CONFIG, {
      rateLimiter: { checkLimit } as unknown as GovApiRateLimiter,
      auditLogger: { log } as unknown as GovApiAuditLogger,
    });

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        guid: 'tx-guid-002',
        status: 'sent',
        created_at: '2026-04-11T10:00:00Z',
      }),
    );

    await adapterWithDeps.transmitInvoice({
      xml: '<Invoice/>',
      senderParticipantId: '0192:111111111111111',
      receiverParticipantId: '0192:222222222222222',
      documentTypeId: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      organizationId: 'org-1',
    });

    expect(checkLimit).toHaveBeenCalledWith('org-1');
    expect(log).toHaveBeenCalled();
  });

  it('throws when rate limit exceeded', async () => {
    const checkLimit = vi.fn().mockResolvedValue({ allowed: false, remaining: 0, resetMs: 5000 });
    const adapterWithDeps = new StorecoveAdapter(TEST_CONFIG, {
      rateLimiter: { checkLimit } as unknown as GovApiRateLimiter,
    });

    await expect(
      adapterWithDeps.transmitInvoice({
        xml: '<Invoice/>',
        senderParticipantId: '0192:111111111111111',
        receiverParticipantId: '0192:222222222222222',
        documentTypeId: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        organizationId: 'org-1',
      }),
    ).rejects.toThrow('rate limit exceeded');
  });

  // -----------------------------------------------------------------------
  // pollInboundInvoices with organizationId
  // -----------------------------------------------------------------------

  it('pollInboundInvoices checks rate limit and emits audit when organizationId provided', async () => {
    const checkLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetMs: 1000 });
    const log = vi.fn().mockResolvedValue(undefined);

    const adapterWithDeps = new StorecoveAdapter(TEST_CONFIG, {
      rateLimiter: { checkLimit } as unknown as GovApiRateLimiter,
      auditLogger: { log } as unknown as GovApiAuditLogger,
    });

    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await adapterWithDeps.pollInboundInvoices(new Date(), 'org-1');

    expect(checkLimit).toHaveBeenCalledWith('org-1');
    expect(log).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // transmitInvoice — 422 with non-array error body
  // -----------------------------------------------------------------------

  it('transmitInvoice parses 422 with non-array error body', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('plain error text', {
        status: 422,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const result = await adapter.transmitInvoice({
      xml: '<Invoice/>',
      senderParticipantId: '0192:111111111111111',
      receiverParticipantId: '0192:222222222222222',
      documentTypeId: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    });

    expect(result.status).toBe('rejected');
    expect(result.errors?.[0]?.code).toBe('VALIDATION_ERROR');
  });
});
