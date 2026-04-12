// Phase 56 · Plan 03 — German tax-ID validators (FOUND-02, D-03).
// See .planning/phases/56-country-foundations-german-i18n/56-03-PLAN.md.
//
// Implementation in packages/validators/src/de-validators.ts.
// Steuernummer/Handelsregister data (Plan 04) imported through that module.

import { describe, expect, it } from 'vitest';

import {
  isValidHandelsregister,
  isValidSteuernummer,
  isValidSvNummer,
  isValidUstIdNr,
  mod11_10CheckDigit,
} from '../de-validators.js';

// ---------------------------------------------------------------------------
// mod11_10CheckDigit — ISO 7064 MOD-11-10 Pure System
// ---------------------------------------------------------------------------

describe('mod11_10CheckDigit (FOUND-02, D-03)', () => {
  // Derived empirically from the iterative MOD-11-10 algorithm (plan specifies
  // the authoritative TypeScript implementation; these expectations pin it).
  // Reference: https://arthurdejong.org/python-stdnum/doc/1.17/stdnum.iso7064
  it('computes 6 for DE136695976 body [1,3,6,6,9,5,9,7]', () => {
    expect(mod11_10CheckDigit([1, 3, 6, 6, 9, 5, 9, 7])).toBe(6);
  });

  it('computes 9 for DE811569869 body [8,1,1,5,6,9,8,6]', () => {
    expect(mod11_10CheckDigit([8, 1, 1, 5, 6, 9, 8, 6])).toBe(9);
  });

  it('computes 8 for sequential body [1,2,3,4,5,6,7,8]', () => {
    // Plan-documented algorithm produces 8 for this body
    // (iterative MOD-11-10 Pure System with `product=10` seed).
    expect(mod11_10CheckDigit([1, 2, 3, 4, 5, 6, 7, 8])).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// isValidUstIdNr — DE + 9 digits, last is MOD-11-10 check
// ---------------------------------------------------------------------------

describe('isValidUstIdNr (FOUND-02, D-03)', () => {
  // Authoritative valid vectors — canonical python-stdnum reference + Siemens.
  it('accepts DE136695976 (python-stdnum canonical)', () => {
    expect(isValidUstIdNr('DE136695976')).toBe(true);
  });

  it('accepts DE811569869 (Siemens AG, publicly reported USt-IdNr)', () => {
    expect(isValidUstIdNr('DE811569869')).toBe(true);
  });

  it('accepts DE123456788 (computed check digit = 8 for body 12345678)', () => {
    // Plan verification: running `mod11_10CheckDigit([1..8])` under the
    // iterative algorithm returns 8, making DE123456788 internally consistent.
    expect(isValidUstIdNr('DE123456788')).toBe(true);
  });

  it('rejects DE123456789 (check digit 9 ≠ computed 8)', () => {
    expect(isValidUstIdNr('DE123456789')).toBe(false);
  });

  it('rejects FR12345678 (non-DE prefix)', () => {
    expect(isValidUstIdNr('FR12345678')).toBe(false);
  });

  it('rejects DE12345678 (only 8 digits after DE)', () => {
    expect(isValidUstIdNr('DE12345678')).toBe(false);
  });

  it('rejects DE1234567890 (10 digits after DE)', () => {
    expect(isValidUstIdNr('DE1234567890')).toBe(false);
  });

  it('rejects empty / garbage inputs', () => {
    expect(isValidUstIdNr('')).toBe(false);
    expect(isValidUstIdNr('DE')).toBe(false);
    expect(isValidUstIdNr('DEABCDEFGHI')).toBe(false);
  });

  it('strips whitespace/hyphens and uppercases (de-136 695 976 → DE136695976)', () => {
    expect(isValidUstIdNr('de-136 695 976')).toBe(true);
    expect(isValidUstIdNr('  DE136695976  ')).toBe(true);
    expect(isValidUstIdNr('DE-136-695-976')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidSvNummer — 12-char structural + weighted mod-10 checksum
// ---------------------------------------------------------------------------

describe('isValidSvNummer (FOUND-02, D-03)', () => {
  // Derived valid vectors with inline derivation (executor verified by hand).
  //
  // Vector 1: areaAndDob='65180539' (area 65, DOB 18-05-39), letter 'M' (13),
  //   serial='03'. Expanded digits = [6,5,1,8,0,5,3,9,1,3,0,3].
  //   Weights  = [2,1,2,5,7,1,2,1,2,1,2,1].
  //   Products = [12,5,2,40,0,5,6,9,2,3,0,3]
  //   digitSum = [ 3,5,2, 4,0,5,6,9,2,3,0,3] → sum=42 → 42%10 = 2 → check=2.
  //   Valid SV-Nummer: 65180539M032.
  it('accepts 65180539M032 (derived vector 1)', () => {
    expect(isValidSvNummer('65180539M032')).toBe(true);
  });

  // Vector 2: areaAndDob='01010100' (area 01, DOB 01-01-00), letter 'A' (1),
  //   serial='01'. Expanded = [0,1,0,1,0,1,0,0,0,1,0,1].
  //   Products = [0,1,0,5,0,1,0,0,0,1,0,1] → sum=9 → 9%10=9.
  //   Valid SV-Nummer: 01010100A019.
  it('accepts 01010100A019 (derived vector 2)', () => {
    expect(isValidSvNummer('01010100A019')).toBe(true);
  });

  // Vector 3: areaAndDob='55120180' (area 55, DOB 12-01-80), letter 'B' (2),
  //   serial='02'. Expanded = [5,5,1,2,0,1,8,0,0,2,0,2].
  //   Products = [10,5,2,10,0,1,16,0,0,2,0,2]
  //   digitSum = [ 1,5,2, 1,0,1, 7,0,0,2,0,2] → sum=21 → 21%10=1.
  //   Valid SV-Nummer: 55120180B021.
  it('accepts 55120180B021 (derived vector 3)', () => {
    expect(isValidSvNummer('55120180B021')).toBe(true);
  });

  it('accepts case-insensitive input (65180539m032 equivalent to uppercase)', () => {
    expect(isValidSvNummer('65180539m032')).toBe(true);
  });

  it('strips whitespace/hyphens before validation', () => {
    expect(isValidSvNummer('65180539-M-032')).toBe(true);
    expect(isValidSvNummer(' 65180539M032 ')).toBe(true);
  });

  // Negative vectors — structural failures
  it('rejects empty string', () => {
    expect(isValidSvNummer('')).toBe(false);
  });

  it('rejects length 11 (missing trailing digit)', () => {
    expect(isValidSvNummer('12345678A01')).toBe(false);
    expect(isValidSvNummer('12345678901')).toBe(false);
  });

  it('rejects length 13 (trailing junk)', () => {
    expect(isValidSvNummer('1234567A01234')).toBe(false);
    expect(isValidSvNummer('12345678A0123')).toBe(false);
  });

  it('rejects letter in wrong position', () => {
    // letter should be at index 8, digits elsewhere
    expect(isValidSvNummer('1234567A8A012')).toBe(false);
    expect(isValidSvNummer('A2345678B012')).toBe(false);
  });

  // Negative vectors — checksum failures (structurally valid but wrong check digit)
  it('rejects 65180539M030 (correct structure, wrong check digit)', () => {
    expect(isValidSvNummer('65180539M030')).toBe(false);
  });

  it('rejects 01010100A015 (correct structure, wrong check digit)', () => {
    expect(isValidSvNummer('01010100A015')).toBe(false);
  });

  it('rejects 55120180B028 (correct structure, wrong check digit)', () => {
    expect(isValidSvNummer('55120180B028')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidSteuernummer — Plan 04 supplies the per-Bundesland regex map.
// ---------------------------------------------------------------------------

describe('isValidSteuernummer per Bundesland (FOUND-02, D-03)', () => {
  it('accepts BW 10-digit format with slashes', () => {
    expect(isValidSteuernummer('BW', '93/815/08152')).toBe(true);
  });

  it('accepts BW 10-digit format without slashes (raw digits)', () => {
    expect(isValidSteuernummer('BW', '9381508152')).toBe(true);
  });

  it('accepts BY 11-digit format', () => {
    expect(isValidSteuernummer('BY', '181/815/08155')).toBe(true);
  });

  it('rejects BW when given a BY-formatted 11-digit number', () => {
    expect(isValidSteuernummer('BW', '181/815/08155')).toBe(false);
  });

  it('accepts NW unique 4-4 split format', () => {
    expect(isValidSteuernummer('NW', '133/8150/8159')).toBe(true);
  });

  it('rejects NW when given a standard 3-5 split', () => {
    expect(isValidSteuernummer('NW', '181/815/08155')).toBe(false);
  });

  it('accepts all 16 Bundesländer with their canonical example (Wikipedia Steuernummer 2026-04-12)', () => {
    const vectors: Array<[string, string]> = [
      ['BW', '93/815/08152'],
      ['BY', '181/815/08155'],
      ['BE', '21/815/08150'],
      ['BB', '048/815/08155'],
      ['HB', '75/815/08152'],
      ['HH', '02/815/08156'],
      ['HE', '013/815/08153'],
      ['MV', '079/815/08151'],
      ['NI', '24/815/08151'],
      ['NW', '133/8150/8159'],
      ['RP', '22/815/08154'],
      ['SL', '10/815/08182'],
      ['SN', '201/123/12340'],
      ['ST', '101/815/08154'],
      ['SH', '29/815/08158'],
      ['TH', '151/815/08156'],
    ];
    for (const [bundesland, value] of vectors) {
      expect(
        isValidSteuernummer(bundesland, value),
        `${bundesland} must accept ${value}`,
      ).toBe(true);
    }
  });

  it('rejects each Bundesland with a cross-state format (length mismatch)', () => {
    // 10-digit states fed an 11-digit value → reject; and vice versa.
    const mismatches: Array<[string, string]> = [
      ['BW', '181/815/08155'], // 10-digit state fed 11-digit
      ['BE', '181/815/08155'],
      ['HB', '181/815/08155'],
      ['HH', '181/815/08155'],
      ['NI', '181/815/08155'],
      ['RP', '181/815/08155'],
      ['SL', '181/815/08155'],
      ['SH', '181/815/08155'],
      ['BY', '93/815/08152'], // 11-digit state fed 10-digit
      ['BB', '93/815/08152'],
      ['MV', '93/815/08152'],
      ['SN', '93/815/08152'],
      ['ST', '93/815/08152'],
      ['TH', '93/815/08152'],
      ['HE', '93/815/08152'], // HE is 11-digit starting with 0
      ['NW', '93/815/08152'], // NW is 11-digit with 3-4-4 split
    ];
    for (const [bundesland, value] of mismatches) {
      expect(
        isValidSteuernummer(bundesland, value),
        `${bundesland} must reject ${value}`,
      ).toBe(false);
    }
  });

  it('rejects unknown Bundesland code', () => {
    expect(isValidSteuernummer('ZZ', '93/815/08152')).toBe(false);
    expect(isValidSteuernummer('', '93/815/08152')).toBe(false);
    expect(isValidSteuernummer('DE', '93/815/08152')).toBe(false);
  });

  it('rejects malformed value', () => {
    expect(isValidSteuernummer('BW', '')).toBe(false);
    expect(isValidSteuernummer('BW', 'abc')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidHandelsregister — composite validator (court + type + number)
// ---------------------------------------------------------------------------

describe('isValidHandelsregister composite (FOUND-02, D-03)', () => {
  // Positive vectors rely on Plan 04's handelsregister-courts.ts data.
  // The court codes below must exist in that list.
  it('accepts well-formed HRB composite', () => {
    expect(
      isValidHandelsregister({
        court: 'amtsgericht-muenchen',
        type: 'HRB',
        number: '123456',
      }),
    ).toBe(true);
  });

  it('accepts well-formed HRA composite', () => {
    expect(
      isValidHandelsregister({
        court: 'amtsgericht-berlin-charlottenburg',
        type: 'HRA',
        number: '42',
      }),
    ).toBe(true);
  });

  it('accepts numbers up to 7 digits (D-03 length cap)', () => {
    expect(
      isValidHandelsregister({
        court: 'amtsgericht-muenchen',
        type: 'HRB',
        number: '1234567',
      }),
    ).toBe(true);
  });

  it('rejects empty court', () => {
    expect(
      isValidHandelsregister({ court: '', type: 'HRB', number: '123456' }),
    ).toBe(false);
  });

  it('rejects unknown court code', () => {
    expect(
      isValidHandelsregister({
        court: 'not-a-real-court',
        type: 'HRB',
        number: '123456',
      }),
    ).toBe(false);
  });

  it('rejects invalid type (only HRB and HRA allowed)', () => {
    expect(
      isValidHandelsregister({
        court: 'amtsgericht-muenchen',
        type: 'HRC' as 'HRB',
        number: '123456',
      }),
    ).toBe(false);
    expect(
      isValidHandelsregister({
        court: 'amtsgericht-muenchen',
        type: '' as 'HRB',
        number: '123456',
      }),
    ).toBe(false);
  });

  it('rejects non-numeric number', () => {
    expect(
      isValidHandelsregister({
        court: 'amtsgericht-muenchen',
        type: 'HRB',
        number: 'abc',
      }),
    ).toBe(false);
    expect(
      isValidHandelsregister({
        court: 'amtsgericht-muenchen',
        type: 'HRB',
        number: '12A456',
      }),
    ).toBe(false);
  });

  it('rejects number exceeding 7 digits (D-03 cap)', () => {
    expect(
      isValidHandelsregister({
        court: 'amtsgericht-muenchen',
        type: 'HRB',
        number: '12345678',
      }),
    ).toBe(false);
  });

  it('rejects empty number', () => {
    expect(
      isValidHandelsregister({
        court: 'amtsgericht-muenchen',
        type: 'HRB',
        number: '',
      }),
    ).toBe(false);
  });
});
