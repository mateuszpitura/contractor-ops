import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorecoveAdapter } from '../asp/storecove/adapter.js';

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
    const signature = createHmac('sha256', TEST_CONFIG.webhookSecret!).update(body).digest('hex');

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
});
