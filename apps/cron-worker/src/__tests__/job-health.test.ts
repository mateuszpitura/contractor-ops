/**
 * Unit tests for the `job-health` cron handler (webhook reaper + alerts).
 *
 * Coverage:
 *   1. No stale deliveries → ok=true + healthy.
 *   2. Stale delivery under the attempt cap → re-enqueued to QStash.
 *   3. Stale delivery at the attempt cap → flipped to FAILED.
 *   4. Delivery query throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDeliveryFindMany,
  mockDeliveryUpdate,
  mockDeliveryUpdateMany,
  mockDeliveryCount,
  mockQueueWebhook,
  mockGauge,
  mockCaptureException,
  mockCaptureMessage,
} = vi.hoisted(() => ({
  mockDeliveryFindMany: vi.fn(),
  mockDeliveryUpdate: vi.fn(),
  mockDeliveryUpdateMany: vi.fn(),
  mockDeliveryCount: vi.fn(),
  mockQueueWebhook: vi.fn(),
  mockGauge: vi.fn(),
  mockCaptureException: vi.fn(),
  mockCaptureMessage: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    webhookDelivery: {
      findMany: mockDeliveryFindMany,
      update: mockDeliveryUpdate,
      updateMany: mockDeliveryUpdateMany,
      count: mockDeliveryCount,
    },
  },
}));

vi.mock('@contractor-ops/integrations/services/webhook-dispatcher', () => ({
  queueWebhookProcessing: mockQueueWebhook,
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: mockGauge, increment: vi.fn() },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: mockCaptureMessage },
}));

import { jobHealthHandler } from '../jobs/handlers/job-health.js';
import { makeJobContext } from './_helpers.js';

const STALE_RECEIVED_AT = new Date(Date.now() - 60 * 60 * 1000);

function staleDelivery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wd-1',
    provider: 'STRIPE',
    organizationId: 'org-1',
    eventType: 'payment_intent.succeeded',
    receivedAt: STALE_RECEIVED_AT,
    deliveryStatus: 'RECEIVED',
    attempts: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDeliveryFindMany.mockResolvedValue([]);
  mockDeliveryUpdate.mockResolvedValue({});
  mockDeliveryUpdateMany.mockResolvedValue({ count: 0 });
  mockDeliveryCount.mockResolvedValue(0);
  mockQueueWebhook.mockResolvedValue(undefined);
});

describe('jobHealthHandler', () => {
  it('returns ok=true and healthy when there are no stale deliveries', async () => {
    const result = await jobHealthHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({
      staleRetried: 0,
      staleCleared: 0,
      healthy: true,
    });
  });

  it('re-enqueues a stale delivery that is under the attempt cap', async () => {
    mockDeliveryFindMany.mockResolvedValue([staleDelivery({ attempts: 1 })]);

    const result = await jobHealthHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ staleRetried: 1, staleCleared: 0 });
    expect(mockDeliveryUpdate).toHaveBeenCalledTimes(1);
    expect(mockQueueWebhook).toHaveBeenCalledWith('wd-1', 'stripe');
  });

  it('flips a stale delivery at the attempt cap to FAILED', async () => {
    mockDeliveryFindMany.mockResolvedValue([staleDelivery({ attempts: 4 })]);

    const result = await jobHealthHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ staleRetried: 0, staleCleared: 1 });
    expect(mockDeliveryUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockQueueWebhook).not.toHaveBeenCalled();
  });

  it('returns ok=false and reports to Sentry when the delivery query throws', async () => {
    mockDeliveryFindMany.mockRejectedValue(new Error('neon connection refused'));

    const result = await jobHealthHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'neon connection refused' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
