/**
 * Unit tests for the `trial-notifications` cron handler.
 *
 * Coverage:
 *   1. Advisory lock not acquired → ok=true + skippedLocked.
 *   2. Lock acquired, no trialing subscriptions → ok=true + processed 0.
 *   3. Subscription 7 days from trial end → notification dispatched.
 *   4. NotificationCronDedup P2002 → counted as skippedDedup, not sent.
 *   5. Transaction throws → ok=false + Sentry capture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockTransaction,
  mockTryAcquireLock,
  mockSubscriptionFindMany,
  mockDedupCreate,
  mockDispatch,
  mockSendAppEmail,
  mockCaptureException,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockTryAcquireLock: vi.fn(),
  mockSubscriptionFindMany: vi.fn(),
  mockDedupCreate: vi.fn(),
  mockDispatch: vi.fn(),
  mockSendAppEmail: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/lib/advisory-lock', () => ({
  tryAcquireXactLock: mockTryAcquireLock,
}));

vi.mock('@contractor-ops/api/services/app-email', () => ({
  sendAppEmail: mockSendAppEmail,
}));

vi.mock('@contractor-ops/api/services/notification-service', () => ({
  dispatch: mockDispatch,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    subscription: { findMany: mockSubscriptionFindMany },
    notificationCronDedup: { create: mockDedupCreate },
  },
  prismaRaw: { $transaction: mockTransaction },
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn() },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { trialNotificationsHandler } from '../jobs/handlers/trial-notifications.js';
import { makeJobContext } from './_helpers.js';

/** Subscription whose trial ends ~7 days out (maps to the 7-day template). */
function trialingSub() {
  return {
    trialEnd: new Date(Date.now() + 6.5 * 24 * 60 * 60 * 1000),
    organization: {
      id: 'org-1',
      billingEmail: null,
      members: [{ userId: 'user-1' }],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({}));
  mockTryAcquireLock.mockResolvedValue(true);
  mockSubscriptionFindMany.mockResolvedValue([]);
  mockDedupCreate.mockResolvedValue({});
  mockDispatch.mockResolvedValue(undefined);
});

describe('trialNotificationsHandler', () => {
  it('skips with ok=true when the advisory lock is not acquired', async () => {
    mockTryAcquireLock.mockResolvedValue(false);

    const result = await trialNotificationsHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ skippedLocked: true });
    expect(mockSubscriptionFindMany).not.toHaveBeenCalled();
  });

  it('returns ok=true with processed 0 when no subscriptions are trialing', async () => {
    const result = await trialNotificationsHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ processed: 0, notificationsSent: 0 });
  });

  it('dispatches a notification for a subscription 7 days from trial end', async () => {
    mockSubscriptionFindMany.mockResolvedValue([trialingSub()]);

    const result = await trialNotificationsHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ processed: 1, notificationsSent: 1, skippedDedup: 0 });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('counts a P2002 dedup collision as skippedDedup, not sent', async () => {
    mockSubscriptionFindMany.mockResolvedValue([trialingSub()]);
    mockDedupCreate.mockRejectedValue({ code: 'P2002' });

    const result = await trialNotificationsHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ notificationsSent: 0, skippedDedup: 1 });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('returns ok=false and reports to Sentry when the transaction throws', async () => {
    mockTransaction.mockRejectedValue(new Error('lock wait timeout'));

    const result = await trialNotificationsHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'lock wait timeout' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
