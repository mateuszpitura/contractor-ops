import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorecoveApiError, StorecoveClient } from '../client.js';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const TEST_CONFIG = {
  apiKey: 'test-api-key',
  baseUrl: 'https://api-sandbox.storecove.com/api/v2/',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('StorecoveClient', () => {
  let client: StorecoveClient;

  beforeEach(() => {
    client = new StorecoveClient(TEST_CONFIG);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('strips trailing slash from baseUrl', () => {
      const c = new StorecoveClient({ apiKey: 'key', baseUrl: 'https://example.com/' });
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ guid: 'g1', status: 'sent', created_at: '2026-01-01T00:00:00Z' }),
      );
      void c.getSubmission('g1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/document_submissions/g1',
        expect.any(Object),
      );
    });
  });

  // -------------------------------------------------------------------------
  // submitDocument
  // -------------------------------------------------------------------------

  describe('submitDocument', () => {
    it('sends POST to /document_submissions with correct body', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          guid: 'sub-123',
          status: 'sent',
          created_at: '2026-04-11T00:00:00Z',
        }),
      );

      const result = await client.submitDocument({
        xml: '<Invoice/>',
        senderLegalEntityId: 42,
        receiverIdentifier: '0192:123456',
        receiverScheme: '0192',
        documentType: 'invoice',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api-sandbox.storecove.com/api/v2/document_submissions');
      expect(opts.method).toBe('POST');
      expect(opts.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        }),
      );

      const body = JSON.parse(opts.body as string);
      expect(body.legal_entity_id).toBe(42);
      expect(body.document.raw_document).toBe('<Invoice/>');
      expect(body.routing.eIdentifiers[0].identifier).toBe('0192:123456');

      expect(result.guid).toBe('sub-123');
      expect(result.status).toBe('sent');
    });

    it('throws StorecoveApiError on non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{"error":"bad request"}', { status: 400, statusText: 'Bad Request' }),
      );

      await expect(
        client.submitDocument({
          xml: '<Invoice/>',
          senderLegalEntityId: 1,
          receiverIdentifier: 'id',
          receiverScheme: 'sch',
          documentType: 'invoice',
        }),
      ).rejects.toThrow(StorecoveApiError);
    });

    it('throws StorecoveApiError for invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce(new Response('not-json', { status: 200, statusText: 'OK' }));

      await expect(
        client.submitDocument({
          xml: '<Invoice/>',
          senderLegalEntityId: 1,
          receiverIdentifier: 'id',
          receiverScheme: 'sch',
          documentType: 'invoice',
        }),
      ).rejects.toThrow('invalid JSON');
    });
  });

  // -------------------------------------------------------------------------
  // getSubmission
  // -------------------------------------------------------------------------

  describe('getSubmission', () => {
    it('fetches submission by GUID', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          guid: 'guid-abc',
          status: 'delivered',
          created_at: '2026-04-12T10:00:00Z',
        }),
      );

      const result = await client.getSubmission('guid-abc');
      expect(result.guid).toBe('guid-abc');
      expect(result.status).toBe('delivered');
      expect(mockFetch.mock.calls[0]?.[0]).toBe(
        'https://api-sandbox.storecove.com/api/v2/document_submissions/guid-abc',
      );
    });
  });

  // -------------------------------------------------------------------------
  // createLegalEntity
  // -------------------------------------------------------------------------

  describe('createLegalEntity', () => {
    it('sends POST to /legal_entities and returns parsed entity', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          id: 99,
          party_name: 'Test Corp',
          peppol_identifiers: [
            { identifier: '0192:VAT123', scheme: '0192', superscheme: 'iso6523-actorid-upis' },
          ],
        }),
      );

      const result = await client.createLegalEntity({
        partyName: 'Test Corp',
        identifier: '0192:VAT123',
        scheme: '0192',
      });

      expect(result.id).toBe(99);
      expect(result.party_name).toBe('Test Corp');

      const body = JSON.parse((mockFetch.mock.calls[0]?.[1] as RequestInit).body as string);
      expect(body.party_name).toBe('Test Corp');
      expect(body.peppol_identifiers[0].superscheme).toBe('iso6523-actorid-upis');
    });
  });

  // -------------------------------------------------------------------------
  // getLegalEntity
  // -------------------------------------------------------------------------

  describe('getLegalEntity', () => {
    it('fetches legal entity by ID', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          id: 42,
          party_name: 'Entity',
          peppol_identifiers: [],
        }),
      );

      const result = await client.getLegalEntity(42);
      expect(result.id).toBe(42);
      expect(mockFetch.mock.calls[0]?.[0]).toBe(
        'https://api-sandbox.storecove.com/api/v2/legal_entities/42',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getReceivedDocuments
  // -------------------------------------------------------------------------

  describe('getReceivedDocuments', () => {
    it('fetches received documents since a given date', async () => {
      const since = new Date('2026-04-01T00:00:00Z');
      mockFetch.mockResolvedValueOnce(
        jsonResponse([
          {
            guid: 'doc-1',
            source: 'peppol',
            document: '<Invoice/>',
            sender: { identifier: 'VAT123', scheme: '0192' },
            created_at: '2026-04-02T00:00:00Z',
          },
        ]),
      );

      const result = await client.getReceivedDocuments(since);
      expect(result).toHaveLength(1);
      expect(result[0]?.guid).toBe('doc-1');
      expect(mockFetch.mock.calls[0]?.[0]).toContain('since=2026-04-01T00:00:00.000Z');
    });

    it('returns empty array for non-array response', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      const result = await client.getReceivedDocuments(new Date());
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('StorecoveApiError', () => {
    it('includes status code and response body', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' }),
      );

      try {
        await client.getLegalEntity(1);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StorecoveApiError);
        const apiErr = err as StorecoveApiError;
        expect(apiErr.statusCode).toBe(403);
        expect(apiErr.responseBody).toBe('Forbidden');
        expect(apiErr.name).toBe('StorecoveApiError');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Idempotency-Key header — derived from the canonical org:operation:businessKey
// ---------------------------------------------------------------------------

describe('StorecoveClient — Idempotency-Key header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends Idempotency-Key = sha256(org:storecove.peppol.send:contentDigest) on submitDocument', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ guid: 'g1', status: 'sent', created_at: '2026-01-01T00:00:00Z' }),
    );

    const client = new StorecoveClient({ apiKey: 'k', baseUrl: 'https://api.storecove.test' });
    await client.submitDocument({
      xml: '<Invoice/>',
      senderLegalEntityId: 42,
      receiverIdentifier: '0192:123456',
      receiverScheme: '0192',
      documentType: 'invoice',
      organizationId: 'org-7',
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const sent = (init.headers as Record<string, string>)['Idempotency-Key'];

    const businessKey = createHash('sha256').update('42|0192:0192:123456|<Invoice/>').digest('hex');
    const expected = createHash('sha256')
      .update(`org-7:storecove.peppol.send:${businessKey}`)
      .digest('hex');

    expect(sent).toBe(expected);
    expect(sent).toMatch(/^[a-f0-9]{64}$/);
  });

  it('caller-supplied idempotencyKey overrides the derived content digest', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ guid: 'g1', status: 'sent', created_at: '2026-01-01T00:00:00Z' }),
    );

    const client = new StorecoveClient({ apiKey: 'k', baseUrl: 'https://api.storecove.test' });
    await client.submitDocument({
      xml: '<Invoice/>',
      senderLegalEntityId: 1,
      receiverIdentifier: 'id',
      receiverScheme: 'sch',
      documentType: 'invoice',
      idempotencyKey: 'caller-natural-key-inv-1-rev-2',
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(
      'caller-natural-key-inv-1-rev-2',
    );
  });
});
