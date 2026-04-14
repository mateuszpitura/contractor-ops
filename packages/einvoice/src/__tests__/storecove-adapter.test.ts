import { createHmac } from 'node:crypto';
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
  // Plan 61-05 — Format discriminator (D-09)
  // -----------------------------------------------------------------------

  describe('transmitInvoice — format discriminator (Plan 61-05)', () => {
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
  // Plan 61-05 — lookupParticipantCapabilities (D-11)
  // -----------------------------------------------------------------------

  describe('lookupParticipantCapabilities (Plan 61-05)', () => {
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
});
