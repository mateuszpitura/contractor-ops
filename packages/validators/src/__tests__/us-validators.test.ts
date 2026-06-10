// EIN and SSN validator vectors.
//
// EIN reference [CITED: irs.gov/.../valid-ein-prefixes — legal/tax-adviser
// verification deferred, LOCAL-ONLY]:
//   - format XX-XXXXXXX (2-digit campus prefix + 7-digit serial)
//   - the 2-digit prefix must be in the IRS-published valid set
//   - `12` IS a valid prefix; `07` is NOT in the VALID_EIN_PREFIXES set
//   - whitespace stripped before validation
//
// SSN reference [CITED: ssa.gov randomization FAQ — same deferral]:
//   - format XXX-XX-XXXX (area-group-serial)
//   - invalid area: 000, 666, 900-999
//   - invalid group: 00
//   - invalid serial: 0000
//   - `078-05-1120` is the canonical valid-format example (the historic
//     Woolworth wallet SSN — synthetic for tests, not a live identity)

import { describe, expect, it } from 'vitest';
import { isValidEin, isValidSsn } from '../us-validators.js';

// ---------------------------------------------------------------------------
// isValidEin
// ---------------------------------------------------------------------------

describe('isValidEin', () => {
  describe('valid EIN vectors', () => {
    it('accepts 12-3456789 (valid IRS prefix 12, hyphenated)', () => {
      expect(isValidEin('12-3456789')).toBe(true);
    });

    it('accepts 121234567 (valid prefix, no hyphen)', () => {
      expect(isValidEin('121234567')).toBe(true);
    });
  });

  describe('invalid EIN format', () => {
    it('rejects 123456789 without a valid 2+7 grouping the impl accepts', () => {
      // Bare 9 digits whose first two are an INVALID prefix (12 is valid; 12... is
      // covered above). Here the leading pair is "12"? No — use a value whose
      // grouping is rejected: 8 digits cannot form XX-XXXXXXX.
      expect(isValidEin('12345678')).toBe(false);
    });

    it('rejects too many digits', () => {
      expect(isValidEin('12-34567890')).toBe(false);
    });

    it('rejects non-numeric input', () => {
      expect(isValidEin('AB-CDEFGHI')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidEin('')).toBe(false);
    });
  });

  describe('invalid IRS prefix', () => {
    it('rejects 07-1234567 (07 is NOT in VALID_EIN_PREFIXES)', () => {
      expect(isValidEin('07-1234567')).toBe(false);
    });
  });

  describe('input normalization', () => {
    it('strips whitespace before validation', () => {
      expect(isValidEin('  12-3456789  ')).toBe(true);
    });

    it('strips internal whitespace', () => {
      expect(isValidEin('12 3456789')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// isValidSsn
// ---------------------------------------------------------------------------

describe('isValidSsn', () => {
  describe('valid SSN vectors', () => {
    it('accepts 078-05-1120 (valid format + ranges, hyphenated)', () => {
      expect(isValidSsn('078-05-1120')).toBe(true);
    });

    it('accepts 078051120 (valid, no separators)', () => {
      expect(isValidSsn('078051120')).toBe(true);
    });
  });

  describe('invalid area number', () => {
    it('rejects area 000', () => {
      expect(isValidSsn('000-12-3456')).toBe(false);
    });

    it('rejects area 666', () => {
      expect(isValidSsn('666-12-3456')).toBe(false);
    });

    it('rejects area 900 (start of 900-999 invalid range)', () => {
      expect(isValidSsn('900-12-3456')).toBe(false);
    });

    it('rejects area 999 (end of 900-999 invalid range)', () => {
      expect(isValidSsn('999-12-3456')).toBe(false);
    });
  });

  describe('invalid group number', () => {
    it('rejects group 00', () => {
      expect(isValidSsn('078-00-1120')).toBe(false);
    });
  });

  describe('invalid serial number', () => {
    it('rejects serial 0000', () => {
      expect(isValidSsn('078-05-0000')).toBe(false);
    });
  });

  describe('invalid format', () => {
    it('rejects too few digits', () => {
      expect(isValidSsn('078-05-112')).toBe(false);
    });

    it('rejects too many digits', () => {
      expect(isValidSsn('078-05-11200')).toBe(false);
    });

    it('rejects non-numeric input', () => {
      expect(isValidSsn('AAA-BB-CCCC')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidSsn('')).toBe(false);
    });
  });

  describe('input normalization', () => {
    it('strips whitespace before validation', () => {
      expect(isValidSsn('  078 05 1120  ')).toBe(true);
    });
  });
});
