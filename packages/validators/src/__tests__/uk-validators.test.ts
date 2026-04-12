import { describe, expect, it } from 'vitest';
import { isValidUtr } from '../uk-validators.js';

// ---------------------------------------------------------------------------
// isValidUtr
// ---------------------------------------------------------------------------
//
// HMRC mod-11 algorithm reference:
//   weights = [6, 7, 8, 9, 10, 5, 4, 3, 2] applied to digits 2..10 (body)
//   checkDigit = CHECK_LOOKUP[weightedSum % 11]
//   CHECK_LOOKUP = [2, 1, 9, 8, 7, 6, 5, 4, 3, 2, 1]
//   UTR = <checkDigit><9-digit body>
//
// All valid vectors below were derived programmatically and cross-checked
// against the algorithm. Derivation format: body → weighted sum → remainder
// → lookup → check digit.
// ---------------------------------------------------------------------------

describe('isValidUtr', () => {
  describe('valid UTR vectors', () => {
    // body=[0,9,7,1,7,2,5,6,1]
    // weighted = 0*6+9*7+7*8+1*9+7*10+2*5+5*4+6*3+1*2
    //          = 0+63+56+9+70+10+20+18+2 = 248
    // 248 % 11 = 6, CHECK_LOOKUP[6] = 5 → UTR = "5097172561"
    it('accepts 5097172561 (derived vector)', () => {
      expect(isValidUtr('5097172561')).toBe(true);
    });

    // body=[1,2,3,4,5,6,7,8,9]
    // weighted = 1*6+2*7+3*8+4*9+5*10+6*5+7*4+8*3+9*2
    //          = 6+14+24+36+50+30+28+24+18 = 230
    // 230 % 11 = 10, CHECK_LOOKUP[10] = 1 → UTR = "1123456789"
    it('accepts 1123456789 (derived vector)', () => {
      expect(isValidUtr('1123456789')).toBe(true);
    });

    // body=[2,3,4,5,6,7,8,9,0]
    // weighted = 2*6+3*7+4*8+5*9+6*10+7*5+8*4+9*3+0*2
    //          = 12+21+32+45+60+35+32+27+0 = 264
    // 264 % 11 = 0, CHECK_LOOKUP[0] = 2 → UTR = "2234567890"
    it('accepts 2234567890 (derived vector)', () => {
      expect(isValidUtr('2234567890')).toBe(true);
    });

    // body=[9,8,7,6,5,4,3,2,1]
    // weighted = 9*6+8*7+7*8+6*9+5*10+4*5+3*4+2*3+1*2
    //          = 54+56+56+54+50+20+12+6+2 = 310
    // 310 % 11 = 2, CHECK_LOOKUP[2] = 9 → UTR = "9987654321"
    it('accepts 9987654321 (derived vector)', () => {
      expect(isValidUtr('9987654321')).toBe(true);
    });

    // body=[0,0,0,0,0,0,0,0,1]
    // weighted = 0+0+0+0+0+0+0+0+1*2 = 2
    // 2 % 11 = 2, CHECK_LOOKUP[2] = 9 → UTR = "9000000001"
    it('accepts 9000000001 (derived vector)', () => {
      expect(isValidUtr('9000000001')).toBe(true);
    });
  });

  describe('invalid UTRs', () => {
    it('rejects all-zero UTR', () => {
      // body all zeros → weighted sum 0 → lookup[0] = 2; only "2000000000"
      // would be valid. "0000000000" has check digit 0, not 2.
      expect(isValidUtr('0000000000')).toBe(false);
    });

    it('rejects UTR with wrong check digit', () => {
      // 1097172561 has body=[0,9,7,1,7,2,5,6,1] sum=248 rem=6 expected=5,
      // but supplied check digit is 1 → invalid.
      expect(isValidUtr('1097172561')).toBe(false);
    });

    it('rejects non-numeric input', () => {
      expect(isValidUtr('abcdefghij')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidUtr('')).toBe(false);
    });

    it('rejects wrong length (too short)', () => {
      expect(isValidUtr('123')).toBe(false);
    });

    it('rejects wrong length (too long)', () => {
      expect(isValidUtr('12345678901234')).toBe(false);
    });
  });

  describe('input normalization', () => {
    it('strips whitespace before validation', () => {
      // "5097172561" is valid — with spaces must still validate
      expect(isValidUtr('50 97 17 25 61')).toBe(true);
    });

    it('strips hyphens before validation', () => {
      expect(isValidUtr('5097-172-561')).toBe(true);
    });

    it('strips trailing K suffix (Corporation Tax variant)', () => {
      expect(isValidUtr('5097172561K')).toBe(true);
    });

    it('strips trailing k (lowercase) suffix', () => {
      expect(isValidUtr('5097172561k')).toBe(true);
    });

    it('handles whitespace + K suffix together', () => {
      expect(isValidUtr('  5097172561K  ')).toBe(true);
    });
  });
});
