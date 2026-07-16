/**
 * Round-trip seam test for the outbound-webhook producer.
 *
 * The seam is: a domain mutation → `enqueueWebhookEvent` → the transactional
 * outbox. The FAR side (the real `enqueueOutboxEvent` that serialises the
 * envelope and writes the `OutboxEvent` row) is NOT mocked — only the Prisma
 * client is a capturing fake. So a green assertion here proves a real mutation
 * durably schedules a real `integration.webhook.publish` row carrying the
 * business event, which the fan-out handler then delivers.
 */

import { describe, expect, it, vi } from 'vitest';

import { applyInvoicePaymentOutcome } from '../routers/finance/payment-shared';

describe('outbound-webhook producer seam', () => {
  it('a settled invoice emits a real integration.webhook.publish outbox row carrying invoice.paid', async () => {
    const executeRawUnsafe = vi.fn(async () => 1);
    const paidInvoice = {
      id: 'inv_seam_1',
      invoiceNumber: 'INV-SEAM-1',
      status: 'PAID',
      paymentStatus: 'PAID',
      amountToPayMinor: 1000,
    };

    const tx = {
      invoicePayment: {
        create: vi.fn(async () => ({ id: 'ipay_1' })),
        aggregate: vi.fn(async () => ({ _sum: { amountMinor: 1000 } })),
      },
      invoice: {
        findUnique: vi.fn(async () => ({ amountToPayMinor: 1000 })),
        update: vi.fn(async () => paidInvoice),
      },
      $executeRaw: vi.fn(async () => 1),
      $executeRawUnsafe: executeRawUnsafe,
    };

    await applyInvoicePaymentOutcome(tx as never, {
      organizationId: 'org_seam_1',
      invoiceId: 'inv_seam_1',
      amountMinor: 1000,
      paidAt: new Date('2026-07-17T00:00:00.000Z'),
      sourceKind: 'PAYMENT_RUN',
    });

    // Exactly one outbox insert — the real enqueueOutboxEvent, no mock on this side.
    expect(executeRawUnsafe).toHaveBeenCalledTimes(1);

    const args = executeRawUnsafe.mock.calls[0] ?? [];
    const [sql, , orgArg, eventTypeArg, aggregateTypeArg, aggregateIdArg, payloadStr] = args as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];

    expect(sql).toMatch(/INSERT INTO "OutboxEvent"/);
    expect(orgArg).toBe('org_seam_1');
    expect(eventTypeArg).toBe('integration.webhook.publish');
    expect(aggregateTypeArg).toBe('webhook');
    expect(aggregateIdArg).toBe('inv_seam_1');

    const payload = JSON.parse(payloadStr) as {
      eventType: string;
      aggregateId: string;
      data: { id: string; paymentStatus: string };
    };
    expect(payload.eventType).toBe('invoice.paid');
    expect(payload.aggregateId).toBe('inv_seam_1');
    expect(payload.data.id).toBe('inv_seam_1');
    expect(payload.data.paymentStatus).toBe('PAID');
  });

  it('a partial payment does NOT emit invoice.paid', async () => {
    const executeRawUnsafe = vi.fn(async () => 1);
    const tx = {
      invoicePayment: {
        create: vi.fn(async () => ({ id: 'ipay_2' })),
        aggregate: vi.fn(async () => ({ _sum: { amountMinor: 400 } })),
      },
      invoice: {
        findUnique: vi.fn(async () => ({ amountToPayMinor: 1000 })),
        update: vi.fn(async () => ({ id: 'inv_seam_2', paymentStatus: 'PARTIALLY_PAID' })),
      },
      $executeRaw: vi.fn(async () => 1),
      $executeRawUnsafe: executeRawUnsafe,
    };

    await applyInvoicePaymentOutcome(tx as never, {
      organizationId: 'org_seam_1',
      invoiceId: 'inv_seam_2',
      amountMinor: 400,
      paidAt: new Date('2026-07-17T00:00:00.000Z'),
      sourceKind: 'PAYMENT_RUN',
    });

    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });
});
