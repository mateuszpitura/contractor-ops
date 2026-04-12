import { describe, expect, it } from 'vitest';
import {
  isValidCompaniesHouseNumber,
  isValidGbVat,
  isValidUtr,
} from '../uk-validators.js';

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

// ---------------------------------------------------------------------------
// isValidGbVat
// ---------------------------------------------------------------------------
//
// UK VAT algorithm reference:
//   weights = [8, 7, 6, 5, 4, 3, 2] applied to digits 1..7 of the 9-digit body
//   mod-97    check = (97 - weighted % 97) % 97                (pre-2010)
//   mod-9755  check = (97 - (weighted + 55) % 97) % 97         (post-2010)
//   Both variants coexist in circulation → both must be accepted.
//   12-digit form: body + 3-digit branch id (branch not checksummed)
//   GBGD{500..999} = government department, accepted without checksum
//   GBHA{000..499} = health authority, accepted without checksum
// ---------------------------------------------------------------------------

describe('isValidGbVat', () => {
  describe('standard mod-97 (pre-2010) vectors', () => {
    // body=[1,0,0,0,0,0,0], weighted = 1*8 = 8
    // check_mod97 = (97 - 8 % 97) % 97 = 89 → "GB100000089"
    it('accepts GB100000089 (derived mod-97 vector)', () => {
      expect(isValidGbVat('GB100000089')).toBe(true);
    });

    // body=[1,2,3,4,5,6,7]
    // weighted = 1*8+2*7+3*6+4*5+5*4+6*3+7*2
    //          = 8+14+18+20+20+18+14 = 112
    // check_mod97 = (97 - 112%97) % 97 = (97 - 15) % 97 = 82 → "GB123456782"
    it('accepts GB123456782 (derived mod-97 vector)', () => {
      expect(isValidGbVat('GB123456782')).toBe(true);
    });

    // body=[9,9,9,9,9,9,9]
    // weighted = 9 * (8+7+6+5+4+3+2) = 9 * 35 = 315
    // check_mod97 = (97 - 315%97) % 97 = (97 - 24) % 97 = 73 → "GB999999973"
    it('accepts GB999999973 (derived mod-97 vector)', () => {
      expect(isValidGbVat('GB999999973')).toBe(true);
    });
  });

  describe('mod-9755 (post-2010) vectors', () => {
    // body=[1,0,0,0,0,0,0], weighted = 8
    // check_mod9755 = (97 - (8 + 55) % 97) % 97 = (97 - 63) % 97 = 34
    // → "GB100000034"
    it('accepts GB100000034 (derived mod-9755 vector)', () => {
      expect(isValidGbVat('GB100000034')).toBe(true);
    });

    // body=[1,2,3,4,5,6,7], weighted = 112
    // check_mod9755 = (97 - (112 + 55) % 97) % 97 = (97 - 70) % 97 = 27
    // → "GB123456727"
    it('accepts GB123456727 (derived mod-9755 vector)', () => {
      expect(isValidGbVat('GB123456727')).toBe(true);
    });

    // body=[0,0,0,0,0,0,0], weighted = 0
    // check_mod9755 = (97 - 55 % 97) % 97 = (97 - 55) % 97 = 42
    // → "GB000000042"
    it('accepts GB000000042 (derived mod-9755 vector, all-zero body)', () => {
      expect(isValidGbVat('GB000000042')).toBe(true);
    });
  });

  describe('12-digit branch-trader variant', () => {
    it('accepts GB100000089001 (valid 9-digit body + branch 001)', () => {
      expect(isValidGbVat('GB100000089001')).toBe(true);
    });

    it('accepts GB123456782999 (valid body + arbitrary branch)', () => {
      expect(isValidGbVat('GB123456782999')).toBe(true);
    });

    it('rejects GB999999999999 (invalid 9-digit body, ignoring branch)', () => {
      expect(isValidGbVat('GB999999999999')).toBe(false);
    });
  });

  describe('GBGD (government department) accept-list', () => {
    it('accepts GBGD500 (boundary: first allowed)', () => {
      expect(isValidGbVat('GBGD500')).toBe(true);
    });

    it('accepts GBGD999 (boundary: last allowed)', () => {
      expect(isValidGbVat('GBGD999')).toBe(true);
    });

    it('rejects GBGD499 (below documented range)', () => {
      expect(isValidGbVat('GBGD499')).toBe(false);
    });

    it('rejects GBGD1000 (wrong length)', () => {
      expect(isValidGbVat('GBGD1000')).toBe(false);
    });
  });

  describe('GBHA (health authority) accept-list', () => {
    it('accepts GBHA000 (boundary: first allowed)', () => {
      expect(isValidGbVat('GBHA000')).toBe(true);
    });

    it('accepts GBHA499 (boundary: last allowed)', () => {
      expect(isValidGbVat('GBHA499')).toBe(true);
    });

    it('rejects GBHA500 (above documented range)', () => {
      expect(isValidGbVat('GBHA500')).toBe(false);
    });

    it('rejects GBHA999 (above documented range)', () => {
      expect(isValidGbVat('GBHA999')).toBe(false);
    });
  });

  describe('invalid VAT numbers', () => {
    it('rejects GB123456789 (arbitrary digits, neither checksum matches)', () => {
      // body=[1,2,3,4,5,6,7], check=89; expected mod97=82, mod9755=27 → fail
      expect(isValidGbVat('GB123456789')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidGbVat('')).toBe(false);
    });

    it('rejects GB with too few digits', () => {
      expect(isValidGbVat('GB12345678')).toBe(false);
    });

    it('rejects GB with 11 digits (not 9 or 12)', () => {
      expect(isValidGbVat('GB12345678901')).toBe(false);
    });

    it('rejects non-GB prefix', () => {
      expect(isValidGbVat('FR123456789')).toBe(false);
      expect(isValidGbVat('ABGD500')).toBe(false);
    });
  });

  describe('input normalization', () => {
    it('accepts lowercase prefix (upcases internally)', () => {
      expect(isValidGbVat('gb100000089')).toBe(true);
    });

    it('strips whitespace', () => {
      expect(isValidGbVat('GB 100 000 089')).toBe(true);
    });

    it('strips hyphens', () => {
      expect(isValidGbVat('GB-100-000-089')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// isValidCompaniesHouseNumber
// ---------------------------------------------------------------------------
//
// Companies House number format (6 regional prefix variants + plain digits):
//   - 1..8 digits       England / Wales (padded to 8 internally by CH registry)
//   - SC + 6 digits     Scotland
//   - NI + 6 digits     Northern Ireland
//   - OC + 6 digits     LLP (England / Wales)
//   - SO + 6 digits     LLP (Scotland)
//   - NC + 6 digits     LLP (Northern Ireland)
//   - R0 + 6 digits     Historic (pre-2009) registrations
// ---------------------------------------------------------------------------

describe('isValidCompaniesHouseNumber', () => {
  describe('England/Wales digit-only numbers', () => {
    it('accepts 00000006 (Tesco PLC actual registration number)', () => {
      expect(isValidCompaniesHouseNumber('00000006')).toBe(true);
    });

    it('accepts 12345678 (8-digit)', () => {
      expect(isValidCompaniesHouseNumber('12345678')).toBe(true);
    });

    it('accepts 6 (1-digit — CH accepts, pads internally)', () => {
      expect(isValidCompaniesHouseNumber('6')).toBe(true);
    });

    it('accepts 1234 (4-digit)', () => {
      expect(isValidCompaniesHouseNumber('1234')).toBe(true);
    });

    it('rejects 123456789 (9 digits — too many)', () => {
      expect(isValidCompaniesHouseNumber('123456789')).toBe(false);
    });
  });

  describe('regional / LLP prefix variants', () => {
    it('accepts SC123456 (Scotland)', () => {
      expect(isValidCompaniesHouseNumber('SC123456')).toBe(true);
    });

    it('accepts NI123456 (Northern Ireland)', () => {
      expect(isValidCompaniesHouseNumber('NI123456')).toBe(true);
    });

    it('accepts OC123456 (LLP England/Wales)', () => {
      expect(isValidCompaniesHouseNumber('OC123456')).toBe(true);
    });

    it('accepts SO123456 (LLP Scotland)', () => {
      expect(isValidCompaniesHouseNumber('SO123456')).toBe(true);
    });

    it('accepts NC123456 (LLP Northern Ireland)', () => {
      expect(isValidCompaniesHouseNumber('NC123456')).toBe(true);
    });

    it('accepts R0123456 (historic pre-2009 registration)', () => {
      expect(isValidCompaniesHouseNumber('R0123456')).toBe(true);
    });

    it('normalizes lowercase prefix', () => {
      expect(isValidCompaniesHouseNumber('sc123456')).toBe(true);
    });
  });

  describe('invalid numbers', () => {
    it('rejects unknown prefix AB', () => {
      expect(isValidCompaniesHouseNumber('AB123456')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidCompaniesHouseNumber('')).toBe(false);
    });

    it('rejects prefix with wrong digit length', () => {
      expect(isValidCompaniesHouseNumber('SC12345')).toBe(false);
      expect(isValidCompaniesHouseNumber('SC1234567')).toBe(false);
    });

    it('rejects non-alphanumeric junk', () => {
      expect(isValidCompaniesHouseNumber('!!!!!!!!')).toBe(false);
    });
  });
});
