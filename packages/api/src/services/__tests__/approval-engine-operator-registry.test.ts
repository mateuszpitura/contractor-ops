// GREEN tests for the approval-engine operator registry.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __testOnly,
  evaluateOperator,
  getRegisteredOperators,
  registerOperator,
} from '../approval-engine/operators/registry';
// Side-effect import registers complianceCritical.
import '../approval-engine/operators/index';

function makeCtx(findFirst: ReturnType<typeof vi.fn>) {
  return {
    tx: { contractorComplianceItem: { findFirst } } as never,
    contractorId: 'ctr-1',
    organizationId: 'org-1',
  };
}

describe('approval-engine-operator-registry register', () => {
  it('registers complianceCritical at module-load via barrel-import side effect', () => {
    expect(getRegisteredOperators).toBeTypeOf('function');
    expect(getRegisteredOperators()).toContain('complianceCritical');
  });

  it('throws on duplicate registration of the same operator name', () => {
    expect(() => registerOperator('complianceCritical', async () => false)).toThrow(
      /already registered/i,
    );
  });

  it('throws when evaluating an unknown operator', async () => {
    await expect(evaluateOperator('nopeNotReal', {}, makeCtx(vi.fn()))).rejects.toThrow(
      /unknown operator/i,
    );
  });
});

describe('approval-engine-operator-registry compliance-critical', () => {
  it('evaluates TRUE for contractor with BLOCKING+EXPIRED item', async () => {
    const findFirst = vi.fn(async () => ({ id: 'item-1' }));
    const result = await evaluateOperator(
      'complianceCritical',
      { status: 'EXPIRED' },
      makeCtx(findFirst),
    );
    expect(result).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        contractorId: 'ctr-1',
        severity: 'BLOCKING',
        status: 'EXPIRED',
        contractor: { is: { organizationId: 'org-1' } },
      },
      select: { id: true },
    });
  });

  it('evaluates FALSE for contractor with no matching items', async () => {
    const findFirst = vi.fn(async () => null);
    const result = await evaluateOperator(
      'complianceCritical',
      { status: 'EXPIRED' },
      makeCtx(findFirst),
    );
    expect(result).toBe(false);
  });
});

describe('approval-engine-operator-registry reset (test-only)', () => {
  // Verify the test-only reset clears the registry, then re-register for isolation.
  beforeEach(() => {
    // no-op; isolation handled per-assertion below
  });

  it('reset() empties the registry', () => {
    const before = getRegisteredOperators();
    expect(before).toContain('complianceCritical');
    __testOnly.reset();
    expect(getRegisteredOperators()).toHaveLength(0);
    // Re-register so subsequent suites/imports remain consistent within this file.
    registerOperator('complianceCritical', async (_args, ctx) => {
      const row = await ctx.tx.contractorComplianceItem.findFirst({
        where: { contractorId: ctx.contractorId, severity: 'BLOCKING', status: 'EXPIRED' },
        select: { id: true },
      });
      return row !== null;
    });
    expect(getRegisteredOperators()).toContain('complianceCritical');
  });
});
