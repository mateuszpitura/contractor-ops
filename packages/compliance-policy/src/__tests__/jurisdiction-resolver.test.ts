import { describe, expect, it } from 'vitest';

import { mapCountryCodeToJurisdiction, mapIsoToJurisdiction } from '../jurisdiction-resolver.js';

describe('jurisdiction-resolver', () => {
  it('maps alpha-2 country codes', () => {
    expect(mapCountryCodeToJurisdiction('GB')).toBe('UK');
    expect(mapCountryCodeToJurisdiction('DE')).toBe('DE');
  });

  it('maps alpha-3 ISO codes', () => {
    expect(mapIsoToJurisdiction('DEU')).toBe('DE');
    expect(mapIsoToJurisdiction('GBR')).toBe('UK');
  });

  it('returns null for unknown codes', () => {
    expect(mapIsoToJurisdiction('ZZ')).toBeNull();
  });
});
