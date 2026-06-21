// Greenfield statutory-identifier validators for the per-market employee registry.
//
// RED until `packages/validators/src/employee-validators.ts` is created. The
// import below resolves to a not-yet-existing module, so the whole suite fails
// at module resolution (Cannot find module). These vectors pin the validator
// contracts before any implementation exists.
//
// References:
//   PESEL structure + checksum — en.wikipedia.org/wiki/PESEL
//   Steuer-IdNr (ISO 7064 MOD 11,10 + digit-uniqueness) — python-stdnum stdnum.de.idnr
//   UK NI number format + DWP exclusions — GOV.UK HMRC NIM39110
//   UK tax code grammar — GOV.UK PAYE manual PAYE11045/PAYE11075
//   Saudi national ID / Iqama (Luhn + leading-digit type) — SAP KB 2384001
//   Emirates ID format (784-YYYY-NNNNNNN-N) — ICP; Luhn checksum is advisory only

import { describe, expect, it } from 'vitest';

import {
  classifySaudiId,
  isValidEmiratesId,
  isValidGosi,
  isValidNiNumber,
  isValidPesel,
  isValidSteuerIdNr,
  isValidUkTaxCode,
  isValidWpsEstablishmentId,
} from '../employee-validators.js';

// ---------------------------------------------------------------------------
// PESEL — Σ(w·d) mod 10 weighted checksum + embedded-DOB cross-check
// ---------------------------------------------------------------------------

describe('isValidPesel', () => {
  it('accepts 44051401359 (canonical valid; check digit 9)', () => {
    expect(isValidPesel('44051401359')).toBe(true);
  });

  it('rejects 44051401358 (correct structure, wrong check digit)', () => {
    expect(isValidPesel('44051401358')).toBe(false);
  });

  it('rejects 44131401359 (impossible date of birth, month 13)', () => {
    expect(isValidPesel('44131401359')).toBe(false);
  });

  it('rejects non-11-digit and non-numeric input', () => {
    expect(isValidPesel('4405140135')).toBe(false);
    expect(isValidPesel('440514013590')).toBe(false);
    expect(isValidPesel('')).toBe(false);
    expect(isValidPesel('4405140135X')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Steuer-IdNr — ISO 7064 MOD 11,10 + "exactly one digit repeats 2-or-3×" rule
// ---------------------------------------------------------------------------

describe('isValidSteuerIdNr', () => {
  it('accepts 36574261809 (canonical valid; ISO 7064 MOD 11,10)', () => {
    expect(isValidSteuerIdNr('36574261809')).toBe(true);
  });

  it('rejects 36554266806 (fails the digit-uniqueness rule in positions 1-10)', () => {
    expect(isValidSteuerIdNr('36554266806')).toBe(false);
  });

  it('rejects a number that is not exactly 11 digits', () => {
    expect(isValidSteuerIdNr('3657426180')).toBe(false);
    expect(isValidSteuerIdNr('365742618099')).toBe(false);
    expect(isValidSteuerIdNr('')).toBe(false);
  });

  it('rejects a leading zero (first digit must be 1-9)', () => {
    expect(isValidSteuerIdNr('06574261809')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UK NI number — format + DWP prefix/letter exclusions
// ---------------------------------------------------------------------------

describe('isValidNiNumber', () => {
  it('accepts AB123456C (well-formed, allowed prefix)', () => {
    expect(isValidNiNumber('AB123456C')).toBe(true);
  });

  it('rejects DA123456C (first letter D is disallowed)', () => {
    expect(isValidNiNumber('DA123456C')).toBe(false);
  });

  it('rejects AO123456C (second letter O is disallowed)', () => {
    expect(isValidNiNumber('AO123456C')).toBe(false);
  });

  it('rejects BG123456C (disallowed prefix BG)', () => {
    expect(isValidNiNumber('BG123456C')).toBe(false);
  });

  it('rejects QQ123456C (Q is disallowed in either letter position)', () => {
    expect(isValidNiNumber('QQ123456C')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UK tax code — 1257L grammar + emergency / K-prefix / special codes
// ---------------------------------------------------------------------------

describe('isValidUkTaxCode', () => {
  it.each([
    ['1257L', 'standard personal-allowance suffix code'],
    ['K1257', 'K-prefix (negative allowance) code'],
    ['BR', 'basic-rate special code'],
    ['0T', 'no-allowance special code'],
    ['NT', 'no-tax special code'],
    ['S1257L', 'Scottish jurisdiction prefix'],
    ['1257L W1', 'emergency week-1 suffix'],
  ])('accepts %s (%s)', code => {
    expect(isValidUkTaxCode(code)).toBe(true);
  });

  it('rejects ZZZ (not a tax code)', () => {
    expect(isValidUkTaxCode('ZZZ')).toBe(false);
  });

  it('rejects 12345L (more than four digits)', () => {
    expect(isValidUkTaxCode('12345L')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Saudi national ID / Iqama — Luhn + leading digit (1=citizen, 2=resident)
// ---------------------------------------------------------------------------

describe('classifySaudiId', () => {
  // Luhn-valid 10-digit samples: leading 1 = citizen, leading 2 = resident.
  const CITIZEN_ID = '1000000000';
  const RESIDENT_ID = '2000000004';

  it('returns 1 for a Luhn-valid leading-1 citizen ID', () => {
    expect(classifySaudiId(CITIZEN_ID)).toBe(1);
  });

  it('returns 2 for a Luhn-valid leading-2 resident ID', () => {
    expect(classifySaudiId(RESIDENT_ID)).toBe(2);
  });

  it('returns false when the Luhn check fails', () => {
    expect(classifySaudiId('1000000001')).toBe(false);
  });

  it('returns false when the leading digit is neither 1 nor 2', () => {
    expect(classifySaudiId('3000000000')).toBe(false);
  });

  it('honours the 1 | 2 | false union contract (never a bare boolean true)', () => {
    const result = classifySaudiId(CITIZEN_ID);
    expect([1, 2, false]).toContain(result);
  });
});

// ---------------------------------------------------------------------------
// Emirates ID — strict format gate; the Luhn checksum is ADVISORY ONLY and
// must never turn a format-valid ID into a hard reject (documented Luhn
// false-negatives against ICP databases).
// ---------------------------------------------------------------------------

describe('isValidEmiratesId', () => {
  it('returns format-valid for 784-1990-1234567-1', () => {
    expect(isValidEmiratesId('784-1990-1234567-1').formatValid).toBe(true);
  });

  it('returns format-invalid for 784-90-1234567-1 (wrong year-group width)', () => {
    expect(isValidEmiratesId('784-90-1234567-1').formatValid).toBe(false);
  });

  it('treats the checksum as advisory: a format-valid ID is never hard-rejected even when the Luhn advisory fails', () => {
    const result = isValidEmiratesId('784-1990-1234567-1');
    // The format gate is authoritative; checksumValid is a soft signal only,
    // so a failing advisory must not flip formatValid to false.
    expect(result.formatValid).toBe(true);
    expect(typeof result.checksumValid).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// GOSI registration number — lenient 9-digit accept (adviser-verify, no
// authoritative public spec)
// ---------------------------------------------------------------------------

describe('isValidGosi', () => {
  it('accepts a 9-digit registration number', () => {
    expect(isValidGosi('123456789')).toBe(true);
  });

  it('rejects a too-short number', () => {
    expect(isValidGosi('12345')).toBe(false);
  });

  it('rejects a non-digit number', () => {
    expect(isValidGosi('12345678A')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WPS Establishment ID — lenient up-to-13-digit accept (MOL, leading-zero
// padded; adviser-verify)
// ---------------------------------------------------------------------------

describe('isValidWpsEstablishmentId', () => {
  it('accepts a 13-digit leading-zero-padded establishment ID', () => {
    expect(isValidWpsEstablishmentId('0000000012345')).toBe(true);
  });

  it('rejects a non-digit value', () => {
    expect(isValidWpsEstablishmentId('00000000A2345')).toBe(false);
  });

  it('rejects an over-length (14-digit) value', () => {
    expect(isValidWpsEstablishmentId('00000000123456')).toBe(false);
  });
});
