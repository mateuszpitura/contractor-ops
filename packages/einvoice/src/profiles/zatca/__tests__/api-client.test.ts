import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('ZatcaApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submitForClearance POSTs to /invoices/clearance/single', async () => {
    const { ZatcaApiClient } = await import('../api-client.js');

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          clearanceStatus: 'CLEARED',
          validationResults: { status: 'PASS', warningMessages: [], errorMessages: [] },
        }),
    });

    const client = new ZatcaApiClient({
      baseUrl: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
      binarySecurityToken: 'test-token',
      secret: 'test-secret',
    });

    await client.submitForClearance({
      invoiceHash: 'abc123',
      uuid: 'uuid-v4',
      invoice: 'PGludm9pY2U+', // base64
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/invoices/clearance/single'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('submitForReporting POSTs to /invoices/reporting/single', async () => {
    const { ZatcaApiClient } = await import('../api-client.js');

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          reportingStatus: 'REPORTED',
          validationResults: { status: 'PASS', warningMessages: [], errorMessages: [] },
        }),
    });

    const client = new ZatcaApiClient({
      baseUrl: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
      binarySecurityToken: 'test-token',
      secret: 'test-secret',
    });

    await client.submitForReporting({
      invoiceHash: 'abc123',
      uuid: 'uuid-v4',
      invoice: 'PGludm9pY2U+',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/invoices/reporting/single'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses Base64 {token}:{secret} for Authorization header', async () => {
    const { ZatcaApiClient } = await import('../api-client.js');

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ reportingStatus: 'REPORTED', validationResults: {} }),
    });

    const client = new ZatcaApiClient({
      baseUrl: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
      binarySecurityToken: 'mytoken',
      secret: 'mysecret',
    });

    await client.submitForReporting({
      invoiceHash: 'hash',
      uuid: 'uuid',
      invoice: 'base64xml',
    });

    const expectedAuth = `Basic ${Buffer.from('mytoken:mysecret').toString('base64')}`;
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    const h = opts.headers;
    const auth =
      h instanceof Headers ? h.get('Authorization') : (h as Record<string, string>).Authorization;
    expect(auth).toBe(expectedAuth);
  });
});
