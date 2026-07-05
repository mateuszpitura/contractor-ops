// Form 1042-S year-end service.
//
// The assertions pin the contract the service must satisfy, mirroring the
// shipped form-1099-nec.service sibling:
//   - box-2 rate is resolved via applyTreaty behind the §875(d) gate: a complete
//     W-8 chain claims the treaty rate, an incomplete one falls back to the 30%
//     statutory rate;
//   - a CORRECTED 1042-S supersedes rather than mutates — the prior ACTIVE row
//     flips to SUPERSEDED then a new ACTIVE row is inserted inside ONE
//     $transaction;
//   - generateBatch is idempotent (reserve / complete / clear) so a retried batch
//     never double-files;
//   - the immutable snapshot keeps the recipient FTIN as last-4 only and strips
//     any forged full-identifier key;
//   - routing to 1042-S vs 1099-NEC reads TaxFormSubmission.formType (W-8 →
//     1042-S), never the recipient's nationality.

import { describe, expect, it, vi } from 'vitest';

import {
  buildForm1042SSnapshot,
  fileCorrection1042S,
  generateBatch1042S,
  resolveBox2Rate,
  routeFormType,
} from '../form-1042s.service';

vi.mock('../audit-writer', () => ({
  writeAuditLog: vi.fn(async () => undefined),
  writeAuditLogMany: vi.fn(async () => undefined),
}));

// Drive idempotency from a deterministic in-memory store so the batch tests
// exercise the reserve/complete/clear dedupe contract without a live Redis
// round-trip (the test env points UPSTASH at a placeholder host).
const idemStore = new Map<string, unknown>();
const PENDING = Symbol('pending');
vi.mock('../../lib/idempotency', () => ({
  reserve: vi.fn(async (key: string) => {
    const existing = idemStore.get(key);
    if (existing === undefined) {
      idemStore.set(key, PENDING);
      return { kind: 'MISS' as const };
    }
    if (existing === PENDING) {
      return { kind: 'PENDING' as const };
    }
    return { kind: 'HIT' as const, result: existing };
  }),
  complete: vi.fn(async (key: string, result: unknown) => {
    idemStore.set(key, result);
  }),
  clear: vi.fn(async (key: string) => {
    idemStore.delete(key);
  }),
}));

/** Statutory US withholding rate applied when no treaty claim survives the gate. */
const STATUTORY_RATE = 30;

describe('resolveBox2Rate — §875(d) treaty gate', () => {
  it('claims the treaty rate when the W-8 chain is complete', async () => {
    const decision = await resolveBox2Rate({
      contractorResidency: 'GB',
      w8ChainComplete: true,
    });
    expect(decision.rate).toBeLessThan(STATUTORY_RATE);
    expect(decision.article).toBeTruthy();
    expect(decision.source).toBe('treaty');
  });

  it('forces the 30% statutory rate when the W-8 chain is incomplete', async () => {
    const decision = await resolveBox2Rate({
      contractorResidency: 'GB',
      w8ChainComplete: false,
    });
    expect(decision.rate).toBe(STATUTORY_RATE);
    expect(decision.article).toBeNull();
    expect(decision.source).toBe('statutory_30');
  });
});

describe('routeFormType — form-on-file drives routing, never nationality', () => {
  it('routes a W-8 chain to 1042-S', () => {
    expect(routeFormType('W8BEN')).toBe('1042-S');
    expect(routeFormType('W8BENE')).toBe('1042-S');
  });

  it('routes a W-9 to 1099-NEC', () => {
    expect(routeFormType('W9')).toBe('1099-NEC');
  });
});

describe('buildForm1042SSnapshot — last-4 FTIN only', () => {
  it('keeps the FTIN as last-4 and strips a forged full-identifier key', () => {
    const snapshot = buildForm1042SSnapshot({
      taxYear: 2026,
      payerOrgId: 'org_1',
      recipientId: 'rec_1',
      payerName: 'Acme Org',
      recipientName: 'Jean Contractor',
      recipientFtinLast4: '4821',
      box1IncomeCode: '17',
      box2GrossIncomeMinor: 500_000,
      box3bChap3RateBp: 1500,
      box7FederalTaxWithheldMinor: 75_000,
      treatyArticle: 'Article 7',
      corrected: false,
      // A hostile caller trying to smuggle a full identifier into the record.
      ftin: '999004821',
    } as never);

    expect(snapshot.recipientFtinLast4).toBe('4821');
    expect(JSON.stringify(snapshot)).not.toContain('999004821');
  });
});

describe('fileCorrection1042S — supersede + insert in one $transaction', () => {
  it('flips the prior ACTIVE row to SUPERSEDED before inserting the new ACTIVE row', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({ id: 'form_2', status: 'ACTIVE' });
    const auditCreate = vi.fn().mockResolvedValue({});
    const tx = {
      form1042S: { updateMany, create },
      auditLog: { create: auditCreate, createMany: vi.fn() },
    };

    await fileCorrection1042S(
      tx as never,
      {
        organizationId: 'org_1',
        payerOrgId: 'org_1',
        recipientId: 'rec_1',
        taxYear: 2026,
        snapshotJson: {},
        box2GrossIncomeMinor: 500_000,
        box7FederalTaxWithheldMinor: 75_000,
      } as never,
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
        data: expect.objectContaining({ status: 'SUPERSEDED' }),
      }),
    );
    const updateOrder = updateMany.mock.invocationCallOrder[0];
    const createOrder = create.mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(createOrder);
  });
});

describe('generateBatch1042S — idempotent', () => {
  it('returns the prior result on a retried batch instead of re-filing', async () => {
    const first = await generateBatch1042S(
      { organizationId: 'org_1', payerOrgId: 'org_1', taxYear: 2026, recipients: [] },
      { db: {} as never },
    );
    const second = await generateBatch1042S(
      { organizationId: 'org_1', payerOrgId: 'org_1', taxYear: 2026, recipients: [] },
      { db: {} as never },
    );
    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
  });
});

/** One 1042-S batch recipient with an incomplete W-8 chain (no treaty resolver needed). */
function recipient1042S(recipientId: string) {
  return {
    recipientId,
    formType: 'W8BEN' as const,
    payerName: 'Acme Org',
    recipientName: `Recipient ${recipientId}`,
    recipientFtinLast4: '4821',
    contractorResidency: 'GB',
    // Incomplete chain forces the statutory rate so resolveBox2Rate never calls
    // the live treaty resolver — the test stays about persistence, not rates.
    w8ChainComplete: false,
    box2GrossIncomeMinor: 500_000,
    box7FederalTaxWithheldMinor: 150_000,
    box1IncomeCode: '17',
  };
}

/**
 * A rollback-simulating `$transaction` double: the tx buffers `create`d rows and
 * only flushes them to `committed` when the callback resolves. A throw inside the
 * callback discards the buffer — modeling a Postgres transaction rollback.
 */
function makeRollbackPersist(createImpl: (data: unknown) => Promise<{ id: string }>) {
  const committed: unknown[] = [];
  const persist = {
    $transaction: async <T>(
      fn: (tx: {
        form1042S: { create: (a: { data: unknown }) => Promise<{ id: string }> };
      }) => Promise<T>,
    ): Promise<T> => {
      const staged: unknown[] = [];
      const tx = {
        form1042S: {
          create: async ({ data }: { data: unknown }) => {
            const res = await createImpl(data);
            staged.push(data);
            return res;
          },
        },
      };
      const out = await fn(tx);
      committed.push(...staged);
      return out;
    },
  };
  return { persist, committed };
}

describe('generateBatch1042S — transactional persistence + P2002-as-skip', () => {
  it('rolls back the whole batch (zero rows persisted) when a create throws mid-batch', async () => {
    const { persist, committed } = makeRollbackPersist(async data => {
      if ((data as { recipientId: string }).recipientId === 'rec_2') {
        throw new Error('boom');
      }
      return { id: 'row' };
    });

    await expect(
      generateBatch1042S(
        {
          organizationId: 'org_tx',
          payerOrgId: 'org_tx',
          taxYear: 2030,
          recipients: [recipient1042S('rec_1'), recipient1042S('rec_2'), recipient1042S('rec_3')],
        },
        { db: {} as never, persist: persist as never },
      ),
    ).rejects.toThrow('boom');

    // Full rollback: not even the rec_1 row that inserted before the throw survives.
    expect(committed).toHaveLength(0);
  });

  it('treats a Form1042S_active_key P2002 as an idempotent skip — no duplicates, no error', async () => {
    const { persist, committed } = makeRollbackPersist(async () => {
      throw Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: 'Form1042S_active_key' },
      });
    });

    const result = await generateBatch1042S(
      {
        organizationId: 'org_dup',
        payerOrgId: 'org_dup',
        taxYear: 2031,
        recipients: [recipient1042S('rec_1'), recipient1042S('rec_2')],
      },
      { db: {} as never, persist: persist as never },
    );

    expect(result.idempotent).toBe(true);
    expect(result.generated).toHaveLength(2);
    // Nothing new persisted — the prior batch already filed these ACTIVE rows.
    expect(committed).toHaveLength(0);
  });
});
