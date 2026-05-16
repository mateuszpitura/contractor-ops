import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { DataportCompanyRegistryAdapter } from '../dataport-company-registry-adapter.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['dataport']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DataportCompanyRegistryAdapter MSW integration', () => {
  it('lookupByNip() returns the mapped happy-path fixture', async () => {
    const adapter = new DataportCompanyRegistryAdapter();

    const result = await adapter.lookupByNip({ nip: '5260250995' });

    expect(result.found).toBe(true);
    expect(result.legalName).toBe('Ministerstwo Finansów');
    expect(result.regon).toBe('012345678');
    expect(result.city).toBe('Warszawa');
    expect(result.postalCode).toBe('00-916');
    expect(result.addressLine1).toBe('Świętokrzyska 12');
    expect(result.countryCode).toBe('PL');
    expect(result.rawProvider).toBe('dataport');
  });
});
