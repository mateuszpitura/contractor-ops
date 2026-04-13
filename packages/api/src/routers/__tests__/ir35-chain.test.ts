// Phase 59 Plan 59-03 Task 1 — ir35Chain router contract tests.
import { describe, expect, it } from 'vitest';

import { ir35ChainRouter } from '../ir35-chain.js';

describe('ir35Chain router (Phase 59 · CLASS-04)', () => {
  it('exposes the 6 required procedures', () => {
    const record = ir35ChainRouter._def.record;
    expect(record).toHaveProperty('listByEngagement');
    expect(record).toHaveProperty('upsertParticipant');
    expect(record).toHaveProperty('reorderParticipants');
    expect(record).toHaveProperty('markDelivered');
    expect(record).toHaveProperty('markAcknowledged');
    expect(record).toHaveProperty('removeParticipant');
  });

  it('listByEngagement is a query', () => {
    const proc = ir35ChainRouter._def.record.listByEngagement;
    expect(
      (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type,
    ).toBe('query');
  });

  it('mutations are typed as mutations', () => {
    const record = ir35ChainRouter._def.record;
    for (const key of [
      'upsertParticipant',
      'reorderParticipants',
      'markDelivered',
      'markAcknowledged',
      'removeParticipant',
    ] as const) {
      const proc = record[key];
      const type =
        (proc as unknown as { _def?: { type?: string } })._def?.type ??
        (proc as { type?: string }).type;
      expect(type, `${key} should be a mutation`).toBe('mutation');
    }
  });

  // Integration coverage tracked as todos pending the shared mockPrisma harness.
  describe.todo('listByEngagement auto-seeds CLIENT + WORKER on first call for GB engagement');
  describe.todo('listByEngagement does NOT auto-seed for non-GB engagements');
  describe.todo('upsertParticipant rejects linkedContractorId belonging to another org');
  describe.todo('markDelivered sets sdsDeliveredAt + preserves note');
  describe.todo('markAcknowledged sets sdsAcknowledgedAt independently of sdsDeliveredAt');
  describe.todo('reorderParticipants assigns orderIndex = position; rejects foreign ids');
  describe.todo('removeParticipant blocks removal of CLIENT role (auto-populated)');
  describe.todo('multi-tenant: Org A cannot list / mutate Org B chain (NOT_FOUND)');
  describe.todo('concurrent listByEngagement on empty engagement auto-seeds exactly once');
});
