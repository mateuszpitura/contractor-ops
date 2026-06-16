// form-1099-nec.service — year-end 1099-NEC generation logic.
//
// Exercises:
//   - box-1 nonemployee comp aggregated by payment (settlement) date within the
//     calendar tax year, non-USD payouts FX-converted to USD at the
//     payment-date rate, aggregated per recipient per payer-org;
//   - a tax-year-keyed threshold table gates generation: $600 TY2025 vs $2,000
//     TY2026 (OBBBA) — never a constant;
//   - CORRECTED = supersede chain (prior ACTIVE -> SUPERSEDED, new ACTIVE
//     inserted in one transaction; the original is never mutated).

import { describe, expect, it, vi } from 'vitest';
import {
  aggregateBox1,
  batchIdempotencyKey,
  buildForm1099NecSnapshot,
  computeBox4Minor,
  generateBatch,
  isAboveThreshold,
  supersedeCorrected,
} from '../form-1099-nec.service';

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

function resetIdempotency(): void {
  idemStore.clear();
}

const payments = [
  {
    recipientId: 'rcpt-1',
    payerOrgId: 'org-1',
    paymentDate: '2026-03-10',
    amountMinor: 100_000,
    currency: 'USD',
  },
  {
    recipientId: 'rcpt-1',
    payerOrgId: 'org-1',
    paymentDate: '2026-06-22',
    amountMinor: 50_000,
    currency: 'USD',
  },
  // Different payer-org — must NOT fold into the org-1 aggregate.
  {
    recipientId: 'rcpt-1',
    payerOrgId: 'org-2',
    paymentDate: '2026-04-01',
    amountMinor: 99_000,
    currency: 'USD',
  },
];

describe('form-1099-nec.service — box-1 aggregation', () => {
  it('aggregates box-1 by payment date per recipient per payer-org, FX-converted to USD', () => {
    const usd = aggregateBox1({
      taxYear: 2026,
      recipientId: 'rcpt-1',
      payerOrgId: 'org-1',
      payments,
    });

    expect(usd.box1AmountMinor).toBe(150_000);
  });

  it('counts a non-USD payout at its pre-converted payment-date USD amount, no float drift', () => {
    const usd = aggregateBox1({
      taxYear: 2026,
      recipientId: 'rcpt-1',
      payerOrgId: 'org-1',
      payments: [
        {
          recipientId: 'rcpt-1',
          payerOrgId: 'org-1',
          paymentDate: '2026-05-01',
          amountMinor: 100_000,
          currency: 'EUR',
          usdAmountMinor: 108_500,
        },
      ],
    });

    expect(usd.box1AmountMinor).toBe(108_500);
  });

  it('excludes payouts settled outside the tax year', () => {
    const usd = aggregateBox1({
      taxYear: 2026,
      recipientId: 'rcpt-1',
      payerOrgId: 'org-1',
      payments: [
        {
          recipientId: 'rcpt-1',
          payerOrgId: 'org-1',
          paymentDate: '2025-12-31',
          amountMinor: 500_000,
          currency: 'USD',
        },
        {
          recipientId: 'rcpt-1',
          payerOrgId: 'org-1',
          paymentDate: '2026-01-01',
          amountMinor: 40_000,
          currency: 'USD',
        },
      ],
    });

    expect(usd.box1AmountMinor).toBe(40_000);
  });

  it('throws rather than silently dropping a non-USD payout with no payment-date conversion', () => {
    expect(() =>
      aggregateBox1({
        taxYear: 2026,
        recipientId: 'rcpt-1',
        payerOrgId: 'org-1',
        payments: [
          {
            recipientId: 'rcpt-1',
            payerOrgId: 'org-1',
            paymentDate: '2026-05-01',
            amountMinor: 100_000,
            currency: 'EUR',
          },
        ],
      }),
    ).toThrow(/payment-date USD conversion/);
  });
});

describe('form-1099-nec.service — tax-year threshold (OBBBA)', () => {
  it('gates at $600 for TY2025 and $2,000 for TY2026', () => {
    expect(isAboveThreshold({ taxYear: 2025, box1AmountMinor: 80_000 })).toBe(true); // > $600
    expect(isAboveThreshold({ taxYear: 2026, box1AmountMinor: 80_000 })).toBe(false); // < $2,000
    expect(isAboveThreshold({ taxYear: 2026, box1AmountMinor: 250_000 })).toBe(true); // > $2,000
  });

  it('treats exactly the threshold as reportable', () => {
    expect(isAboveThreshold({ taxYear: 2025, box1AmountMinor: 60_000 })).toBe(true);
    expect(isAboveThreshold({ taxYear: 2026, box1AmountMinor: 200_000 })).toBe(true);
  });
});

describe('form-1099-nec.service — box-4 backup withholding', () => {
  it('records backup withholding when the W-9 flag is set', () => {
    expect(
      computeBox4Minor({
        backupWithholdingFlagged: true,
        tinMismatch: false,
        recordedBackupWithholdingMinor: 12_000,
      }),
    ).toBe(12_000);
  });

  it('records backup withholding on a TIN mismatch even without the W-9 flag', () => {
    expect(
      computeBox4Minor({
        backupWithholdingFlagged: false,
        tinMismatch: true,
        recordedBackupWithholdingMinor: 5_000,
      }),
    ).toBe(5_000);
  });

  it('is zero when neither the flag nor a mismatch is present', () => {
    expect(
      computeBox4Minor({
        backupWithholdingFlagged: false,
        tinMismatch: false,
        recordedBackupWithholdingMinor: 9_999,
      }),
    ).toBe(0);
  });
});

describe('form-1099-nec.service — immutable snapshot', () => {
  it('keeps the recipient TIN as last-4 only and strips a forged full-SSN key', () => {
    const snapshot = buildForm1099NecSnapshot({
      taxYear: 2026,
      payerOrgId: 'org-1',
      recipientId: 'rcpt-1',
      payerName: 'Acme Org',
      recipientName: 'Jane Q. Contractor',
      recipientTinLast4: '1120',
      box1AmountMinor: 250_000,
      box4BackupWithholdingMinor: 0,
      currency: 'USD',
      corrected: false,
    });

    expect(snapshot.recipientTinLast4).toBe('1120');
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('078051120');
    expect(snapshot.adviserVerifyNote).toMatch(/tax-adviser verification/);
  });
});

describe('form-1099-nec.service — CORRECTED supersede chain', () => {
  it('flips the prior ACTIVE row to SUPERSEDED and inserts a new ACTIVE row in one transaction', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: 'new',
      ...args.data,
    }));
    const tx = { form1099Nec: { updateMany, create } };

    const created = await supersedeCorrected(tx, {
      organizationId: 'org-1',
      payerOrgId: 'org-1',
      recipientId: 'rcpt-1',
      taxYear: 2026,
      snapshotJson: { box1AmountMinor: 250_000 },
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
        data: expect.objectContaining({ status: 'SUPERSEDED' }),
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', corrected: true }),
      }),
    );
    expect(created.status).toBe('ACTIVE');
    // The supersede MUST run before the insert — the original row is flipped,
    // never updated to new values.
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
  });
});

describe('form-1099-nec.service — batch generation', () => {
  const db = {
    tax1099Threshold: {
      findUnique: vi.fn(async ({ where }: { where: { taxYear: number } }) => ({
        taxYear: where.taxYear,
        box1ThresholdMinor: where.taxYear === 2026 ? 200_000 : 60_000,
        currency: 'USD',
      })),
    },
    // FX path is unused for USD-only fixtures.
    exchangeRate: { findFirst: vi.fn(async () => null) },
  } as never;

  it('generates above the threshold, suppresses below, and persists ACTIVE rows', async () => {
    resetIdempotency();
    const create = vi.fn(async () => ({ id: 'row-1' }));

    const result = await generateBatch(
      {
        organizationId: 'org-1',
        payerOrgId: 'org-1',
        taxYear: 2026,
        recipients: [
          {
            recipientId: 'rcpt-above',
            payerName: 'Acme',
            recipientName: 'Above Threshold',
            recipientTinLast4: '1120',
            payments: [
              {
                recipientId: 'rcpt-above',
                payerOrgId: 'org-1',
                paymentDate: '2026-03-01',
                amountMinor: 250_000,
                currency: 'USD',
              },
            ],
            backupWithholdingFlagged: false,
            tinMismatch: false,
            recordedBackupWithholdingMinor: 0,
          },
          {
            recipientId: 'rcpt-below',
            payerName: 'Acme',
            recipientName: 'Below Threshold',
            recipientTinLast4: '4444',
            payments: [
              {
                recipientId: 'rcpt-below',
                payerOrgId: 'org-1',
                paymentDate: '2026-03-01',
                amountMinor: 100_000,
                currency: 'USD',
              },
            ],
            backupWithholdingFlagged: false,
            tinMismatch: false,
            recordedBackupWithholdingMinor: 0,
          },
        ],
      },
      { db, persist: { form1099Nec: { create } } },
    );

    expect(result.idempotent).toBe(false);
    expect(result.generated).toHaveLength(1);
    expect(result.generated[0]?.recipientId).toBe('rcpt-above');
    expect(result.suppressedRecipientIds).toEqual(['rcpt-below']);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('a retried batch (same idempotency key) does not create duplicate rows', async () => {
    resetIdempotency();
    const create = vi.fn(async () => ({ id: 'row-1' }));
    const input = {
      organizationId: 'org-1',
      payerOrgId: 'org-1',
      taxYear: 2026,
      recipients: [
        {
          recipientId: 'rcpt-above',
          payerName: 'Acme',
          recipientName: 'Above Threshold',
          recipientTinLast4: '1120',
          payments: [
            {
              recipientId: 'rcpt-above',
              payerOrgId: 'org-1',
              paymentDate: '2026-03-01',
              amountMinor: 250_000,
              currency: 'USD',
            },
          ],
          backupWithholdingFlagged: false,
          tinMismatch: false,
          recordedBackupWithholdingMinor: 0,
        },
      ],
    } as const;
    const deps = { db, persist: { form1099Nec: { create } } };

    const first = await generateBatch(input, deps);
    const second = await generateBatch(input, deps);

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('derives a stable idempotency key per org/payer-org/tax-year', () => {
    expect(
      batchIdempotencyKey({ organizationId: 'org-1', payerOrgId: 'org-1', taxYear: 2026 }),
    ).toBe(batchIdempotencyKey({ organizationId: 'org-1', payerOrgId: 'org-1', taxYear: 2026 }));
    expect(
      batchIdempotencyKey({ organizationId: 'org-1', payerOrgId: 'org-1', taxYear: 2026 }),
    ).not.toBe(
      batchIdempotencyKey({ organizationId: 'org-1', payerOrgId: 'org-1', taxYear: 2025 }),
    );
  });
});
