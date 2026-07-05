/**
 * Unit tests for the `stripe-reconcile` cron handler.
 *
 * Coverage:
 *   1. A DB row whose status/tier drifted from Stripe is repaired.
 *   2. A row already matching Stripe is left untouched (idempotent).
 *   3. A Stripe subscription with no DB row is counted as orphaned, not written.
 *   4. Subscriptions without an organizationId in metadata are skipped.
 *   5. A thrown error yields ok=false + Sentry capture.
 *
 * `buildSubscriptionData` runs for real (status mapping is the unit under test);
 * only the Stripe list, price→tier resolver, prisma, and Sentry are mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStripeList, mockFindUnique, mockUpdate, mockResolveTier, mockCaptureException } =
  vi.hoisted(() => ({
    mockStripeList: vi.fn(),
    mockFindUnique: vi.fn(),
    mockUpdate: vi.fn(),
    mockResolveTier: vi.fn(),
    mockCaptureException: vi.fn(),
  }));

vi.mock('@contractor-ops/api/services/stripe-client', () => ({
  stripe: { subscriptions: { list: mockStripeList } },
}));

vi.mock('@contractor-ops/api/services/billing-constants', () => ({
  resolveTierFromPriceId: mockResolveTier,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    subscription: { findUnique: mockFindUnique, update: mockUpdate },
  },
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn() },
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { captureException: mockCaptureException, captureMessage: vi.fn() },
}));

import { stripeReconcileHandler } from '../jobs/handlers/stripe-reconcile.js';
import { makeJobContext } from './_helpers.js';

function asyncIterableOf<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

function stripeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    cancel_at_period_end: false,
    trial_end: null,
    start_date: 1700000000,
    current_period_start: 1700000000,
    current_period_end: 1702592000,
    metadata: { organizationId: 'org_1' },
    items: { data: [{ id: 'si_1', quantity: 1, price: { id: 'price_pro' } }] },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTier.mockReturnValue('PRO');
  mockUpdate.mockResolvedValue({});
  mockStripeList.mockReturnValue(asyncIterableOf([]));
});

describe('stripeReconcileHandler', () => {
  it('repairs a DB row whose status drifted from Stripe', async () => {
    mockStripeList.mockReturnValue(asyncIterableOf([stripeSub({ status: 'canceled' })]));
    mockFindUnique.mockResolvedValue({ status: 'ACTIVE', tier: 'PRO' });

    const result = await stripeReconcileHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 1, repaired: 1, orphaned: 0 });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_1' },
        data: expect.objectContaining({ status: 'CANCELED', tier: 'PRO' }),
      }),
    );
  });

  it('leaves a row already in sync untouched', async () => {
    mockStripeList.mockReturnValue(asyncIterableOf([stripeSub({ status: 'active' })]));
    mockFindUnique.mockResolvedValue({ status: 'ACTIVE', tier: 'PRO' });

    const result = await stripeReconcileHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 1, repaired: 0 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('counts a Stripe subscription with no DB row as orphaned without writing', async () => {
    mockStripeList.mockReturnValue(asyncIterableOf([stripeSub()]));
    mockFindUnique.mockResolvedValue(null);

    const result = await stripeReconcileHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 1, repaired: 0, orphaned: 1 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('skips subscriptions with no organizationId in metadata', async () => {
    mockStripeList.mockReturnValue(asyncIterableOf([stripeSub({ metadata: {} })]));

    const result = await stripeReconcileHandler(makeJobContext());

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ scanned: 1, repaired: 0, orphaned: 0 });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns ok=false and reports to Sentry when listing throws', async () => {
    mockStripeList.mockImplementation(() => {
      throw new Error('stripe unavailable');
    });

    const result = await stripeReconcileHandler(makeJobContext());

    expect(result.ok).toBe(false);
    expect(result.details).toMatchObject({ error: 'stripe unavailable' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
