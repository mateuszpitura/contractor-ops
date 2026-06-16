// form-1099-nec.service — Wave-0 RED scaffold (US-FORM-04).
//
// Exercises the year-end 1099-NEC generation logic:
//   - box-1 nonemployee comp aggregated by payment (settlement) date within the
//     calendar tax year, non-USD payouts FX-converted to USD at the
//     payment-date rate, aggregated per recipient per payer-org (D-06);
//   - a tax-year-keyed threshold table gates generation: $600 TY2025 vs $2,000
//     TY2026 (OBBBA, Pitfall 1) — never a constant;
//   - CORRECTED = supersede chain (prior ACTIVE -> SUPERSEDED, new ACTIVE
//     inserted in one transaction; the original is never mutated) (D-08).
//
// The service does not exist yet, so this suite fails at module resolution —
// terminal-RED accepted for Wave 0.

import { describe, expect, it, vi } from 'vitest';
// The implementation does not exist yet — Wave-0 RED (resolution-fail).
import { aggregateBox1, isAboveThreshold, supersedeCorrected } from '../form-1099-nec.service';

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

describe('form-1099-nec.service — box-1 aggregation (US-FORM-04 / D-06)', () => {
  it('aggregates box-1 by payment date per recipient per payer-org, FX-converted to USD', () => {
    const usd = aggregateBox1({
      taxYear: 2026,
      recipientId: 'rcpt-1',
      payerOrgId: 'org-1',
      payments,
    });

    expect(usd.box1AmountMinor).toBe(150_000);
  });
});

describe('form-1099-nec.service — tax-year threshold (US-FORM-04 / Pitfall 1)', () => {
  it('gates at $600 for TY2025 and $2,000 for TY2026', () => {
    expect(isAboveThreshold({ taxYear: 2025, box1AmountMinor: 80_000 })).toBe(true); // > $600
    expect(isAboveThreshold({ taxYear: 2026, box1AmountMinor: 80_000 })).toBe(false); // < $2,000
    expect(isAboveThreshold({ taxYear: 2026, box1AmountMinor: 250_000 })).toBe(true); // > $2,000
  });
});

describe('form-1099-nec.service — CORRECTED supersede chain (US-FORM-04 / D-08)', () => {
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
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUPERSEDED' }) }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
    expect(created.status).toBe('ACTIVE');
    // supersede MUST run before the insert.
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
  });
});
