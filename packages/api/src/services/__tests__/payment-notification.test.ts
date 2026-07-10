import { describe, expect, it, vi } from 'vitest';
import {
  enqueuePaymentRunBatchPaidNotification,
  enqueuePaymentStatusNotification,
} from '../payment-notification';

const enqueueMock = vi.hoisted(() => vi.fn().mockResolvedValue('outbox-1'));

vi.mock('../outbox', () => ({
  enqueueNotificationOutboxEvent: (...args: unknown[]) => enqueueMock(...args),
}));

describe('payment-notification helpers', () => {
  it('enqueuePaymentStatusNotification no-ops with zero recipients', async () => {
    await enqueuePaymentStatusNotification({} as never, {
      organizationId: 'org-1',
      paymentRunId: 'run-1',
      itemId: 'item-1',
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-1',
      status: 'PAID',
      amountMinor: 10_000,
      currency: 'EUR',
      recipientUserIds: [],
    });

    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('enqueuePaymentStatusNotification enqueues PAYMENT_FAILED for failed items', async () => {
    enqueueMock.mockClear();

    await enqueuePaymentStatusNotification({} as never, {
      organizationId: 'org-1',
      paymentRunId: 'run-1',
      runNumber: 'PR-42',
      itemId: 'item-1',
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-1',
      status: 'FAILED',
      amountMinor: 50_000,
      currency: 'USD',
      failureReason: 'ACH return R01',
      recipientUserIds: ['user-finance'],
    });

    expect(enqueueMock).toHaveBeenCalledOnce();
    const call = enqueueMock.mock.calls[0]?.[0] as {
      event: { type: string; recipientUserIds: string[]; title: string };
      dedupKey: string;
    };
    expect(call.event.type).toBe('PAYMENT_FAILED');
    expect(call.event.recipientUserIds).toEqual(['user-finance']);
    expect(call.event.title).toContain('INV-1');
    expect(call.dedupKey).toBe('payment-failed:item-1');
  });

  it('enqueuePaymentRunBatchPaidNotification enqueues a batch PAYMENT_COMPLETED', async () => {
    enqueueMock.mockClear();

    await enqueuePaymentRunBatchPaidNotification({} as never, {
      organizationId: 'org-1',
      paymentRunId: 'run-1',
      runNumber: 'PR-7',
      itemCount: 3,
      recipientUserIds: ['user-finance'],
    });

    expect(enqueueMock).toHaveBeenCalledOnce();
    const call = enqueueMock.mock.calls[0]?.[0] as {
      event: { type: string; body: string };
      dedupKey: string;
    };
    expect(call.event.type).toBe('PAYMENT_COMPLETED');
    expect(call.event.body).toContain('3 invoice(s)');
    expect(call.dedupKey).toBe('payment-completed-batch:run-1');
  });
});
