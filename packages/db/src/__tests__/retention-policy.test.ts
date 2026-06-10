// Pins the statutory retention-policy resolver contract for
// `packages/db/src/retention-policy.ts`.
//
// Contract under test:
//   RETENTION_YEARS = { '1099-NEC': 4, 'backup-withholding': 7 }
//   resolveRetentionYears(recordType): number
//   getRetentionCutoff(model, now): Date | null  (null when model unmapped)
//   MODEL_RETENTION_TYPE ships EMPTY — the fixture mapping is injected
//   test-locally so production behaviour stays unchanged but the wiring proves out.
//
// Fixture model: `Invoice` (representative soft-delete model; the real
// 1099/W-form tables register their own entries separately).

import { describe, expect, it } from 'vitest';

import {
  getRetentionCutoff,
  MODEL_RETENTION_TYPE,
  resolveRetentionYears,
} from '../retention-policy.js';

describe('retention-policy resolver (US-INFRA-03, SC#3 — Wave 0 RED until Plan 04)', () => {
  it('resolveRetentionYears maps 1099-NEC to 4 years', () => {
    expect(resolveRetentionYears('1099-NEC')).toBe(4);
  });

  it('resolveRetentionYears maps backup-withholding to 7 years', () => {
    expect(resolveRetentionYears('backup-withholding')).toBe(7);
  });

  it('MODEL_RETENTION_TYPE ships EMPTY in Phase 83 (D-06 — no tax tables yet)', () => {
    // Production map is empty until tax models are registered.
    expect(Object.keys(MODEL_RETENTION_TYPE)).toHaveLength(0);
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
