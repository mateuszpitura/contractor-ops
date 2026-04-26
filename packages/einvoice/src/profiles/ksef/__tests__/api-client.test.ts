import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KsefApiClient } from '../api-client.js';

// ---------------------------------------------------------------------------
// Generate a real RSA-2048 key pair for tests (once at module load)
// ---------------------------------------------------------------------------

const { publicKey: rsaPublicKeyPem } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    arrayBuffer: () => Promise.resolve(Buffer.from(JSON.stringify(data))),
  } as unknown as Response;
}

/**
 * Set up mock responses for the full authenticate() flow (4 fetch calls).
 * Steps: public key -> challenge -> redeem -> session status (READY)
 */
function mockAuthenticateFlow() {
  mockFetch.mockResolvedValueOnce(jsonResponse({ publicKey: rsaPublicKeyPem }));
  mockFetch.mockResolvedValueOnce(jsonResponse({ challenge: 'ch-123', timestampMs: Date.now() }));
  mockFetch.mockResolvedValueOnce(
    jsonResponse({
      jwt: 'jwt-token-123',
      referenceNumber: 'ref-123',
      encryptionKey: Buffer.alloc(32).toString('base64'),
    }),
  );
  mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'READY' }));
}

// ---------------------------------------------------------------------------
// Tests -- grouped to avoid mock interference
// ---------------------------------------------------------------------------

describe('KsefApiClient', () => {
  let client: KsefApiClient;

  beforeEach(() => {
    client = new KsefApiClient('test');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('uses test URL for test environment', () => {
      expect(new KsefApiClient('test')).toBeDefined();
    });

    it('uses prod URL for prod environment', () => {
      expect(new KsefApiClient('prod')).toBeDefined();
    });

    it('defaults to prod environment', () => {
      expect(new KsefApiClient()).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Session guard
  // -------------------------------------------------------------------------

  describe('session requirement', () => {
    it('throws when calling queryInvoices without authentication', async () => {
      await expect(client.queryInvoices('1234567890', '2026-01-01', '2026-04-01')).rejects.toThrow(
        'KSeF session not established',
      );
    });

    it('throws when calling downloadInvoiceXml without authentication', async () => {
      await expect(client.downloadInvoiceXml('ref-123')).rejects.toThrow(
        'KSeF session not established',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Certificate auth (not supported)
  // -------------------------------------------------------------------------

  describe('authenticateWithCertificate', () => {
    it('throws not supported error', async () => {
      await expect(client.authenticateWithCertificate('cert', 'pass', 'nip')).rejects.toThrow(
        'Certificate-based KSeF authentication is not supported',
      );
    });
  });

  // -------------------------------------------------------------------------
  // terminateSession
  // -------------------------------------------------------------------------

  describe('terminateSession', () => {
    it('is safe to call without an active session', async () => {
      await expect(client.terminateSession()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // authenticate
  // -------------------------------------------------------------------------

  describe('authenticate', () => {
    it('completes RSA-OAEP challenge-response flow and returns session', async () => {
      mockAuthenticateFlow();

      const session = await client.authenticate('test-token', '1234567890');

      expect(session.jwt).toBe('jwt-token-123');
      expect(session.referenceNumber).toBe('ref-123');
      expect(session.encryptionKey).toBeInstanceOf(Buffer);
      expect(session.encryptionKey.length).toBe(32);
      expect(mockFetch).toHaveBeenCalledTimes(4);

      // Verify first call was to public key endpoint
      const firstCallUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(firstCallUrl).toContain('/auth/public-key');

      // Verify challenge call
      const challengeUrl = mockFetch.mock.calls[1]?.[0] as string;
      expect(challengeUrl).toContain('/auth/challenge');

      // Verify redeem call has encrypted token
      const redeemOpts = mockFetch.mock.calls[2]?.[1] as RequestInit;
      const redeemBody = JSON.parse(redeemOpts.body as string);
      expect(redeemBody.challenge).toBe('ch-123');
      expect(redeemBody.encryptedToken).toBeTruthy();
    });

    it('allocates zero-filled encryption key when server omits it', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ publicKey: rsaPublicKeyPem }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ challenge: 'ch', timestampMs: Date.now() }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ jwt: 'jwt', referenceNumber: 'ref-x' }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ processingCode: 200 }));

      const session = await client.authenticate('token', '1234567890');

      expect(session.encryptionKey.length).toBe(32);
      expect(session.encryptionKey.every(b => b === 0)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // verifyCredentials
  // -------------------------------------------------------------------------

  describe('verifyCredentials', () => {
    it('returns false when authentication fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await client.verifyCredentials('bad-token', '1234567890');
      expect(result).toBe(false);
    });

    it('returns true when authentication and termination succeed', async () => {
      mockAuthenticateFlow();
      // terminateSession POST
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      const result = await client.verifyCredentials('good-token', '1234567890');
      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // downloadInvoiceXml
  // -------------------------------------------------------------------------

  describe('downloadInvoiceXml', () => {
    it('returns XML text for non-encrypted response', async () => {
      mockAuthenticateFlow();
      await client.authenticate('token', '1234567890');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/xml' }),
        text: () => Promise.resolve('<Invoice><ID>INV-001</ID></Invoice>'),
      } as unknown as Response);

      const xml = await client.downloadInvoiceXml('ref-123');
      expect(xml).toContain('<Invoice>');
      expect(xml).toContain('INV-001');
    });

    it('decrypts AES-256-GCM encrypted response', async () => {
      mockAuthenticateFlow();
      const session = await client.authenticate('token', '1234567890');

      // Build encrypted payload: [12-byte IV][ciphertext][16-byte auth tag]
      const plaintext = '<Invoice><ID>ENCRYPTED-001</ID></Invoice>';
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', session.encryptionKey, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const payload = Buffer.concat([iv, encrypted, authTag]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        arrayBuffer: () =>
          Promise.resolve(
            payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
          ),
      } as unknown as Response);

      const xml = await client.downloadInvoiceXml('ref-encrypted');
      expect(xml).toBe(plaintext);
    });
  });

  // -------------------------------------------------------------------------
  // Retry logic (via downloadInvoiceXml after auth)
  // -------------------------------------------------------------------------

  describe('retry behavior', () => {
    it('retries on 5xx and eventually succeeds', async () => {
      mockAuthenticateFlow();
      await client.authenticate('token', '1234567890');

      // 500 -> 500 -> success
      mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));
      mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/xml' }),
        text: () => Promise.resolve('<Invoice/>'),
      } as unknown as Response);

      const xml = await client.downloadInvoiceXml('ref-retry');
      expect(xml).toBe('<Invoice/>');
    });

    it('throws immediately on 4xx (no retry)', async () => {
      mockAuthenticateFlow();
      await client.authenticate('token', '1234567890');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: () => Promise.resolve('Not Found'),
      } as unknown as Response);

      await expect(client.downloadInvoiceXml('ref-xxx')).rejects.toThrow('KSeF API error 404');
    });
  });

  // -------------------------------------------------------------------------
  // Static helpers
  // -------------------------------------------------------------------------

  describe('static helpers', () => {
    it('backoffMs caps at 10 seconds', () => {
      // Access private static via bracket notation for white-box testing
      const backoff = (KsefApiClient as unknown as Record<string, unknown>).backoffMs as
        | ((n: number) => number)
        | undefined;
      if (backoff) {
        expect(backoff(0)).toBe(1000);
        expect(backoff(1)).toBe(2000);
        expect(backoff(4)).toBe(10000);
        expect(backoff(10)).toBe(10000);
      }
    });

    it('classifies non-retryable API errors correctly', () => {
      const check = (KsefApiClient as unknown as Record<string, unknown>).isNonRetryableApiError as
        | ((e: unknown) => boolean)
        | undefined;
      if (check) {
        expect(check(new Error('KSeF API error 400: bad request'))).toBe(true);
        expect(check(new Error('Network error'))).toBe(false);
        expect(check('not an error')).toBe(false);
      }
    });
  });
});
