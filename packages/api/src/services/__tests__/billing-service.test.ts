import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    contractor: { count: vi.fn() },
  },
}));

vi.mock('../stripe-client.js', () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { createPreview: vi.fn() },
    subscriptions: { update: vi.fn() },
    customers: { create: vi.fn() },
  },
}));

vi.mock('../cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  CacheKeys: { subscription: (id: string) => `sub:${id}` },
  CacheTTL: { SUBSCRIPTION: 900 },
}));

import { prisma } from '@contractor-ops/db';
import {
  createCheckoutSession,
  createPortalSession,
  createTopUpCheckoutSession,
  ensureStripeCustomer,
  getProrationPreview,
  getSubscription,
  syncSeatCountForOrg,
  updateSubscriptionSeatCount,
} from '../billing-service.js';
import { stripe } from '../stripe-client.js';

const mockPrisma = prisma as unknown as {
  subscription: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  contractor: { count: ReturnType<typeof vi.fn> };
};

const mockStripe = stripe as unknown as {
  checkout: { sessions: { create: ReturnType<typeof vi.fn> } };
  billingPortal: { sessions: { create: ReturnType<typeof vi.fn> } };
  invoices: { createPreview: ReturnType<typeof vi.fn> };
  subscriptions: { update: ReturnType<typeof vi.fn> };
  customers: { create: ReturnType<typeof vi.fn> };
};

function makeCheckoutParams(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: 'org_123',
    priceId: 'price_starter',
    stripeCustomerId: 'cus_abc',
    isNewOrg: true,
    quantity: 5,
    successUrl: 'https://app.test/success',
    cancelUrl: 'https://app.test/cancel',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createCheckoutSession — verifies Stripe checkout.sessions.create arguments
// ---------------------------------------------------------------------------

describe('createCheckoutSession', () => {
  function stubSessionUrl(url: string | null = 'https://checkout.stripe.com/s') {
    mockStripe.checkout.sessions.create.mockResolvedValue({ url });
  }

  it("sets mode to 'subscription'", async () => {
    stubSessionUrl();
    await createCheckoutSession(makeCheckoutParams());

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'subscription' }),
    );
  });

  it("sets currency to 'pln'", async () => {
    stubSessionUrl();
    await createCheckoutSession(makeCheckoutParams());

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'pln' }),
    );
  });

  it('forwards priceId into line_items[0].price', async () => {
    stubSessionUrl();
    await createCheckoutSession(makeCheckoutParams({ priceId: 'price_pro' }));

    const args = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.line_items[0].price).toBe('price_pro');
  });

  it('forwards quantity into line_items[0].quantity', async () => {
    stubSessionUrl();
    await createCheckoutSession(makeCheckoutParams({ quantity: 12 }));

    const args = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.line_items[0].quantity).toBe(12);
  });

  it('sets trial_period_days to 14 when isNewOrg is true', async () => {
    stubSessionUrl();
    await createCheckoutSession(makeCheckoutParams({ isNewOrg: true }));

    const args = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.subscription_data.trial_period_days).toBe(14);
  });

  it('sets trial_period_days to undefined when isNewOrg is false', async () => {
    stubSessionUrl();
    await createCheckoutSession(makeCheckoutParams({ isNewOrg: false }));

    const args = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.subscription_data.trial_period_days).toBeUndefined();
  });

  it('includes organizationId in subscription_data.metadata', async () => {
    stubSessionUrl();
    await createCheckoutSession(makeCheckoutParams({ organizationId: 'org_meta' }));

    const args = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.subscription_data.metadata.organizationId).toBe('org_meta');
  });

  it('forwards stripeCustomerId as customer', async () => {
    stubSessionUrl();
    await createCheckoutSession(makeCheckoutParams({ stripeCustomerId: 'cus_xyz' }));

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_xyz' }),
    );
  });

  it('forwards successUrl and cancelUrl', async () => {
    stubSessionUrl();
    await createCheckoutSession(
      makeCheckoutParams({
        successUrl: 'https://app.test/ok',
        cancelUrl: 'https://app.test/nope',
      }),
    );

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'https://app.test/ok',
        cancel_url: 'https://app.test/nope',
      }),
    );
  });

  it('throws when Stripe returns a null session URL', async () => {
    stubSessionUrl(null);

    await expect(createCheckoutSession(makeCheckoutParams())).rejects.toThrow(
      '[billing-service] Checkout session URL is null',
    );
  });

  it('throws for quantity less than 1', async () => {
    await expect(createCheckoutSession(makeCheckoutParams({ quantity: 0 }))).rejects.toThrow(
      '[billing-service] quantity must be at least 1',
    );
  });
});

// ---------------------------------------------------------------------------
// createTopUpCheckoutSession — verifies one-time payment mode and metadata
// ---------------------------------------------------------------------------

describe('createTopUpCheckoutSession', () => {
  function stubSessionUrl(url: string | null = 'https://checkout.stripe.com/s') {
    mockStripe.checkout.sessions.create.mockResolvedValue({ url });
  }

  const topUpParams = {
    organizationId: 'org_123',
    priceId: 'price_topup_50',
    stripeCustomerId: 'cus_abc',
    successUrl: 'https://app.test/success',
    cancelUrl: 'https://app.test/cancel',
  };

  it("sets mode to 'payment' (not subscription)", async () => {
    stubSessionUrl();
    await createTopUpCheckoutSession(topUpParams);

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'payment' }),
    );
  });

  it("sets currency to 'pln'", async () => {
    stubSessionUrl();
    await createTopUpCheckoutSession(topUpParams);

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'pln' }),
    );
  });

  it('sets quantity to 1 and forwards priceId', async () => {
    stubSessionUrl();
    await createTopUpCheckoutSession(topUpParams);

    const args = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.line_items).toEqual([{ price: 'price_topup_50', quantity: 1 }]);
  });

  it('includes top_up type and organizationId in metadata', async () => {
    stubSessionUrl();
    await createTopUpCheckoutSession(topUpParams);

    const args = mockStripe.checkout.sessions.create.mock.calls[0][0];
    expect(args.metadata).toEqual({
      organizationId: 'org_123',
      type: 'top_up',
      priceId: 'price_topup_50',
    });
  });

  it('throws when Stripe returns a null session URL', async () => {
    stubSessionUrl(null);

    await expect(createTopUpCheckoutSession(topUpParams)).rejects.toThrow(
      '[billing-service] Top-up checkout session URL is null',
    );
  });
});

// ---------------------------------------------------------------------------
// getProrationPreview — verifies arguments AND response transformation
// ---------------------------------------------------------------------------

describe('getProrationPreview', () => {
  const prorationParams = {
    stripeCustomerId: 'cus_abc',
    stripeSubscriptionId: 'sub_123',
    stripeSubscriptionItemId: 'si_456',
    newPriceId: 'price_pro',
  };

  it('passes correct subscription_details.items with price and item id', async () => {
    mockStripe.invoices.createPreview.mockResolvedValue({
      lines: { data: [] },
      total: 0,
    });

    await getProrationPreview(prorationParams);

    const args = mockStripe.invoices.createPreview.mock.calls[0][0];
    expect(args.subscription_details.items).toEqual([{ id: 'si_456', price: 'price_pro' }]);
  });

  it("sets proration_behavior to 'create_prorations'", async () => {
    mockStripe.invoices.createPreview.mockResolvedValue({
      lines: { data: [] },
      total: 0,
    });

    await getProrationPreview(prorationParams);

    const args = mockStripe.invoices.createPreview.mock.calls[0][0];
    expect(args.subscription_details.proration_behavior).toBe('create_prorations');
  });

  it('forwards customer and subscription to Stripe', async () => {
    mockStripe.invoices.createPreview.mockResolvedValue({
      lines: { data: [] },
      total: 0,
    });

    await getProrationPreview(prorationParams);

    expect(mockStripe.invoices.createPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_abc',
        subscription: 'sub_123',
      }),
    );
  });

  it('transforms Stripe line items: maps amount to amountMinor', async () => {
    mockStripe.invoices.createPreview.mockResolvedValue({
      lines: {
        data: [
          { description: 'Unused time on Starter', amount: -1500 },
          { description: 'Remaining time on Pro', amount: 3000 },
        ],
      },
      total: 1500,
    });

    const result = await getProrationPreview(prorationParams);

    expect(result.lines).toEqual([
      { description: 'Unused time on Starter', amountMinor: -1500 },
      { description: 'Remaining time on Pro', amountMinor: 3000 },
    ]);
  });

  it('maps Stripe total to totalMinor', async () => {
    mockStripe.invoices.createPreview.mockResolvedValue({
      lines: { data: [{ description: 'X', amount: 5000 }] },
      total: 5000,
    });

    const result = await getProrationPreview(prorationParams);

    expect(result.totalMinor).toBe(5000);
  });

  it('defaults description to empty string when Stripe returns null', async () => {
    mockStripe.invoices.createPreview.mockResolvedValue({
      lines: { data: [{ description: null, amount: 100 }] },
      total: 100,
    });

    const result = await getProrationPreview(prorationParams);

    expect(result.lines[0].description).toBe('');
  });

  it('returns empty lines array when Stripe lines.data is missing', async () => {
    mockStripe.invoices.createPreview.mockResolvedValue({
      lines: { data: undefined },
      total: 0,
    });

    const result = await getProrationPreview(prorationParams);

    expect(result.lines).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createPortalSession — verifies customer and return_url forwarding
// ---------------------------------------------------------------------------

describe('createPortalSession', () => {
  it('forwards stripeCustomerId as customer and returnUrl as return_url', async () => {
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/portal',
    });

    await createPortalSession({
      stripeCustomerId: 'cus_portal',
      returnUrl: 'https://app.test/billing',
    });

    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_portal',
      return_url: 'https://app.test/billing',
    });
  });
});

// ---------------------------------------------------------------------------
// ensureStripeCustomer — DB-first check, conditional Stripe customer creation
// ---------------------------------------------------------------------------

describe('ensureStripeCustomer', () => {
  const customerParams = {
    organizationId: 'org_123',
    email: 'admin@test.com',
    name: 'Test Org',
  };

  it('returns existing stripeCustomerId without calling Stripe when DB has one', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_existing',
    });

    const result = await ensureStripeCustomer(customerParams);

    expect(result).toBe('cus_existing');
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
  });

  it('queries DB with the correct organizationId', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_x',
    });

    await ensureStripeCustomer({
      ...customerParams,
      organizationId: 'org_lookup',
    });

    expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { organizationId: 'org_lookup' },
      select: { stripeCustomerId: true },
    });
  });

  it('creates Stripe customer with email, name, and metadata when DB returns null', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });

    await ensureStripeCustomer({
      organizationId: 'org_new',
      email: 'new@test.com',
      name: 'New Org',
    });

    expect(mockStripe.customers.create).toHaveBeenCalledWith(
      {
        email: 'new@test.com',
        name: 'New Org',
        metadata: { organizationId: 'org_new' },
      },
      {
        idempotencyKey: 'create-customer-org_new',
      },
    );
  });

  it("uses idempotencyKey format 'create-customer-{organizationId}'", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_idem' });

    await ensureStripeCustomer({
      ...customerParams,
      organizationId: 'org_idem_test',
    });

    const options = mockStripe.customers.create.mock.calls[0][1];
    expect(options.idempotencyKey).toBe('create-customer-org_idem_test');
  });

  it('creates Stripe customer when DB returns subscription with null stripeCustomerId', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      stripeCustomerId: null,
    });
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_fallback' });

    const result = await ensureStripeCustomer(customerParams);

    expect(result).toBe('cus_fallback');
    expect(mockStripe.customers.create).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// syncSeatCountForOrg — seat reconciliation logic
// ---------------------------------------------------------------------------

describe('syncSeatCountForOrg', () => {
  function stubActiveSub(seatCount: number) {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionItemId: 'si_456',
      status: 'ACTIVE',
      seatCount,
    });
  }

  it('calls Stripe update when contractor count differs from seatCount', async () => {
    stubActiveSub(5);
    mockPrisma.contractor.count.mockResolvedValue(7);
    mockStripe.subscriptions.update.mockResolvedValue({});
    mockPrisma.subscription.update.mockResolvedValue({});

    await syncSeatCountForOrg('org_123');

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
      items: [{ id: 'si_456', quantity: 7 }],
      proration_behavior: 'create_prorations',
    });
  });

  it('updates local DB seatCount after Stripe update', async () => {
    stubActiveSub(5);
    mockPrisma.contractor.count.mockResolvedValue(7);
    mockStripe.subscriptions.update.mockResolvedValue({});
    mockPrisma.subscription.update.mockResolvedValue({});

    await syncSeatCountForOrg('org_123');

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_123' },
      data: { seatCount: 7 },
    });
  });

  it('does NOT call Stripe when seatCount already matches contractor count', async () => {
    stubActiveSub(5);
    mockPrisma.contractor.count.mockResolvedValue(5);

    await syncSeatCountForOrg('org_123');

    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('enforces minimum quantity of 1 when contractor count is 0', async () => {
    stubActiveSub(5);
    mockPrisma.contractor.count.mockResolvedValue(0);
    mockStripe.subscriptions.update.mockResolvedValue({});
    mockPrisma.subscription.update.mockResolvedValue({});

    await syncSeatCountForOrg('org_123');

    const updateArgs = mockStripe.subscriptions.update.mock.calls[0][1];
    expect(updateArgs.items[0].quantity).toBe(1);
  });

  it('skips update when subscription status is CANCELED', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionItemId: 'si_456',
      status: 'CANCELED',
      seatCount: 5,
    });

    await syncSeatCountForOrg('org_123');

    expect(mockPrisma.contractor.count).not.toHaveBeenCalled();
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('proceeds with update when subscription status is TRIALING', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionItemId: 'si_456',
      status: 'TRIALING',
      seatCount: 3,
    });
    mockPrisma.contractor.count.mockResolvedValue(5);
    mockStripe.subscriptions.update.mockResolvedValue({});
    mockPrisma.subscription.update.mockResolvedValue({});

    await syncSeatCountForOrg('org_123');

    expect(mockStripe.subscriptions.update).toHaveBeenCalledOnce();
  });

  it('skips update when subscription has no stripeSubscriptionItemId', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionItemId: null,
      status: 'ACTIVE',
      seatCount: 5,
    });

    await syncSeatCountForOrg('org_123');

    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('does not throw when no subscription exists (returns early)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(syncSeatCountForOrg('org_123')).resolves.toBeUndefined();
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('does not throw when Stripe update fails (fire-and-forget)', async () => {
    stubActiveSub(5);
    mockPrisma.contractor.count.mockResolvedValue(7);
    mockStripe.subscriptions.update.mockRejectedValue(new Error('Stripe is down'));

    await expect(syncSeatCountForOrg('org_123')).resolves.toBeUndefined();
  });

  it('counts only ACTIVE contractors for the given organizationId', async () => {
    stubActiveSub(1);
    mockPrisma.contractor.count.mockResolvedValue(3);
    mockStripe.subscriptions.update.mockResolvedValue({});
    mockPrisma.subscription.update.mockResolvedValue({});

    await syncSeatCountForOrg('org_count');

    expect(mockPrisma.contractor.count).toHaveBeenCalledWith({
      where: { organizationId: 'org_count', status: 'ACTIVE' },
    });
  });
});

// ---------------------------------------------------------------------------
// updateSubscriptionSeatCount — direct Stripe subscription update
// ---------------------------------------------------------------------------

describe('updateSubscriptionSeatCount', () => {
  it('calls Stripe subscriptions.update with correct item id and quantity', async () => {
    mockStripe.subscriptions.update.mockResolvedValue({});

    await updateSubscriptionSeatCount({
      stripeSubscriptionId: 'sub_abc',
      stripeSubscriptionItemId: 'si_789',
      newQuantity: 10,
    });

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_abc', {
      items: [{ id: 'si_789', quantity: 10 }],
      proration_behavior: 'create_prorations',
    });
  });

  it('throws for quantity less than 1', async () => {
    await expect(
      updateSubscriptionSeatCount({
        stripeSubscriptionId: 'sub_abc',
        stripeSubscriptionItemId: 'si_789',
        newQuantity: 0,
      }),
    ).rejects.toThrow('[billing-service] seat quantity must be at least 1');
  });
});

// ---------------------------------------------------------------------------
// getSubscription — caching integration
// ---------------------------------------------------------------------------

describe('getSubscription', () => {
  it('queries prisma with the correct organizationId', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await getSubscription('org_sub_lookup');

    expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { organizationId: 'org_sub_lookup' },
    });
  });
});

// ---------------------------------------------------------------------------
// Input validation — assertNonEmpty guards
// ---------------------------------------------------------------------------

describe('input validation', () => {
  it('createCheckoutSession throws for empty organizationId', async () => {
    await expect(createCheckoutSession(makeCheckoutParams({ organizationId: '' }))).rejects.toThrow(
      '[billing-service] organizationId must not be empty',
    );
  });

  it('createCheckoutSession throws for empty priceId', async () => {
    await expect(createCheckoutSession(makeCheckoutParams({ priceId: '' }))).rejects.toThrow(
      '[billing-service] priceId must not be empty',
    );
  });

  it('createCheckoutSession throws for empty stripeCustomerId', async () => {
    await expect(
      createCheckoutSession(makeCheckoutParams({ stripeCustomerId: '' })),
    ).rejects.toThrow('[billing-service] stripeCustomerId must not be empty');
  });

  it('createCheckoutSession throws for empty successUrl', async () => {
    await expect(createCheckoutSession(makeCheckoutParams({ successUrl: '' }))).rejects.toThrow(
      '[billing-service] successUrl must not be empty',
    );
  });

  it('createCheckoutSession throws for empty cancelUrl', async () => {
    await expect(createCheckoutSession(makeCheckoutParams({ cancelUrl: '' }))).rejects.toThrow(
      '[billing-service] cancelUrl must not be empty',
    );
  });

  it('getProrationPreview throws for empty stripeCustomerId', async () => {
    await expect(
      getProrationPreview({
        stripeCustomerId: '',
        stripeSubscriptionId: 'sub_123',
        stripeSubscriptionItemId: 'si_456',
        newPriceId: 'price_pro',
      }),
    ).rejects.toThrow('[billing-service] stripeCustomerId must not be empty');
  });

  it('getProrationPreview throws for empty stripeSubscriptionId', async () => {
    await expect(
      getProrationPreview({
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: '',
        stripeSubscriptionItemId: 'si_456',
        newPriceId: 'price_pro',
      }),
    ).rejects.toThrow('[billing-service] stripeSubscriptionId must not be empty');
  });

  it('getProrationPreview throws for empty newPriceId', async () => {
    await expect(
      getProrationPreview({
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_123',
        stripeSubscriptionItemId: 'si_456',
        newPriceId: '',
      }),
    ).rejects.toThrow('[billing-service] newPriceId must not be empty');
  });

  it('createPortalSession throws for empty stripeCustomerId', async () => {
    await expect(
      createPortalSession({
        stripeCustomerId: '',
        returnUrl: 'https://app.test/settings',
      }),
    ).rejects.toThrow('[billing-service] stripeCustomerId must not be empty');
  });

  it('createPortalSession throws for empty returnUrl', async () => {
    await expect(
      createPortalSession({
        stripeCustomerId: 'cus_abc',
        returnUrl: '',
      }),
    ).rejects.toThrow('[billing-service] returnUrl must not be empty');
  });

  it('ensureStripeCustomer throws for empty organizationId', async () => {
    await expect(
      ensureStripeCustomer({
        organizationId: '',
        email: 'a@test.com',
        name: 'Test',
      }),
    ).rejects.toThrow('[billing-service] organizationId must not be empty');
  });

  it('ensureStripeCustomer throws for empty email', async () => {
    await expect(
      ensureStripeCustomer({
        organizationId: 'org_123',
        email: '',
        name: 'Test Org',
      }),
    ).rejects.toThrow('[billing-service] email must not be empty');
  });

  it('ensureStripeCustomer throws for empty name', async () => {
    await expect(
      ensureStripeCustomer({
        organizationId: 'org_123',
        email: 'a@test.com',
        name: '',
      }),
    ).rejects.toThrow('[billing-service] name must not be empty');
  });

  it('updateSubscriptionSeatCount throws for empty stripeSubscriptionId', async () => {
    await expect(
      updateSubscriptionSeatCount({
        stripeSubscriptionId: '',
        stripeSubscriptionItemId: 'si_456',
        newQuantity: 5,
      }),
    ).rejects.toThrow('[billing-service] stripeSubscriptionId must not be empty');
  });

  it('getSubscription throws for empty organizationId', async () => {
    await expect(getSubscription('')).rejects.toThrow(
      '[billing-service] organizationId must not be empty',
    );
  });
});
