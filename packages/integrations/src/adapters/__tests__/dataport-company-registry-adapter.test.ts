import { describe, expect, it, vi } from 'vitest';
import { DataportCompanyRegistryAdapter } from '../dataport-company-registry-adapter.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('DataportCompanyRegistryAdapter', () => {
  it('maps a successful response into a CompanyLookupResult', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        nip: '5260250995',
        regon: '012345678',
        legalName: 'Ministerstwo Finansów',
        address: {
          street: 'Świętokrzyska',
          buildingNumber: '12',
          city: 'Warszawa',
          postalCode: '00-916',
          country: 'PL',
        },
      }),
    );

    const adapter = new DataportCompanyRegistryAdapter({ fetcher, baseUrl: 'https://api.test' });
    const result = await adapter.lookupByNip({ nip: '5260250995' });

    expect(result).toEqual({
      found: true,
      legalName: 'Ministerstwo Finansów',
      regon: '012345678',
      addressLine1: 'Świętokrzyska 12',
      city: 'Warszawa',
      postalCode: '00-916',
      countryCode: 'PL',
      rawProvider: 'dataport',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.test/api/v1/company/5260250995',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns { found: false } on a 404 response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const adapter = new DataportCompanyRegistryAdapter({ fetcher });

    const result = await adapter.lookupByNip({ nip: '0000000000' });

    expect(result.found).toBe(false);
    expect(result.rawProvider).toBe('dataport');
  });

  it('throws on non-2xx, non-404 responses so the service layer can normalise', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('boom', { status: 500, statusText: 'Server Error' }));
    const adapter = new DataportCompanyRegistryAdapter({ fetcher });

    await expect(adapter.lookupByNip({ nip: '5260250995' })).rejects.toMatchObject({
      message: expect.stringContaining('Dataport HTTP 500'),
      status: 500,
    });
  });

  it('sends X-API-Key header only when an API key is configured', async () => {
    // Each call must produce a fresh Response — fetch bodies are single-use.
    const fetcher: typeof fetch = vi.fn(async () => jsonResponse({ name: 'X', regon: '1' }));
    const mock = vi.mocked(fetcher);

    await new DataportCompanyRegistryAdapter({ fetcher }).lookupByNip({ nip: '5260250995' });
    const noKeyHeaders = mock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(noKeyHeaders['X-API-Key']).toBeUndefined();

    mock.mockClear();
    await new DataportCompanyRegistryAdapter({ fetcher, apiKey: 'sk-test' }).lookupByNip({
      nip: '5260250995',
    });
    const withKeyHeaders = mock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(withKeyHeaders['X-API-Key']).toBe('sk-test');
  });

  it('aborts the request when the per-call timeout elapses', async () => {
    const fetcher = vi.fn(
      (_url, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const adapter = new DataportCompanyRegistryAdapter({ fetcher, timeoutMs: 5 });

    await expect(adapter.lookupByNip({ nip: '5260250995' })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
