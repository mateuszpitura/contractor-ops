import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import type { TenantScopedDb } from '../lib/tenant-db';
import type { OutboxTransactionalClient } from './outbox';
import { enqueueNotificationOutboxEvent } from './outbox';

/** Finance roles that receive contractor payout status notifications. */
export async function getPaymentNotifyUserIds(
  db: TenantScopedDb,
  organizationId: string,
): Promise<string[]> {
  const members = await db.member.findMany({
    where: {
      organizationId,
      disabledAt: null,
      role: { in: ['finance_admin', 'external_accountant'] },
    },
    select: { userId: true },
  });
  return members.map((m: { userId: string }) => m.userId);
}

export interface PaymentStatusNotificationParams {
  organizationId: string;
  paymentRunId: string;
  runNumber?: string | null;
  itemId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  status: 'PAID' | 'FAILED';
  amountMinor: number;
  currency: string;
  failureReason?: string | null;
  recipientUserIds: string[];
}

/**
 * Enqueue a finance-team notification for a payment-run item reaching PAID or
 * FAILED. Uses the transactional outbox so delivery commits with the payout
 * mutation.
 */
export async function enqueuePaymentStatusNotification(
  tx: OutboxTransactionalClient,
  params: PaymentStatusNotificationParams,
): Promise<void> {
  if (params.recipientUserIds.length === 0) return;

  const amount = minorToMajor(params.amountMinor, params.currency).toFixed(
    minorUnitDigits(params.currency),
  );
  const invLabel = params.invoiceNumber ?? params.invoiceId.slice(-8);
  const runLabel = params.runNumber ?? params.paymentRunId.slice(-8);
  const isPaid = params.status === 'PAID';
  const type = isPaid ? ('PAYMENT_COMPLETED' as const) : ('PAYMENT_FAILED' as const);
  const title = isPaid ? `Payment completed: ${invLabel}` : `Payment failed: ${invLabel}`;
  const body = isPaid
    ? `Invoice ${invLabel} (${amount} ${params.currency}) marked paid in run ${runLabel}.`
    : `Invoice ${invLabel} (${amount} ${params.currency}) failed in run ${runLabel}${
        params.failureReason ? `: ${params.failureReason}` : '.'
      }`;

  await enqueueNotificationOutboxEvent({
    tx,
    event: {
      organizationId: params.organizationId,
      type,
      recipientUserIds: params.recipientUserIds,
      title,
      body,
      entityType: 'PAYMENT_RUN',
      entityId: params.paymentRunId,
      metadata: {
        invoiceNumber: params.invoiceNumber,
        amount,
        currency: params.currency,
        status: params.status,
        runNumber: params.runNumber,
        ...(params.failureReason ? { failureReason: params.failureReason } : {}),
      },
    },
    dedupKey: `payment-${params.status.toLowerCase()}:${params.itemId}`,
  });
}

/**
 * Enqueue a single batch notification when an entire run (or a bulk confirm)
 * marks multiple items paid at once.
 */
export async function enqueuePaymentRunBatchPaidNotification(
  tx: OutboxTransactionalClient,
  params: {
    organizationId: string;
    paymentRunId: string;
    runNumber?: string | null;
    itemCount: number;
    recipientUserIds: string[];
  },
): Promise<void> {
  if (params.recipientUserIds.length === 0 || params.itemCount === 0) return;

  const runLabel = params.runNumber ?? params.paymentRunId.slice(-8);
  const title = `Payment run ${runLabel} completed`;
  const body = `${params.itemCount} invoice(s) marked paid in run ${runLabel}.`;

  await enqueueNotificationOutboxEvent({
    tx,
    event: {
      organizationId: params.organizationId,
      type: 'PAYMENT_COMPLETED',
      recipientUserIds: params.recipientUserIds,
      title,
      body,
      entityType: 'PAYMENT_RUN',
      entityId: params.paymentRunId,
      metadata: { runNumber: params.runNumber, itemCount: params.itemCount },
    },
    dedupKey: `payment-completed-batch:${params.paymentRunId}`,
  });
}
