// VIES Zod schema tests.

import { describe, expect, it } from 'vitest';

import { viesLookupResponseSchema } from '../vies.schema.js';

describe('viesLookupResponseSchema', () => {
  it('parses a simple valid response (isValid=true, no requestIdentifier)', () => {
    const parsed = viesLookupResponseSchema.parse({
      countryCode: 'DE',
      vatNumber: '123456789',
      requestDate: '2026-04-12',
      isValid: true,
      name: 'Test GmbH',
      address: 'Hauptstraße 1, 10115 Berlin',
    });
    expect(parsed.isValid).toBe(true);
    expect(parsed.requestIdentifier).toBeUndefined();
  });

  it('parses a qualified confirmation with requestIdentifier + traderXxxMatch', () => {
    const parsed = viesLookupResponseSchema.parse({
      countryCode: 'DE',
      vatNumber: '123456789',
      requestDate: '2026-04-12',
      isValid: true,
      name: 'Test GmbH',
      address: 'Hauptstraße 1, 10115 Berlin',
      requestIdentifier: 'WAPIAAAAXEZNM9VJ',
      traderName: 'Test GmbH',
      traderStreetMatch: '1',
      traderPostcodeMatch: '1',
      traderCityMatch: '1',
    });
    expect(parsed.requestIdentifier).toBe('WAPIAAAAXEZNM9VJ');
    expect(parsed.traderNameMatch).toBeUndefined();
  });

  it('parses a userError=MS_UNAVAILABLE branch (no isValid)', () => {
    const parsed = viesLookupResponseSchema.parse({
      countryCode: 'DE',
      vatNumber: '123456789',
      userError: 'MS_UNAVAILABLE',
    });
    expect(parsed.userError).toBe('MS_UNAVAILABLE');
    expect(parsed.isValid).toBeUndefined();
  });

  it('rejects a body missing BOTH isValid AND userError (schema refinement)', () => {
    expect(() =>
      viesLookupResponseSchema.parse({
        countryCode: 'DE',
        vatNumber: '123456789',
      }),
    ).toThrow(/either isValid or userError/);
  });

  it('rejects malformed userError value', () => {
    expect(() =>
      viesLookupResponseSchema.parse({
        countryCode: 'DE',
        vatNumber: '123456789',
        userError: 'TOTALLY_UNKNOWN_ERROR',
      }),
    ).toThrow();
  });
});
