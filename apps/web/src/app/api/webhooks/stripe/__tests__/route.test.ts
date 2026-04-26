/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routeStripeEvent, stripeConstructEvent, stripeTx, mockPrisma } = vi.hoisted(() => {
  const routeStripeEvent = vi.fn();
  const stripeTx = {
    stripeEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  };
  const mockPrisma = {
    $transaction: vi.fn(async (fn: (tx: typeof stripeTx) => Promise<unknown>) => fn(stripeTx)),
  };
  return {
    routeStripeEvent,
    stripeConstructEvent: vi.fn(),
    stripeTx,
    mockPrisma,
  };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@contractor-ops/api/services/stripe-client', () => ({
  stripe: {
    webhooks: {
      constructEvent: stripeConstructEvent,
    },
  },
}));

vi.mock('@contractor-ops/api/services/billing-webhook', () => ({
  routeStripeEvent,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@contractor-ops/logger', () => ({
  createWebhookLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn() },
}));

import { POST } from '../route';

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    stripeConstructEvent.mockReturnValue({
      id: 'evt_test_1',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1' } },
    });
    stripeTx.stripeEvent.findUnique.mockResolvedValue(null);
    stripeTx.stripeEvent.upsert.mockResolvedValue({});
    stripeTx.stripeEvent.update.mockResolvedValue({});
    routeStripeEvent.mockResolvedValue(undefined);
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Missing stripe-signature header');
  });

  it('returns 400 when signature verification fails', async () => {
    stripeConstructEvent.mockImplementation(() => {
      throw new Error('bad sig');
    });
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 't=1,v1=abc' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Invalid signature');
  });

  it('processes a new event in a transaction and returns 200', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ x: 1 }),
      headers: { 'stripe-signature': 't=1,v1=ok' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(routeStripeEvent).toHaveBeenCalled();
    expect(stripeTx.stripeEvent.update).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_test_1' },
      data: { processedAt: expect.any(Date) },
    });
  });

  it('skips processing when event was already processed (idempotent)', async () => {
    stripeTx.stripeEvent.findUnique.mockResolvedValue({
      processedAt: new Date(),
    });
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 't=1,v1=ok' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(routeStripeEvent).not.toHaveBeenCalled();
  });
});
