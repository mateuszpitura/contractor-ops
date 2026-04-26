import { describe, expect, it } from 'vitest';
import { getAllPurposeCodes, getPurposeCode, isValidPurposeCode } from '../purpose-codes.js';

// ---------------------------------------------------------------------------
// getPurposeCode
// ---------------------------------------------------------------------------

describe('getPurposeCode', () => {
  it('returns SCVE for SOFTWARE_DEVELOPMENT category', () => {
    expect(getPurposeCode('SOFTWARE_DEVELOPMENT')).toBe('SCVE');
  });

  it('returns COMC for CONSULTING category', () => {
    expect(getPurposeCode('CONSULTING')).toBe('COMC');
  });

  it('returns LGAS for LEGAL category', () => {
    expect(getPurposeCode('LEGAL')).toBe('LGAS');
  });

  it('returns ACCT for ACCOUNTING category', () => {
    expect(getPurposeCode('ACCOUNTING')).toBe('ACCT');
  });

  it('returns ADVE for MARKETING category', () => {
    expect(getPurposeCode('MARKETING')).toBe('ADVE');
  });

  it('returns EDUC for TRAINING category', () => {
    expect(getPurposeCode('TRAINING')).toBe('EDUC');
  });

  it('returns BLDG for CONSTRUCTION category', () => {
    expect(getPurposeCode('CONSTRUCTION')).toBe('BLDG');
  });

  it('returns OTHR for DESIGN category', () => {
    expect(getPurposeCode('DESIGN')).toBe('OTHR');
  });

  it('returns SUPP fallback for unknown category', () => {
    expect(getPurposeCode('UNKNOWN_CATEGORY')).toBe('SUPP');
  });

  it('override takes precedence over category mapping', () => {
    expect(getPurposeCode('SOFTWARE_DEVELOPMENT', 'LGAS')).toBe('LGAS');
  });

  it('ignores invalid override and falls back to category mapping', () => {
    expect(getPurposeCode('CONSULTING', 'INVALID')).toBe('COMC');
  });

  it('ignores null override', () => {
    expect(getPurposeCode('LEGAL', null)).toBe('LGAS');
  });

  it('normalizes lowercase input', () => {
    expect(getPurposeCode('software_development')).toBe('SCVE');
  });

  it('normalizes dashes to underscores', () => {
    expect(getPurposeCode('software-development')).toBe('SCVE');
  });

  it('normalizes spaces to underscores', () => {
    expect(getPurposeCode('software development')).toBe('SCVE');
  });

  it('normalizes mixed case with dashes', () => {
    expect(getPurposeCode('Management-Consulting')).toBe('COMC');
  });
});

// ---------------------------------------------------------------------------
// isValidPurposeCode
// ---------------------------------------------------------------------------

describe('isValidPurposeCode', () => {
  it('returns true for valid codes', () => {
    expect(isValidPurposeCode('SCVE')).toBe(true);
    expect(isValidPurposeCode('COMC')).toBe(true);
    expect(isValidPurposeCode('SUPP')).toBe(true);
    expect(isValidPurposeCode('LGAS')).toBe(true);
  });

  it('returns false for invalid codes', () => {
    expect(isValidPurposeCode('INVALID')).toBe(false);
    expect(isValidPurposeCode('')).toBe(false);
    expect(isValidPurposeCode('scve')).toBe(false); // case-sensitive
  });
});

// ---------------------------------------------------------------------------
// getAllPurposeCodes
// ---------------------------------------------------------------------------

describe('getAllPurposeCodes', () => {
  it('returns a non-empty array', () => {
    const codes = getAllPurposeCodes();
    expect(codes.length).toBeGreaterThan(0);
  });

  it('each entry has code and description', () => {
    const codes = getAllPurposeCodes();
    for (const entry of codes) {
      expect(entry).toHaveProperty('code');
      expect(entry).toHaveProperty('description');
      expect(typeof entry.code).toBe('string');
      expect(typeof entry.description).toBe('string');
    }
  });

  it('includes the SUPP fallback code', () => {
    const codes = getAllPurposeCodes();
    expect(codes.some(e => e.code === 'SUPP')).toBe(true);
  });
});
