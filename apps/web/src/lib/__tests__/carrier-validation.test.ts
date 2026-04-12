import { describe, expect, it } from 'vitest';
import { isCarrierFormValid } from '../carrier-validation';

describe('isCarrierFormValid', () => {
  it('returns false when carrier is empty', () => {
    expect(isCarrierFormValid('', {})).toBe(false);
  });

  it('returns false for unknown carrier', () => {
    expect(isCarrierFormValid('fedex', {})).toBe(false);
  });

  // InPost
  describe('inpost', () => {
    it('returns true when selectedPoint is set', () => {
      expect(isCarrierFormValid('inpost', { selectedPoint: { id: 'ABC123' } })).toBe(true);
    });

    it('returns false when selectedPoint is null', () => {
      expect(isCarrierFormValid('inpost', { selectedPoint: null })).toBe(false);
    });

    it('returns false when selectedPoint is missing', () => {
      expect(isCarrierFormValid('inpost', {})).toBe(false);
    });
  });

  // DPD
  describe('dpd', () => {
    const validAddress = {
      street: 'Marszalkowska 1',
      city: 'Warszawa',
      postalCode: '00-001',
    };

    it('returns true when all address fields are filled', () => {
      expect(isCarrierFormValid('dpd', { address: validAddress })).toBe(true);
    });

    it('returns false when street is empty', () => {
      expect(
        isCarrierFormValid('dpd', {
          address: { ...validAddress, street: '' },
        }),
      ).toBe(false);
    });

    it('returns false when city is whitespace-only', () => {
      expect(
        isCarrierFormValid('dpd', {
          address: { ...validAddress, city: '   ' },
        }),
      ).toBe(false);
    });

    it('returns false when postalCode is empty', () => {
      expect(
        isCarrierFormValid('dpd', {
          address: { ...validAddress, postalCode: '' },
        }),
      ).toBe(false);
    });

    it('returns false when address is missing', () => {
      expect(isCarrierFormValid('dpd', {})).toBe(false);
    });
  });

  // UPS
  describe('ups', () => {
    const validAddress = {
      street: 'Marszalkowska 1',
      city: 'Warszawa',
      postalCode: '00-001',
    };

    it('returns true when address and serviceCode are provided', () => {
      expect(
        isCarrierFormValid('ups', {
          address: validAddress,
          serviceCode: '11',
        }),
      ).toBe(true);
    });

    it('returns false when serviceCode is missing', () => {
      expect(isCarrierFormValid('ups', { address: validAddress })).toBe(false);
    });

    it('returns false when address is incomplete', () => {
      expect(
        isCarrierFormValid('ups', {
          address: { ...validAddress, street: '' },
          serviceCode: '11',
        }),
      ).toBe(false);
    });

    it('returns false when address is missing', () => {
      expect(isCarrierFormValid('ups', { serviceCode: '11' })).toBe(false);
    });
  });
});
