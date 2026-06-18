// Pins the statutory retention-policy resolver contract for
// `packages/db/src/retention-policy.ts`.
//
// Contract under test:
//   RETENTION_YEARS = { '1099-NEC': 4, 'backup-withholding': 7 }
//   resolveRetentionYears(recordType): number
//   getRetentionCutoff(model, now): Date | null  (null when model unmapped)
//   MODEL_RETENTION_TYPE registers each soft-delete tax model on its statutory
//   record type; getRetentionCutoff also accepts a fixture mapping override so
//   tests can exercise a representative model without touching production wiring.

import { describe, expect, it } from 'vitest';

import {
  getRetentionCutoff,
  MODEL_RETENTION_TYPE,
  resolveRetentionYears,
} from '../retention-policy.js';

describe('retention-policy resolver', () => {
  it('resolveRetentionYears maps 1099-NEC to 4 years', () => {
    expect(resolveRetentionYears('1099-NEC')).toBe(4);
  });

  it('resolveRetentionYears maps backup-withholding to 7 years', () => {
    expect(resolveRetentionYears('backup-withholding')).toBe(7);
  });

  it('MODEL_RETENTION_TYPE registers Form1099Nec on the 1099-NEC window', () => {
    // The soft-delete 1099-NEC table carries the statutory 4-year IRS window.
    expect(MODEL_RETENTION_TYPE.Form1099Nec).toBe('1099-NEC');
  });

  it('getRetentionCutoff returns now minus 4 years for a model mapped to 1099-NEC', () => {
    // Fixture mapping injected test-locally — production MODEL_RETENTION_TYPE
    // stays empty. Here we map the representative `Invoice` fixture to a
    // 4-year ('1099-NEC') window and assert the cutoff is now - 4y.
    const now = new Date('2026-06-07T00:00:00.000Z');
    const fixtureMap = { Invoice: '1099-NEC' as const };
    const cutoff = getRetentionCutoff('Invoice', now, fixtureMap);
    const expected = new Date(now);
    expected.setFullYear(expected.getFullYear() - 4);
    expect(cutoff).toEqual(expected);
  });

  it('getRetentionCutoff returns null for an unmapped model', () => {
    const now = new Date('2026-06-07T00:00:00.000Z');
    expect(getRetentionCutoff('SomeUnmappedModel', now)).toBeNull();
  });
});
