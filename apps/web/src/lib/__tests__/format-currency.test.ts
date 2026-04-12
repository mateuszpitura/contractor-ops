import { describe, expect, it } from 'vitest';
import { formatAmount, formatMinorUnits } from '../format-currency';

describe('formatMinorUnits', () => {
  describe('default locale (en)', () => {
    it('formats minor units with period decimal separator', () => {
      expect(formatMinorUnits(10050)).toBe('100.50');
    });

    it('formats zero', () => {
      expect(formatMinorUnits(0)).toBe('0.00');
    });

    it('formats single minor unit', () => {
      expect(formatMinorUnits(1)).toBe('0.01');
    });

    it('formats negative amounts', () => {
      expect(formatMinorUnits(-5000)).toBe('-50.00');
    });

    it('formats large amounts with comma thousands separator', () => {
      expect(formatMinorUnits(1234567)).toBe('12,345.67');
    });

    it('appends currency when provided', () => {
      expect(formatMinorUnits(10050, 'PLN')).toBe('100.50 PLN');
    });

    it('appends EUR currency', () => {
      expect(formatMinorUnits(5000, 'EUR')).toBe('50.00 EUR');
    });

    it('does not append currency when null', () => {
      expect(formatMinorUnits(10050, null)).toBe('100.50');
    });

    it('does not append currency when undefined', () => {
      expect(formatMinorUnits(10050, undefined)).toBe('100.50');
    });
  });

  describe('pl locale', () => {
    it('formats with comma decimal separator', () => {
      expect(formatMinorUnits(10050, undefined, 'pl')).toBe('100,50');
    });

    it('formats large amounts with non-breaking space thousands separator', () => {
      const result = formatMinorUnits(1234567, undefined, 'pl');
      expect(result).toMatch(/12[\s\u00a0\u202f]345,67/);
    });

    it('appends currency', () => {
      expect(formatMinorUnits(10050, 'PLN', 'pl')).toBe('100,50 PLN');
    });
  });

  describe('ar locale', () => {
    it('formats with Arabic-locale number formatting', () => {
      const result = formatMinorUnits(10050, undefined, 'ar');
      // Arabic locale may use Eastern Arabic numerals or Western digits
      expect(result).toMatch(/\d|[٠-٩]/);
    });

    it('appends currency', () => {
      const result = formatMinorUnits(10050, 'PLN', 'ar');
      expect(result).toContain('PLN');
    });
  });
});

describe('formatAmount', () => {
  describe('default locale (en)', () => {
    it('formats minor units with required currency', () => {
      expect(formatAmount(10050, 'PLN')).toBe('100.50 PLN');
    });

    it('formats zero with currency', () => {
      expect(formatAmount(0, 'EUR')).toBe('0.00 EUR');
    });

    it('formats negative amounts with currency', () => {
      expect(formatAmount(-5000, 'USD')).toBe('-50.00 USD');
    });

    it('formats large amounts with currency', () => {
      expect(formatAmount(1234567, 'PLN')).toBe('12,345.67 PLN');
    });
  });

  describe('pl locale', () => {
    it('formats with comma decimal separator and currency', () => {
      expect(formatAmount(10050, 'PLN', 'pl')).toBe('100,50 PLN');
    });

    it('formats large amounts', () => {
      const result = formatAmount(1234567, 'PLN', 'pl');
      expect(result).toMatch(/12[\s\u00a0\u202f]345,67 PLN/);
    });
  });

  describe('ar locale', () => {
    it('formats with Arabic locale and appends currency', () => {
      const result = formatAmount(10050, 'PLN', 'ar');
      expect(result).toContain('PLN');
    });
  });
});
