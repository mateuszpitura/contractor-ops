// Phase 57 · Plan 03 · Task 1 — PII mask for tax IDs (log-safe output).
//
// Mirrors the Phase 56 PII-mask precedent (packages/logger/src/pii-mask.ts).
// Used by tax-id-validation.service to guarantee raw VAT numbers never reach
// log sinks (ASVS V7, V8; T-57-03-02 mitigation).

import { describe, expect, it } from 'vitest';

import { maskTaxId } from '../tax-id-pii.js';

describe('maskTaxId', () => {
  it("returns '[empty]' for null/undefined/empty input", () => {
    expect(maskTaxId(null)).toBe('[empty]');
    expect(maskTaxId(undefined)).toBe('[empty]');
    expect(maskTaxId('')).toBe('[empty]');
  });

  it('replaces every character with a star for short values (<=4)', () => {
    expect(maskTaxId('AB')).toBe('**');
    expect(maskTaxId('ABCD')).toBe('****');
  });

  it('preserves 2-char country prefix + last 4 chars for a full VAT', () => {
    // GB123456789 → GB + middle (5 chars) masked + 6789
    expect(maskTaxId('GB123456789')).toBe('GB*****6789');
    // DE123456789 → DE + 5 masked + 6789
    expect(maskTaxId('DE123456789')).toBe('DE*****6789');
  });
});
