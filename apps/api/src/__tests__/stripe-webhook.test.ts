/** @vitest-environment node */

/**
 * Pins for the Stripe webhook handler's idempotency + transactional
 * processing contract (`apps/api/src/routes/webhooks/stripe.ts`).
 *
 *   1. Signature verification rejects bodies without a valid signature
 *      (returns 400) — handled by `stripe.webhooks.constructEvent` which
 *      we mock to throw on a missing/invalid signature.
 *   2. A first-delivery event runs the full processing path: the
 *      `prisma.$transaction` callback is invoked, the StripeEvent row is
 *      upserted with the payload, `routeStripeEvent` is called inside
 *      the same transaction, and `processedAt` is stamped before commit.
 *   3. A retry delivery (existing.processedAt is set) skips processing:
 *      `routeStripeEvent` is NOT called, the response is 200, and no
 *      side-effects fire. This is the idempotency guarantee Stripe's
 *      3-day retry window depends on — a regression here could
 *      double-charge or double-dispatch notification side-effects.
 *   4. Late-delivery non-settlement events (> 24h old) return 200 with
 *      `skipped: 'late_delivery'` and never enter the transaction.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { constructEventSpy, routeEventSpy, dispatchSpy, transactionSpy, txStripeEvent } = vi.hoisted(
  () => {
    type StripeEventRow = { processedAt: Date | null } | null;
    const txStripeEvent = {
      findUnique: vi.fn<(args: unknown) => Promise<StripeEventRow>>(),
      upsert: vi.fn<(args: unknown) => Promise<unknown>>(),
      update: vi.fn<(args: unknown) => Promise<unknown>>(),
    };
    return {
      constructEventSpy: vi.fn(),
      routeEventSpy: vi.fn(),
      dispatchSpy: vi.fn(),
      transactionSpy: vi.fn(),
      txStripeEvent,
    };
  },
);

vi.mock('@contractor-ops/api/services/stripe-client', () => ({
  stripe: {
    webhooks: {
      constructEvent: constructEventSpy,
    },
  },
}));

vi.mock('@contractor-ops/api/services/billing-webhook', () => ({
  routeStripeEvent: routeEventSpy,
  dispatchStripeWebhookNotifications: dispatchSpy,
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    $transaction: transactionSpy,
  },
}));

import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

let app: FastifyInstance;

const SIGNED_BODY = '{"id":"evt_test_1","type":"invoice.paid","data":{"object":{"foo":"bar"}}}';
const SIGNATURE_HEADER = 't=1234,v1=stub';

function freshEvent(overrides: Partial<{ id: string; type: string; created: number }> = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    id: overrides.id ?? 'evt_test_1',
    type: overrides.type ?? 'invoice.paid',
    created: overrides.created ?? nowSec - 60,
    data: { object: { foo: 'bar' } },
  };
}

beforeAll(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  __resetEnvForTests();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  delete process.env.STRIPE_WEBHOOK_SECRET;
  __resetEnvForTests();
});

beforeEach(() => {
  constructEventSpy.mockReset();
  routeEventSpy.mockReset();
  dispatchSpy.mockReset();
  transactionSpy.mockReset();
  txStripeEvent.findUnique.mockReset();
  txStripeEvent.upsert.mockReset();
  txStripeEvent.update.mockReset();

  // Default $transaction: run the callback with a tx that proxies to the
  // hoisted txStripeEvent stub. Individual tests override findUnique to
  // simulate first-delivery vs retry.
  transactionSpy.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ stripeEvent: txStripeEvent }),
  );
});

describe('POST /webhooks/stripe', () => {
  it('rejects 400 when the stripe-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: SIGNED_BODY,
    });
    expect(res.statusCode).toBe(400);
    expect(constructEventSpy).not.toHaveBeenCalled();
  });

  it('rejects 400 when constructEvent throws (invalid signature)', async () => {
    constructEventSpy.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': SIGNATURE_HEADER,
      },
      payload: SIGNED_BODY,
    });
    expect(res.statusCode).toBe(400);
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(routeEventSpy).not.toHaveBeenCalled();
  });

  it('first delivery runs the transaction, upserts the row, routes the event, stamps processedAt', async () => {
    constructEventSpy.mockReturnValue(freshEvent());
    txStripeEvent.findUnique.mockResolvedValue(null);
    routeEventSpy.mockResolvedValue([{ kind: 'notification.send', userId: 'u1' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': SIGNATURE_HEADER,
      },
      payload: SIGNED_BODY,
    });

    expect(res.statusCode).toBe(200);
    // Single transaction with Serializable isolation
    expect(transactionSpy).toHaveBeenCalledTimes(1);
    const txOpts = transactionSpy.mock.calls[0]?.[1] as
      | { isolationLevel?: string; timeout?: number }
      | undefined;
    expect(txOpts?.isolationLevel).toBe('Serializable');
    expect(txOpts?.timeout).toBeGreaterThan(0);
    // Upsert by stripeEventId before routing
    expect(txStripeEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeEventId: 'evt_test_1' },
        create: expect.objectContaining({
          stripeEventId: 'evt_test_1',
          eventType: 'invoice.paid',
        }),
      }),
    );
    // routeStripeEvent invoked with the tx, NOT the outer prisma client
    expect(routeEventSpy).toHaveBeenCalledTimes(1);
    // processedAt stamped after routing
    expect(txStripeEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeEventId: 'evt_test_1' },
        data: expect.objectContaining({ processedAt: expect.any(Date) }),
      }),
    );
    // Notification dispatch fires AFTER tx commit (the route awaits the tx
    // and only then calls dispatchStripeWebhookNotifications).
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it('retry delivery (processedAt already set) is idempotent — no route, no dispatch', async () => {
    constructEventSpy.mockReturnValue(freshEvent({ id: 'evt_already_processed' }));
    txStripeEvent.findUnique.mockResolvedValue({ processedAt: new Date('2026-05-01T00:00:00Z') });

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': SIGNATURE_HEADER,
      },
      payload: SIGNED_BODY,
    });

    expect(res.statusCode).toBe(200);
    // Transaction still runs (so the early-out is atomic) but the
    // processing path inside it never fires.
    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(routeEventSpy).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(txStripeEvent.upsert).not.toHaveBeenCalled();
    expect(txStripeEvent.update).not.toHaveBeenCalled();
  });

  it('rejects late deliveries (> 24h) with `skipped: late_delivery` and never enters the transaction', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    constructEventSpy.mockReturnValue(
      freshEvent({ id: 'evt_late', type: 'invoice.paid', created: nowSec - 48 * 60 * 60 }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': SIGNATURE_HEADER,
      },
      payload: SIGNED_BODY,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { received: boolean; skipped?: string };
    expect(body.skipped).toBe('late_delivery');
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(routeEventSpy).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('settlement events bypass the 24h window (Stripe redelivers refunds + disputes for days)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    constructEventSpy.mockReturnValue(
      freshEvent({
        id: 'evt_dispute_late',
        type: 'charge.dispute.created',
        created: nowSec - 72 * 60 * 60,
      }),
    );
    txStripeEvent.findUnique.mockResolvedValue(null);
    routeEventSpy.mockResolvedValue([]);

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': SIGNATURE_HEADER,
      },
      payload: SIGNED_BODY,
    });

    expect(res.statusCode).toBe(200);
    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(routeEventSpy).toHaveBeenCalledTimes(1);
  });
});
