import { describe, expect, it } from 'vitest';

import {
  clearTaxIdValidators,
  getTaxIdValidator,
  registerTaxIdValidator,
} from '../registry.js';

describe('tax-id-validator registry', () => {
  it('registers built-in GB_VAT and DE_USTIDNR validators', () => {
    expect(getTaxIdValidator('GB_VAT')).toBeDefined();
    expect(getTaxIdValidator('DE_USTIDNR')).toBeDefined();
  });

  it('runPreflight rejects malformed GB VAT', () => {
    const validator = getTaxIdValidator('GB_VAT');
    expect(validator?.runPreflight('not-a-vat')).toBe(false);
  });

  it('allows custom validator registration in tests', () => {
    clearTaxIdValidators();
    registerTaxIdValidator({
      taxIdType: 'GB_VAT',
      runPreflight: () => true,
      validate: async () => ({
        apiProvider: 'test',
        responseStatus: 'VALID',
        confirmationRef: 'ref',
        responseBody: {},
      }),
    });
    expect(getTaxIdValidator('GB_VAT')?.runPreflight('x')).toBe(true);
  });
});
