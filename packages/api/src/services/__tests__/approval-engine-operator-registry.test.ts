// Phase 72 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-06 plug-in operator registry; lives in
// packages/api/src/services/approval-engine/operators/registry.ts (Plan 72-05).

import { describe, expect, it } from 'vitest';

describe('approval-engine-operator-registry register', () => {
  it('registers complianceCritical at module-load via barrel-import side effect', async () => {
    const mod = await import('../approval-engine/operators/registry.js');
    expect(mod.getRegisteredOperators).toBeTypeOf('function');
    expect(mod.getRegisteredOperators()).toContain('complianceCritical');
  });

  it('throws on duplicate registration of the same operator name', async () => {
    throw new Error('registry duplicate-name guard not yet implemented');
  });
});

describe('approval-engine-operator-registry compliance-critical', () => {
  it('evaluates TRUE for contractor with BLOCKING+EXPIRED item', async () => {
    throw new Error('complianceCritical evaluator not yet implemented');
  });

  it('evaluates FALSE for contractor with only WARNING-severity items', async () => {
    throw new Error('severity filter not yet implemented');
  });
});
