vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  // Multi-layer enforcement (D-05/D-06):
  //  1. root.ts evaluates `buildFlagBag` at module load to gate classification routers.
  //  2. classificationProcedure middleware calls `evaluate(...)` per-request.
  // Tests that exercise classification need both layers to return enabled=true.
  const actual = (await importOriginal()) as Record<string, unknown>;
  const enabledBag = {
    values: { 'module.classification-engine': true },
    isEnabled: (key: string) => key === 'module.classification-engine',
  };
  return {
    ...actual,
    buildFlagBag: vi.fn(() => enabledBag),
    lazyFlagBag: vi.fn(() => enabledBag),
    evaluate: vi.fn((key: string) =>
      key === 'module.classification-engine'
        ? { enabled: true, reason: 'mocked' }
        : { enabled: false, reason: 'mocked' },
    ),
  };
});

// Phase 59 Plan 59-03 Task 2 — ir35Attestation router contract tests.
import { describe, expect, it } from 'vitest';

import { ir35AttestationRouter } from '../compliance/ir35-other-client-attestation';

describe('ir35Attestation router (Phase 59 · CLASS-06 support)', () => {
  it('exposes the 3 required procedures', () => {
    const record = ir35AttestationRouter._def.record;
    expect(record).toHaveProperty('getForEngagement');
    expect(record).toHaveProperty('upsert');
    expect(record).toHaveProperty('getPlatformCrossReference');
  });

  it('getForEngagement + getPlatformCrossReference are queries', () => {
    const record = ir35AttestationRouter._def.record;
    for (const key of ['getForEngagement', 'getPlatformCrossReference'] as const) {
      const proc = record[key];
      const type =
        (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type;
      expect(type, `${key} should be a query`).toBe('query');
    }
  });

  it('upsert is a mutation', () => {
    const proc = ir35AttestationRouter._def.record.upsert;
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type,
    ).toBe('mutation');
  });
});
