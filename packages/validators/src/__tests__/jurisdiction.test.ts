import { describe, expect, it } from 'vitest';
import type { SupportedJurisdiction } from '../privacy-notices/jurisdiction.js';
import { resolveJurisdiction } from '../privacy-notices/jurisdiction.js';

describe('resolveJurisdiction', () => {
  describe('direct mappings', () => {
    it.each([
      ['AE', 'AE'],
      ['SA', 'SA'],
      ['GB', 'GB'],
      ['DE', 'DE'],
    ] as const)('maps %s to %s', (input, expected) => {
      expect(resolveJurisdiction(input)).toBe(expected);
    });
  });

  describe('case insensitivity', () => {
    it.each([
      ['ae', 'AE'],
      ['sa', 'SA'],
      ['gb', 'GB'],
      ['de', 'DE'],
      ['Ae', 'AE'],
      ['Gb', 'GB'],
    ] as const)('maps %s to %s', (input, expected) => {
      expect(resolveJurisdiction(input)).toBe(expected);
    });
  });

  describe('fallback to EU', () => {
    it('returns EU for null', () => {
      expect(resolveJurisdiction(null)).toBe('EU');
    });

    it('returns EU for undefined', () => {
      expect(resolveJurisdiction(undefined)).toBe('EU');
    });

    it('returns EU for empty string', () => {
      expect(resolveJurisdiction('')).toBe('EU');
    });

    it.each([
      'US',
      'FR',
      'PL',
      'JP',
      'BR',
      'XX',
      'EU',
    ])('returns EU for unsupported country %s', code => {
      expect(resolveJurisdiction(code)).toBe('EU');
    });
  });

  describe('return type', () => {
    it('return value satisfies SupportedJurisdiction', () => {
      const result: SupportedJurisdiction = resolveJurisdiction('GB');
      expect(result).toBe('GB');
    });

    it('fallback satisfies SupportedJurisdiction', () => {
      const result: SupportedJurisdiction = resolveJurisdiction('ZZ');
      expect(result).toBe('EU');
    });
  });
});
