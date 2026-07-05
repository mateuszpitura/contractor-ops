// Producer-side helper for the HRIS push.
//
// A CO business mutation (invoice-paid / payment-status / classification-
// outcome) calls this INSIDE its committing `$transaction` so the outbox row
// commits iff the business write commits — the mutation never calls the adapter
// inline. The push is enqueued ONLY when the subject worker is an EMPLOYEE
// (contractor business events do not push to an HRIS); the `dedupKey` collapses
// a retried producer transaction to a single enqueue.

import type { OutboxEventPayloadMap } from './handlers';
import type { OutboxTransactionalClient } from './index';
import { enqueueOutboxEvent } from './index';

type HrisPushEventType =
  | 'hris.invoice-paid.push'
  | 'hris.payment-status.push'
  | 'hris.classification-outcome.push';

interface WorkerTypeReader {
  worker: {
    findUnique: (args: {
      where: { id: string };
      select: { workerType: true };
    }) => Promise<{ workerType: string } | null>;
  };
}

/**
 * Enqueue an HRIS push for a business event — a no-op unless the subject worker
 * is an EMPLOYEE. Must be called inside the mutation's `$transaction` (`tx`
 * carries both the worker lookup and the outbox insert).
 */
export async function enqueueHrisEmployeePush<T extends HrisPushEventType>(
  tx: OutboxTransactionalClient & WorkerTypeReader,
  params: {
    organizationId: string;
    workerId: string;
    eventType: T;
    payload: OutboxEventPayloadMap[T];
    businessEventId: string;
  },
): Promise<void> {
  const worker = await tx.worker.findUnique({
    where: { id: params.workerId },
    select: { workerType: true },
  });
  if (worker?.workerType !== 'EMPLOYEE') return;

  await enqueueOutboxEvent({
    tx,
    organizationId: params.organizationId,
    eventType: params.eventType,
    payload: params.payload as unknown as Record<string, unknown>,
    dedupKey: `${params.workerId}:${params.eventType}:${params.businessEventId}`,
    aggregateType: 'WORKER',
    aggregateId: params.workerId,
  });
}
