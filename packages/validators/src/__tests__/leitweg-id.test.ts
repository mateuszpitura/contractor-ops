// packages/validators/src/__tests__/leitweg-id.test.ts
//
// Phase 61 · Plan 61-01 Task 2 — Leitweg-ID Zod schema + MOD-11-10 check-digit
// round-trip test against the ground-truth fixture corpus.

import { describe, expect, it } from 'vitest';

import {
  computeLeitwegCheckDigit,
  leitwegIdSchema,
  peppolParticipantPairSchema,
  validateLeitwegCheckDigit,
} from '../leitweg-id.js';
import { LEITWEG_ID_INVALID_FIXTURES, LEITWEG_ID_VALID_FIXTURES } from './leitweg-id.fixtures.js';

describe('leitwegIdSchema — valid KoSIT-aligned fixtures', () => {
  for (const value of LEITWEG_ID_VALID_FIXTURES) {
    it(`accepts ${value}`, () => {
      const result = leitwegIdSchema.safeParse(value);
      expect(result.success, JSON.stringify(result)).toBe(true);
    });
  }
});

describe('leitwegIdSchema — invalid fixtures', () => {
  for (const { value, reason } of LEITWEG_ID_INVALID_FIXTURES) {
    it(`rejects ${value} (${reason})`, () => {
      const result = leitwegIdSchema.safeParse(value);
      expect(result.success).toBe(false);

      if (reason === 'check_digit_wrong' && !result.success) {
        const message = JSON.stringify(result.error.issues);
        expect(message).toMatch(/check digit/i);
      }
    });
  }
});

describe('computeLeitwegCheckDigit', () => {
  it('pads single-digit MOD-11-10 result to 2 chars with leading zero', () => {
    // payload '99' → ISO 7064 MOD-11-10 result should be 0 → '00'
    expect(computeLeitwegCheckDigit('99')).toBe('00');
  });

  it('decomposes letters into base-10 digit pairs (A=10 → [1,0])', () => {
    // Sanity: the same payload parsed as [9,9,1,3,3,3,3,3,2,9,3,0,1,4]
    // (T=29 → 2,9; E=14 → 1,4) → consistent across repeated calls.
    const first = computeLeitwegCheckDigit('99133333TEST');
    const second = computeLeitwegCheckDigit('99133333TEST');
    expect(first).toBe(second);
    expect(first).toMatch(/^\d{2}$/);
  });

  it('throws on characters outside [0-9A-Z]', () => {
    expect(() => computeLeitwegCheckDigit('99-TEST')).toThrow();
  });
});

describe('validateLeitwegCheckDigit', () => {
  it('returns valid + expected when input matches computed digit', () => {
    const result = validateLeitwegCheckDigit('991', '07');
    expect(result.valid).toBe(true);
    expect(result.expected).toBe('07');
  });

  it('returns invalid + expected when input mismatches', () => {
    const result = validateLeitwegCheckDigit('991', '99');
    expect(result.valid).toBe(false);
    expect(result.expected).toBe('07');
  });

  it('returns invalid + sentinel when payload has bad chars', () => {
    const result = validateLeitwegCheckDigit('99-', '00');
    expect(result.valid).toBe(false);
    expect(result.expected).toBe('??');
  });
});

// ---------------------------------------------------------------------------
// peppolParticipantPairSchema — Phase 61 Plan 04 (D-11)
// ---------------------------------------------------------------------------

describe('peppolParticipantPairSchema', () => {
  it('accepts both null (contractor has no Peppol routing yet)', () => {
    const result = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: null,
      peppolParticipantValue: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts both set (registered on SML)', () => {
    const result = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: '0060',
      peppolParticipantValue: '123456789',
    });
    expect(result.success).toBe(true);
  });

  it('rejects only scheme set (value null)', () => {
    const result = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: '0060',
      peppolParticipantValue: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/both be set or both be null/);
    }
  });

  it('rejects only value set (scheme null)', () => {
    const result = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: null,
      peppolParticipantValue: '123456789',
    });
    expect(result.success).toBe(false);
  });

  it('rejects scheme with non-4-digit format (3 digits)', () => {
    const result = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: '006',
      peppolParticipantValue: '123456789',
    });
    expect(result.success).toBe(false);
  });

  it('rejects scheme with non-4-digit format (5 digits)', () => {
    const result = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: '00600',
      peppolParticipantValue: '123456789',
    });
    expect(result.success).toBe(false);
  });

  it('rejects scheme with non-digit characters', () => {
    const result = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: '00AB',
      peppolParticipantValue: '123456789',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty participant value when paired', () => {
    const result = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: '0060',
      peppolParticipantValue: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects participant value over 64 chars', () => {
    const result = peppolParticipantPairSchema.safeParse({
      peppolSchemeId: '0060',
      peppolParticipantValue: 'A'.repeat(65),
    });
    expect(result.success).toBe(false);
  });
});
