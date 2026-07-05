/**
 * RED contract — INTEG-WEBHOOK-03 (retry backoff + DLQ + poison isolation + alert).
 * Turned GREEN by 100-06 (`services/webhooks/dispatcher.ts` + the outbox fan-out handler).
 *
 * Delivery retries follow the fixed webhook backoff [1m,5m,30m,2h,12h,24h] to a
 * max of 6 attempts; on exhaustion the attempt moves to the `webhook_failures`
 * DLQ (status DEAD). A poison row (one subscription that throws during fan-out)
 * must never stall its siblings. Nothing here contacts a real external URL.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const DISPATCHER_MODULE = '../services/webhooks/dispatcher';

const EXPECTED_SCHEDULE = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000, 86_400_000];

describe('webhook backoff schedule (INTEG-WEBHOOK-03)', () => {
  it('is exactly [1m,5m,30m,2h,12h,24h] with a max of 6 attempts', async () => {
    const mod = (await import(DISPATCHER_MODULE)) as Record<string, unknown>;
    expect(mod.WEBHOOK_BACKOFF_SCHEDULE_MS).toEqual(EXPECTED_SCHEDULE);
    expect(mod.WEBHOOK_MAX_ATTEMPTS).toBe(6);
  });

  it('schedules the next attempt per the schedule, then dead-letters after attempt 6', async () => {
    const mod = (await import(DISPATCHER_MODULE)) as Record<string, unknown>;
    const nextWebhookAttempt = mod.nextWebhookAttempt as (
      completedAttempts: number,
      maxRetries?: number,
    ) => { action: string; delayMs?: number };

    expect(nextWebhookAttempt(1)).toEqual({ action: 'retry', delayMs: 60_000 });
    expect(nextWebhookAttempt(2)).toEqual({ action: 'retry', delayMs: 300_000 });
    expect(nextWebhookAttempt(3)).toEqual({ action: 'retry', delayMs: 1_800_000 });
    expect(nextWebhookAttempt(4)).toEqual({ action: 'retry', delayMs: 7_200_000 });
    expect(nextWebhookAttempt(5)).toEqual({ action: 'retry', delayMs: 43_200_000 });
    expect(nextWebhookAttempt(6)).toEqual({ action: 'dead-letter' });
  });
});

// ---------------------------------------------------------------------------
// Fan-out poison isolation (INTEG-WEBHOOK-03) — mocked prisma, no network I/O.
// ---------------------------------------------------------------------------

const { prismaMock, enqueueJobMock } = vi.hoisted(() => {
  const prismaMock = {
    webhookSubscription: { findMany: vi.fn() },
    webhookDeliveryAttempt: { create: vi.fn() },
  };
  return { prismaMock, enqueueJobMock: vi.fn(async () => undefined) };
});

vi.mock('@contractor-ops/db', () => ({ prisma: prismaMock, prismaRaw: prismaMock }));
vi.mock('../services/queue', () => ({ enqueueJob: enqueueJobMock }));
vi.mock('@contractor-ops/logger', () => {
  const stub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { createLogger: vi.fn(() => stub) };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fan-out poison isolation (INTEG-WEBHOOK-03) — RED until 100-06', () => {
  it('a subscription whose attempt-create throws does not stall its siblings', async () => {
    const mod = (await import('../services/outbox/handlers')) as Record<string, unknown>;
    const registry = mod.outboxHandlerRegistry as
      | Record<string, (payload: unknown, ctx: unknown) => Promise<void>>
      | undefined;
    const handler = registry?.['integration.webhook.publish'];
    expect(handler).toBeDefined();

    prismaMock.webhookSubscription.findMany.mockResolvedValue([
      { id: 'whsub_poison', url: 'https://a.example.com', includePii: false, enabled: true },
      { id: 'whsub_ok', url: 'https://b.example.com', includePii: false, enabled: true },
    ]);
    prismaMock.webhookDeliveryAttempt.create
      .mockRejectedValueOnce(new Error('poison row'))
      .mockResolvedValueOnce({ id: 'whatt_ok' });

    await handler?.(
      { eventType: 'invoice.paid', data: { invoiceId: 'inv_1' } },
      { outboxEventId: 'oxe_1', organizationId: 'org_1' },
    );

    // The healthy sibling still got an attempt + a delivery enqueue.
    expect(prismaMock.webhookDeliveryAttempt.create).toHaveBeenCalledTimes(2);
    expect(enqueueJobMock).toHaveBeenCalledWith(
      'webhook.deliver',
      { attemptId: 'whatt_ok' },
      expect.objectContaining({ dedupId: 'whatt_ok' }),
    );
  });
});
