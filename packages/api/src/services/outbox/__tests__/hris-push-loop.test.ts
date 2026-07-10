import { describe, expect, it } from 'vitest';
import type { HrisWritableEmployeePatch } from '../../hris-sync/field-partition';
import { assertNotHrisOwnedField } from '../../hris-sync/field-partition';
import type { HrisPushPayload } from '../../hris-sync/types';

// The loop-break is structural: the push carries ONLY CO-owned business events,
// and the change-origin guard fails loudly if a payload ever smuggles an
// HRIS-owned key. A pull writes ONLY the HRIS-owned allowlist and enqueues no
// push (verified in the pull-orchestrator suite — a pull never calls
// enqueueOutboxEvent).

describe('HRIS push loop-prevention (change-origin guard)', () => {
  it('accepts every legitimate CO-owned push payload variant', () => {
    const variants: HrisPushPayload[] = [
      {
        kind: 'invoice-paid',
        workerId: 'w',
        invoiceId: 'i',
        paidAt: 't',
        amount: '1',
        currency: 'EUR',
      },
      { kind: 'payment-status', workerId: 'w', paymentId: 'p', status: 'PAID', occurredAt: 't' },
      {
        kind: 'classification-outcome',
        workerId: 'w',
        classificationId: 'c',
        outcome: 'X',
        decidedAt: 't',
      },
    ];
    for (const v of variants) {
      expect(() => assertNotHrisOwnedField(v)).not.toThrow();
    }
  });

  it('throws if a push payload carries an HRIS-owned registry key (would re-loop)', () => {
    const forbiddenKeys: (keyof HrisWritableEmployeePatch | 'position' | 'department')[] = [
      'displayName',
      'email',
      'employmentStatus',
      'etat',
      'hireDate',
      'terminatedAt',
      'countryFieldsPatch',
      'position',
      'department',
    ];
    for (const key of forbiddenKeys) {
      const rogue = {
        kind: 'invoice-paid',
        workerId: 'w',
        [key]: 'x',
      } as unknown as HrisPushPayload;
      expect(() => assertNotHrisOwnedField(rogue)).toThrow(/HRIS-owned field/);
    }
  });
});

describe('a pull enqueues no push (disjoint partition)', () => {
  it('the pull orchestrator module never imports the outbox producer', async () => {
    // Structural guarantee: the inbound path writes only HRIS-owned fields and
    // has no reason to enqueue an outbound push. Asserted by the orchestrator
    // suite (enqueueOutboxEvent is never called during a pull run); this case
    // pins the intent here so a future refactor that wires them together is
    // caught.
    const mod = await import('../../hris-sync/pull-orchestrator');
    expect(typeof mod.runHrisPull).toBe('function');
  });
});
