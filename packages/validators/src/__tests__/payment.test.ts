import { describe, expect, it } from 'vitest';
import {
  bankStatementConfirmSchema,
  markAllPaidSchema,
  paymentRunCancelSchema,
  paymentRunCreateSchema,
  paymentRunItemStatusSchema,
  paymentRunListSchema,
  paymentRunLockSchema,
  readyForPaymentListSchema,
  removeFromRunSchema,
} from '../payment.js';

const cuidLike = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';

describe('paymentRunCreateSchema', () => {
  it('accepts one invoice id', () => {
    const r = paymentRunCreateSchema.safeParse({
      invoiceIds: [cuidLike],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.groupByCurrency).toBe(false);
    }
  });

  it('rejects empty invoiceIds', () => {
    const r = paymentRunCreateSchema.safeParse({ invoiceIds: [] });
    expect(r.success).toBe(false);
  });

  it('rejects non-cuid invoice id', () => {
    const r = paymentRunCreateSchema.safeParse({
      invoiceIds: ['not-a-cuid'],
    });
    expect(r.success).toBe(false);
  });
});

describe('paymentRunLockSchema', () => {
  it('accepts runId + export format', () => {
    const r = paymentRunLockSchema.safeParse({
      runId: cuidLike,
      exportFormat: 'SEPA_XML',
    });
    expect(r.success).toBe(true);
  });
});

describe('paymentRunItemStatusSchema', () => {
  it('requires failureReason when status is FAILED', () => {
    const bad = paymentRunItemStatusSchema.safeParse({
      itemId: cuidLike,
      status: 'FAILED',
    });
    expect(bad.success).toBe(false);

    const good = paymentRunItemStatusSchema.safeParse({
      itemId: cuidLike,
      status: 'FAILED',
      failureReason: 'Bank rejected',
    });
    expect(good.success).toBe(true);
  });

  it('allows PAID without failureReason', () => {
    const r = paymentRunItemStatusSchema.safeParse({
      itemId: cuidLike,
      status: 'PAID',
      paymentReference: 'REF-1',
    });
    expect(r.success).toBe(true);
  });
});

describe('paymentRunListSchema', () => {
  it('applies defaults', () => {
    const r = paymentRunListSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.limit).toBe(20);
      expect(r.data.sortOrder).toBe('desc');
    }
  });

  it('rejects limit above 100', () => {
    const r = paymentRunListSchema.safeParse({ limit: 200 });
    expect(r.success).toBe(false);
  });
});

describe('paymentRunCancelSchema', () => {
  it('accepts cuid runId', () => {
    const r = paymentRunCancelSchema.safeParse({ runId: cuidLike });
    expect(r.success).toBe(true);
  });
});

describe('markAllPaidSchema', () => {
  it('accepts runId only', () => {
    const r = markAllPaidSchema.safeParse({ runId: cuidLike });
    expect(r.success).toBe(true);
  });
});

describe('bankStatementConfirmSchema', () => {
  it('accepts matches array', () => {
    const r = bankStatementConfirmSchema.safeParse({
      runId: cuidLike,
      matches: [{ itemId: cuidLike, transactionIndex: 0 }],
    });
    expect(r.success).toBe(true);
  });
});

describe('readyForPaymentListSchema', () => {
  it('applies default limit', () => {
    const r = readyForPaymentListSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.limit).toBe(50);
    }
  });
});

describe('removeFromRunSchema', () => {
  it('accepts run + invoice cuids', () => {
    const r = removeFromRunSchema.safeParse({
      runId: cuidLike,
      invoiceId: cuidLike,
    });
    expect(r.success).toBe(true);
  });
});
