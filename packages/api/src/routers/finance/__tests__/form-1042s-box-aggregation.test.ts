// Form 1042-S box-2 / box-7 aggregation invariants (Fable review C-14).
//
// Box 2 gross income FX-converts non-USD settled payouts to USD minor units.
// Box 7 federal tax withheld sums recorded whtAmountMinor from the payment-run
// ledger — never a recomputation from box 2 × the current treaty rate.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConvertAmount = vi.fn();

vi.mock('../../../services/exchange-rate', () => ({
  convertAmount: (...args: unknown[]) => mockConvertAmount(...args),
  FX_CONVERSION_MAX_AGE_DAYS: 7,
}));

import { aggregateBox2GrossMinor, aggregateBox7WithheldMinor } from '../form-1042s-router';

const ORG = 'org-1';
const CONTRACTOR = 'c-1';
const TAX_YEAR = 2026;
const PAYMENT_DATE = new Date(Date.UTC(2026, 5, 15));

function makeDb(
  items: Array<{
    grossAmountMinor: number | null;
    amountMinor: number;
    currency: string;
    whtAmountMinor?: number | null;
  }>,
) {
  return {
    paymentRunItem: {
      findMany: vi.fn(async ({ select }: { select: Record<string, unknown> }) => {
        const rows = items.map((item, i) => ({
          id: `item-${i}`,
          grossAmountMinor: item.grossAmountMinor,
          amountMinor: item.amountMinor,
          currency: item.currency,
          whtAmountMinor: item.whtAmountMinor ?? null,
          paymentRun: { completedAt: PAYMENT_DATE },
        }));
        if ('whtAmountMinor' in select && !('grossAmountMinor' in select)) {
          return rows.map(({ whtAmountMinor, currency, paymentRun }) => ({
            whtAmountMinor,
            currency,
            paymentRun,
          }));
        }
        return rows;
      }),
    },
  };
}

beforeEach(() => {
  mockConvertAmount.mockReset();
  mockConvertAmount.mockImplementation(
    async (_db, amountMinor: number, from: string, to: string) => ({
      amountMinor: from === 'EUR' && to === 'USD' ? Math.round(amountMinor * 1.1) : amountMinor,
      rate: 1.1,
      rateDate: PAYMENT_DATE,
    }),
  );
});

describe('1042-S box aggregation — recorded withholding vs gross FX (C-14)', () => {
  it('box 7 sums recorded whtAmountMinor instead of recomputing box 2 × rate', async () => {
    const db = makeDb([
      {
        grossAmountMinor: 100_000,
        amountMinor: 70_000,
        currency: 'USD',
        whtAmountMinor: 25_000,
      },
    ]);

    const box2 = await aggregateBox2GrossMinor(db, ORG, CONTRACTOR, TAX_YEAR);
    const box7 = await aggregateBox7WithheldMinor(db, ORG, CONTRACTOR, TAX_YEAR);

    expect(box2).toBe(100_000);
    expect(box7).toBe(25_000);
    expect(box7).not.toBe(Math.round(box2 * 0.3));
  });

  it('box 2 FX-converts non-USD gross while box 7 sums recorded non-USD wht (FX-converted)', async () => {
    const db = makeDb([
      {
        grossAmountMinor: 100_000,
        amountMinor: 70_000,
        currency: 'EUR',
        whtAmountMinor: 25_000,
      },
    ]);

    const box2 = await aggregateBox2GrossMinor(db, ORG, CONTRACTOR, TAX_YEAR);
    const box7 = await aggregateBox7WithheldMinor(db, ORG, CONTRACTOR, TAX_YEAR);

    expect(mockConvertAmount).toHaveBeenCalledWith(db, 100_000, 'EUR', 'USD', PAYMENT_DATE, 7);
    expect(box2).toBe(110_000);
    expect(mockConvertAmount).toHaveBeenCalledWith(db, 25_000, 'EUR', 'USD', PAYMENT_DATE, 7);
    expect(box7).toBe(27_500);
    expect(box7).not.toBe(Math.round(box2 * 0.3));
  });
});
