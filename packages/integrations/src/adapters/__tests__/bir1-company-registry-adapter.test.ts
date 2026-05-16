import { describe, expect, it, vi } from 'vitest';
import { Bir1CompanyRegistryAdapter } from '../bir1-company-registry-adapter.js';

interface FakeBirClient {
  login: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
}

function makeFakeClient(searchResult: unknown, opts: { searchThrows?: Error } = {}): FakeBirClient {
  return {
    login: vi.fn().mockResolvedValue(undefined),
    search: opts.searchThrows
      ? vi.fn().mockRejectedValue(opts.searchThrows)
      : vi.fn().mockResolvedValue(searchResult),
    logout: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Bir1CompanyRegistryAdapter', () => {
  it('maps a single-entity bir1 response into a CompanyLookupResult', async () => {
    const client = makeFakeClient({
      Nazwa: 'Acme Sp. z o.o.',
      Regon: '012345678',
      Ulica: 'Świętokrzyska',
      NrNieruchomosci: '12',
      NrLokalu: '4',
      Miejscowosc: 'Warszawa',
      KodPocztowy: '00-916',
    });

    const adapter = new Bir1CompanyRegistryAdapter({
      clientFactory: async () => client as never,
    });
    const result = await adapter.lookupByNip({ nip: '5260250995' });

    expect(result).toEqual({
      found: true,
      legalName: 'Acme Sp. z o.o.',
      regon: '012345678',
      addressLine1: 'Świętokrzyska 12/4',
      city: 'Warszawa',
      postalCode: '00-916',
      countryCode: 'PL',
      rawProvider: 'bir1',
    });
    expect(client.login).toHaveBeenCalledTimes(1);
    expect(client.search).toHaveBeenCalledWith({ nip: '5260250995' });
    expect(client.logout).toHaveBeenCalledTimes(1);
  });

  it('unwraps array-shape bir1 responses to the first entity', async () => {
    const client = makeFakeClient([
      { Nazwa: 'First', Regon: '111' },
      { Nazwa: 'Second', Regon: '222' },
    ]);

    const adapter = new Bir1CompanyRegistryAdapter({
      clientFactory: async () => client as never,
    });
    const result = await adapter.lookupByNip({ nip: '5260250995' });

    expect(result.found).toBe(true);
    expect(result.legalName).toBe('First');
    expect(result.regon).toBe('111');
  });

  it('returns { found: false } when bir1 returns null', async () => {
    const client = makeFakeClient(null);
    const adapter = new Bir1CompanyRegistryAdapter({
      clientFactory: async () => client as never,
    });

    const result = await adapter.lookupByNip({ nip: '0000000000' });

    expect(result.found).toBe(false);
    expect(result.rawProvider).toBe('bir1');
    expect(client.logout).toHaveBeenCalledTimes(1);
  });

  it('always logs out, even when search throws', async () => {
    const boom = new Error('soap fault');
    const client = makeFakeClient(null, { searchThrows: boom });
    const adapter = new Bir1CompanyRegistryAdapter({
      clientFactory: async () => client as never,
    });

    await expect(adapter.lookupByNip({ nip: '5260250995' })).rejects.toThrow(boom);
    expect(client.logout).toHaveBeenCalledTimes(1);
  });
});
