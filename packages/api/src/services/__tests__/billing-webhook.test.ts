import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted runs before vi.mock factories)
// ---------------------------------------------------------------------------

const {
  mockStripeSubscriptionsRetrieve,
  mockResolveTierFromPriceId,
  mockResolveTopUpCredits,
  mockDispatch,
  mockInvalidate,
  mockEmailSend,
} = vi.hoisted(() => ({
  mockStripeSubscriptionsRetrieve: vi.fn(),
  mockResolveTierFromPriceId: vi.fn(),
  mockResolveTopUpCredits: vi.fn(),
  mockDispatch: vi.fn().mockResolvedValue(undefined),
  mockInvalidate: vi.fn(),
  mockEmailSend: vi.fn().mockResolvedValue({}),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => ({
  prisma: {},
}));

vi.mock('../stripe-client.js', () => ({
  stripe: { subscriptions: { retrieve: mockStripeSubscriptionsRetrieve } },
}));

vi.mock('../billing-constants.js', () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
  resolveTierFromPriceId: mockResolveTierFromPriceId,
  resolveTopUpCredits: mockResolveTopUpCredits,
}));

vi.mock('../credit-service.js', () => ({
  allocateTopUpCredits: vi.fn(),
}));

vi.mock('../notification-service.js', () => ({
  dispatch: mockDispatch,
}));

vi.mock('../cache.js', () => ({
  invalidate: mockInvalidate,
  CacheKeys: {
    subscription: (id: string) => `sub:${id}`,
    creditBalance: (id: string) => `credit:${id}`,
  },
}));

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn() },
}));

vi.mock('../app-email.js', () => ({
  sendAppEmail: (...args: unknown[]) => mockEmailSend(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { routeStripeEvent } from '../billing-webhook.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTx() {
  return {
    subscription: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    ocrCreditLedger: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    member: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function makeEvent(type: string, dataObject: Record<string, unknown>): Stripe.Event {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type,
    data: { object: dataObject },
  } as unknown as Stripe.Event;
}

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_123',
    status: 'active',
    customer: 'cus_abc',
    cancel_at_period_end: false,
    trial_end: null,
    start_date: 1700000000,
    current_period_start: 1700000000,
    current_period_end: 1702592000,
    metadata: { organizationId: 'org_1' },
    items: {
      data: [
        {
          id: 'si_item1',
          quantity: 3,
          price: { id: 'price_pro' },
        },
      ],
    },
    ...overrides,
  };
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv_456',
    billing_reason: 'subscription_cycle',
    parent: {
      subscription_details: {
        subscription: 'sub_123',
      },
    },
    ...overrides,
  };
}

function makeCheckoutSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_session_1',
    mode: 'subscription',
    subscription: 'sub_123',
    metadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('billing-webhook', () => {
  let tx: ReturnType<typeof createMockTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = createMockTx();
    mockResolveTierFromPriceId.mockReturnValue('PRO');
  });

  // =========================================================================
  // routeStripeEvent routing
  // =========================================================================

  describe('routeStripeEvent routing', () => {
    it('routes checkout.session.completed (mode=subscription) to handleCheckoutCompleted', async () => {
      const sub = makeSubscription({ status: 'active' });
      mockStripeSubscriptionsRetrieve.mockResolvedValue(sub);
      tx.subscription.findUnique.mockResolvedValue(null);

      const event = makeEvent('checkout.session.completed', makeCheckoutSession());

      await routeStripeEvent(event, tx);

      expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith('sub_123');
      // handleSubscriptionUpdated is called internally, which calls upsert
      expect(tx.subscription.upsert).toHaveBeenCalled();
    });

    it('routes customer.subscription.updated to handleSubscriptionUpdated', async () => {
      tx.subscription.findUnique.mockResolvedValue(null);

      const event = makeEvent('customer.subscription.updated', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(tx.subscription.upsert).toHaveBeenCalled();
    });

    it('routes customer.subscription.deleted to handleSubscriptionDeleted', async () => {
      tx.subscription.findUnique.mockResolvedValue({
        id: 'db_sub_1',
        organizationId: 'org_1',
      });

      const event = makeEvent('customer.subscription.deleted', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(tx.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_123' },
        data: { status: 'CANCELED' },
      });
    });

    it('routes invoice.paid to handleInvoicePaid', async () => {
      mockResolveTierFromPriceId.mockReturnValue('STARTER');
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        stripePriceId: 'price_starter',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      const event = makeEvent('invoice.paid', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).toHaveBeenCalled();
    });

    it('routes invoice.payment_failed to handlePaymentFailed', async () => {
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        organization: { id: 'org_1', billingEmail: null },
      });

      const event = makeEvent('invoice.payment_failed', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(tx.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'PAST_DUE' },
        }),
      );
    });

    it('routes customer.subscription.trial_will_end to handleTrialWillEnd', async () => {
      tx.subscription.findUnique.mockResolvedValue({
        organization: { id: 'org_1', billingEmail: 'billing@test.com' },
      });
      tx.member.findMany.mockResolvedValue([{ userId: 'usr_1' }]);

      const event = makeEvent('customer.subscription.trial_will_end', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'TRIAL_ENDING' }));
    });

    it('does not throw on unhandled event type', async () => {
      const event = makeEvent('some.unknown.event', {});

      await expect(routeStripeEvent(event, tx)).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // handleSubscriptionUpdated
  // =========================================================================

  describe('handleSubscriptionUpdated', () => {
    it('upserts subscription with correct mapped fields', async () => {
      tx.subscription.findUnique.mockResolvedValue(null); // no previous sub
      mockResolveTierFromPriceId.mockReturnValue('PRO');

      const sub = makeSubscription({
        status: 'trialing',
        trial_end: 1701000000,
      });
      const event = makeEvent('customer.subscription.updated', sub);

      await routeStripeEvent(event, tx);

      expect(tx.subscription.upsert).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_123' },
        create: expect.objectContaining({
          stripeSubscriptionId: 'sub_123',
          organizationId: 'org_1',
          stripeCustomerId: 'cus_abc',
          stripeSubscriptionItemId: 'si_item1',
          stripePriceId: 'price_pro',
          tier: 'PRO',
          status: 'TRIALING',
          currentPeriodStart: new Date(1700000000 * 1000),
          currentPeriodEnd: new Date(1702592000 * 1000),
          trialEnd: new Date(1701000000 * 1000),
          cancelAtPeriodEnd: false,
          seatCount: 3,
        }),
        update: expect.objectContaining({
          organizationId: 'org_1',
          status: 'TRIALING',
          tier: 'PRO',
          stripeCustomerId: 'cus_abc',
        }),
      });
    });

    it('maps Stripe status correctly (trialing->TRIALING, active->ACTIVE)', async () => {
      tx.subscription.findUnique.mockResolvedValue(null);

      for (const [stripeStatus, dbStatus] of [
        ['trialing', 'TRIALING'],
        ['active', 'ACTIVE'],
        ['past_due', 'PAST_DUE'],
        ['canceled', 'CANCELED'],
        ['unpaid', 'UNPAID'],
      ] as const) {
        vi.clearAllMocks();
        tx = createMockTx();
        tx.subscription.findUnique.mockResolvedValue(null);
        mockResolveTierFromPriceId.mockReturnValue('PRO');

        const sub = makeSubscription({ status: stripeStatus });
        const event = makeEvent('customer.subscription.updated', sub);

        await routeStripeEvent(event, tx);

        expect(tx.subscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({ status: dbStatus }),
          }),
        );
      }
    });

    it('returns early when organizationId is missing from metadata', async () => {
      const sub = makeSubscription({ metadata: {} });
      const event = makeEvent('customer.subscription.updated', sub);

      await routeStripeEvent(event, tx);

      expect(tx.subscription.upsert).not.toHaveBeenCalled();
    });

    it('defaults to STARTER tier when resolveTierFromPriceId throws', async () => {
      tx.subscription.findUnique.mockResolvedValue(null);
      mockResolveTierFromPriceId.mockImplementation(() => {
        throw new Error('Unknown price ID');
      });

      const sub = makeSubscription();
      const event = makeEvent('customer.subscription.updated', sub);

      await routeStripeEvent(event, tx);

      expect(tx.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ tier: 'STARTER' }),
        }),
      );
    });

    it('extracts customer ID from string customer field', async () => {
      tx.subscription.findUnique.mockResolvedValue(null);

      const sub = makeSubscription({ customer: 'cus_string_id' });
      const event = makeEvent('customer.subscription.updated', sub);

      await routeStripeEvent(event, tx);

      expect(tx.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            stripeCustomerId: 'cus_string_id',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // handleSubscriptionDeleted
  // =========================================================================

  describe('handleSubscriptionDeleted', () => {
    it('sets status to CANCELED on existing subscription', async () => {
      tx.subscription.findUnique.mockResolvedValue({
        id: 'db_sub_1',
        organizationId: 'org_1',
      });

      const event = makeEvent('customer.subscription.deleted', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(tx.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_123' },
        data: { status: 'CANCELED' },
      });
      expect(mockInvalidate).toHaveBeenCalledWith('sub:org_1', 'credit:org_1');
    });

    it('skips update when subscription is not found in DB', async () => {
      tx.subscription.findUnique.mockResolvedValue(null);

      const event = makeEvent('customer.subscription.deleted', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(tx.subscription.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleCheckoutCompleted - trial credits
  // =========================================================================

  describe('handleCheckoutCompleted - trial credits', () => {
    beforeEach(() => {
      // handleCheckoutCompleted retrieves the subscription from Stripe
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription({ status: 'trialing' }));
      // handleSubscriptionUpdated (called first) needs findUnique for tier change check
      tx.subscription.findUnique.mockResolvedValue(null);
      // No existing trial entry
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
    });

    it('creates trial credit ledger entry with credits=5 and reason=TRIAL_ALLOWANCE', async () => {
      const event = makeEvent(
        'checkout.session.completed',
        makeCheckoutSession({ id: 'cs_sess_abc' }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org_1',
          credits: 5,
          reason: 'TRIAL_ALLOWANCE',
          stripeEventId: 'trial_cs_sess_abc',
          periodStart: expect.any(Date),
          periodEnd: expect.any(Date),
        }),
      });
    });

    it('deduplicates trial credits by stripeEventId (trial_{sessionId})', async () => {
      // Simulate existing trial entry
      tx.ocrCreditLedger.findFirst.mockResolvedValue({ id: 'existing_id' });

      const event = makeEvent(
        'checkout.session.completed',
        makeCheckoutSession({ id: 'cs_sess_dup' }),
      );

      await routeStripeEvent(event, tx);

      // findFirst should have been called with the dedup ID
      expect(tx.ocrCreditLedger.findFirst).toHaveBeenCalledWith({
        where: { stripeEventId: 'trial_cs_sess_dup' },
        select: { id: true },
      });
      // create should NOT be called since duplicate found
      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('skips trial credits when subscription is active (not trialing)', async () => {
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription({ status: 'active' }));

      const event = makeEvent('checkout.session.completed', makeCheckoutSession());

      await routeStripeEvent(event, tx);

      // upsert is called (subscription sync), but no credit ledger entry
      expect(tx.subscription.upsert).toHaveBeenCalled();
      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('converts period timestamps from unix to Date objects', async () => {
      mockStripeSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({
          status: 'trialing',
          current_period_start: 1700000000,
          current_period_end: 1702592000,
        }),
      );

      const event = makeEvent(
        'checkout.session.completed',
        makeCheckoutSession({ id: 'cs_period' }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          periodStart: new Date(1700000000 * 1000),
          periodEnd: new Date(1702592000 * 1000),
        }),
      });
    });
  });

  // =========================================================================
  // handleInvoicePaid - credit allocation
  // =========================================================================

  describe('handleInvoicePaid - credit allocation', () => {
    it('creates monthly credit ledger entry based on tier (STARTER=20)', async () => {
      mockResolveTierFromPriceId.mockReturnValue('STARTER');
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        stripePriceId: 'price_starter',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      const event = makeEvent('invoice.paid', makeInvoice({ id: 'inv_s1' }));

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org_1',
          credits: 20,
          reason: 'MONTHLY_ALLOWANCE',
          stripeEventId: 'inv_s1',
        }),
      });
    });

    it('allocates PRO credits (100) for PRO tier', async () => {
      mockResolveTierFromPriceId.mockReturnValue('PRO');
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        stripePriceId: 'price_pro',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      const event = makeEvent('invoice.paid', makeInvoice({ id: 'inv_p1' }));

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ credits: 100 }),
      });
    });

    it('allocates ENTERPRISE credits (500) for ENTERPRISE tier', async () => {
      mockResolveTierFromPriceId.mockReturnValue('ENTERPRISE');
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        stripePriceId: 'price_ent',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      const event = makeEvent('invoice.paid', makeInvoice({ id: 'inv_e1' }));

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ credits: 500 }),
      });
    });

    it('skips credit allocation for subscription_create billing_reason', async () => {
      const event = makeEvent(
        'invoice.paid',
        makeInvoice({ billing_reason: 'subscription_create' }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
      expect(tx.subscription.findUnique).not.toHaveBeenCalled();
    });

    it('deduplicates by invoice ID', async () => {
      tx.ocrCreditLedger.findFirst.mockResolvedValue({
        id: 'existing_ledger',
      });

      const event = makeEvent('invoice.paid', makeInvoice({ id: 'inv_dup' }));

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.findFirst).toHaveBeenCalledWith({
        where: { stripeEventId: 'inv_dup' },
        select: { id: true },
      });
      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('uses subscription period dates in ledger entry', async () => {
      const periodStart = new Date('2024-03-01');
      const periodEnd = new Date('2024-04-01');
      mockResolveTierFromPriceId.mockReturnValue('PRO');
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        stripePriceId: 'price_pro',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      const event = makeEvent('invoice.paid', makeInvoice({ id: 'inv_period' }));

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          periodStart,
          periodEnd,
        }),
      });
    });
  });

  // =========================================================================
  // handleTrialWillEnd - notifications
  // =========================================================================

  describe('handleTrialWillEnd - notifications', () => {
    it('dispatches in-app notification to admin users', async () => {
      tx.subscription.findUnique.mockResolvedValue({
        organization: { id: 'org_1', billingEmail: 'billing@test.com' },
      });
      tx.member.findMany.mockResolvedValue([{ userId: 'usr_admin1' }, { userId: 'usr_admin2' }]);

      const event = makeEvent('customer.subscription.trial_will_end', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_1',
          type: 'TRIAL_ENDING',
          recipientUserIds: ['usr_admin1', 'usr_admin2'],
          title: 'Trial ending soon',
          body: 'Your trial ends in 3 days. Choose a plan to continue without interruption.',
          entityType: 'ORGANIZATION',
          entityId: 'org_1',
        }),
      );

      // Verify member query targets owners and admins
      expect(tx.member.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org_1',
          role: { in: ['owner', 'admin'] },
        },
        select: { userId: true },
      });
    });

    it('sends email to billingEmail', async () => {
      tx.subscription.findUnique.mockResolvedValue({
        organization: { id: 'org_1', billingEmail: 'billing@acme.com' },
      });
      tx.member.findMany.mockResolvedValue([{ userId: 'usr_1' }]);

      const event = makeEvent('customer.subscription.trial_will_end', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'billing@acme.com',
          subject: 'Your Contractor Ops trial ends in 3 days',
        }),
      );
    });

    it('skips email when billingEmail is null', async () => {
      tx.subscription.findUnique.mockResolvedValue({
        organization: { id: 'org_1', billingEmail: null },
      });
      tx.member.findMany.mockResolvedValue([{ userId: 'usr_1' }]);

      const event = makeEvent('customer.subscription.trial_will_end', makeSubscription());

      await routeStripeEvent(event, tx);

      // Dispatch should still happen
      expect(mockDispatch).toHaveBeenCalled();
      // But email should not be sent
      expect(mockEmailSend).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handlePaymentFailed
  // =========================================================================

  describe('handlePaymentFailed', () => {
    beforeEach(() => {
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        organization: { id: 'org_1', billingEmail: 'billing@acme.com' },
      });
      tx.member.findMany.mockResolvedValue([{ userId: 'usr_admin1' }, { userId: 'usr_admin2' }]);
    });

    it('sets subscription status to PAST_DUE', async () => {
      const event = makeEvent('invoice.payment_failed', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(tx.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_123' },
        data: { status: 'PAST_DUE' },
      });
    });

    it('dispatches in-app notification and sends email to admins', async () => {
      const event = makeEvent('invoice.payment_failed', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_1',
          type: 'PAYMENT_FAILED',
          recipientUserIds: ['usr_admin1', 'usr_admin2'],
          title: 'Payment failed',
        }),
      );
    });

    it('sends email to organization billingEmail', async () => {
      const event = makeEvent('invoice.payment_failed', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'billing@acme.com',
          subject: 'Payment failed - action required',
        }),
      );
    });

    it('skips when no subscription ID in invoice', async () => {
      const event = makeEvent(
        'invoice.payment_failed',
        makeInvoice({ parent: null }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.subscription.findUnique).not.toHaveBeenCalled();
      expect(tx.subscription.update).not.toHaveBeenCalled();
    });

    it('skips when subscription not found in DB', async () => {
      tx.subscription.findUnique.mockResolvedValue(null);

      const event = makeEvent('invoice.payment_failed', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(tx.subscription.update).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('skips email when billingEmail is null', async () => {
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        organization: { id: 'org_1', billingEmail: null },
      });
      tx.member.findMany.mockResolvedValue([{ userId: 'usr_1' }]);

      const event = makeEvent('invoice.payment_failed', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(mockDispatch).toHaveBeenCalled();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleInvoicePaid - edge cases
  // =========================================================================

  describe('handleInvoicePaid - edge cases', () => {
    it('skips when invoice has no subscription ID', async () => {
      const event = makeEvent(
        'invoice.paid',
        makeInvoice({ parent: null }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('skips when subscription not found in DB', async () => {
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
      tx.subscription.findUnique.mockResolvedValue(null);

      const event = makeEvent('invoice.paid', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('skips when subscription has no stripePriceId', async () => {
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        stripePriceId: null,
      });

      const event = makeEvent('invoice.paid', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('skips when resolveTierFromPriceId throws', async () => {
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        stripePriceId: 'price_unknown',
      });
      mockResolveTierFromPriceId.mockImplementation(() => {
        throw new Error('Unknown price');
      });

      const event = makeEvent('invoice.paid', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleTopUpCompleted
  // =========================================================================

  describe('handleTopUpCompleted', () => {
    it('allocates top-up credits from checkout session metadata', async () => {
      mockResolveTopUpCredits.mockReturnValue(50);
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      const event = makeEvent(
        'checkout.session.completed',
        makeCheckoutSession({
          id: 'cs_topup_1',
          mode: 'payment',
          subscription: null,
          metadata: { type: 'top_up', organizationId: 'org_1', priceId: 'price_topup_50' },
        }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org_1',
          credits: 50,
          reason: 'TOP_UP',
          stripeEventId: 'cs_topup_1',
        }),
      });
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it('skips when organizationId missing from metadata', async () => {
      const event = makeEvent(
        'checkout.session.completed',
        makeCheckoutSession({
          mode: 'payment',
          subscription: null,
          metadata: { type: 'top_up', priceId: 'price_topup_50' },
        }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('skips when priceId missing from metadata', async () => {
      const event = makeEvent(
        'checkout.session.completed',
        makeCheckoutSession({
          mode: 'payment',
          subscription: null,
          metadata: { type: 'top_up', organizationId: 'org_1' },
        }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('skips when resolveTopUpCredits returns null', async () => {
      mockResolveTopUpCredits.mockReturnValue(null);

      const event = makeEvent(
        'checkout.session.completed',
        makeCheckoutSession({
          mode: 'payment',
          subscription: null,
          metadata: { type: 'top_up', organizationId: 'org_1', priceId: 'price_bad' },
        }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('deduplicates by session ID', async () => {
      mockResolveTopUpCredits.mockReturnValue(50);
      tx.ocrCreditLedger.findFirst.mockResolvedValue({ id: 'existing' });

      const event = makeEvent(
        'checkout.session.completed',
        makeCheckoutSession({
          id: 'cs_dup',
          mode: 'payment',
          subscription: null,
          metadata: { type: 'top_up', organizationId: 'org_1', priceId: 'price_topup_50' },
        }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('skips when no subscription found for org', async () => {
      mockResolveTopUpCredits.mockReturnValue(50);
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);
      tx.subscription.findUnique.mockResolvedValue(null);

      const event = makeEvent(
        'checkout.session.completed',
        makeCheckoutSession({
          mode: 'payment',
          subscription: null,
          metadata: { type: 'top_up', organizationId: 'org_1', priceId: 'price_topup_50' },
        }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handlePaymentActionRequired
  // =========================================================================

  describe('handlePaymentActionRequired', () => {
    it('dispatches PAYMENT_ACTION_REQUIRED notification to admins', async () => {
      tx.subscription.findUnique.mockResolvedValue({
        organizationId: 'org_1',
        organization: { id: 'org_1', billingEmail: 'billing@co.com' },
      });
      tx.member.findMany.mockResolvedValue([{ userId: 'usr_1' }]);

      const event = makeEvent('invoice.payment_action_required', makeInvoice());

      await routeStripeEvent(event, tx);

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PAYMENT_ACTION_REQUIRED',
          title: 'Payment verification required',
        }),
      );
      expect(mockEmailSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'billing@co.com',
          subject: 'Payment verification required',
        }),
      );
    });

    it('skips when no subscription ID in invoice', async () => {
      const event = makeEvent(
        'invoice.payment_action_required',
        makeInvoice({ parent: null }),
      );

      await routeStripeEvent(event, tx);

      expect(tx.subscription.findUnique).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleSubscriptionPaused
  // =========================================================================

  describe('handleSubscriptionPaused', () => {
    it('sets status to PAUSED on existing subscription', async () => {
      tx.subscription.findUnique.mockResolvedValue({ id: 'db_sub_1' });
      tx.subscription.update.mockResolvedValue({ organizationId: 'org_1' });

      const event = makeEvent('customer.subscription.paused', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(tx.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_123' },
        data: { status: 'PAUSED' },
      });
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it('skips when subscription not found in DB', async () => {
      tx.subscription.findUnique.mockResolvedValue(null);

      const event = makeEvent('customer.subscription.paused', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(tx.subscription.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleChargeRefunded
  // =========================================================================

  describe('handleChargeRefunded', () => {
    it('creates audit ledger entry with 0 credits', async () => {
      tx.subscription.findFirst.mockResolvedValue({
        organizationId: 'org_1',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);

      const event = makeEvent('charge.refunded', {
        id: 'ch_123',
        amount_refunded: 1500,
        customer: 'cus_abc',
        payment_intent: 'pi_123',
      });

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org_1',
          credits: 0,
          reason: 'REFUND_AUDIT',
          stripeEventId: 'refund_ch_123',
        }),
      });
    });

    it('skips when customer ID is missing', async () => {
      const event = makeEvent('charge.refunded', {
        id: 'ch_no_cust',
        amount_refunded: 500,
        customer: null,
        payment_intent: null,
      });

      await routeStripeEvent(event, tx);

      expect(tx.subscription.findFirst).not.toHaveBeenCalled();
      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('skips when no subscription found for customer', async () => {
      tx.subscription.findFirst.mockResolvedValue(null);

      const event = makeEvent('charge.refunded', {
        id: 'ch_orphan',
        amount_refunded: 500,
        customer: 'cus_orphan',
        payment_intent: null,
      });

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('deduplicates refund audit entries by chargeId', async () => {
      tx.subscription.findFirst.mockResolvedValue({
        organizationId: 'org_1',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });
      tx.ocrCreditLedger.findFirst.mockResolvedValue({ id: 'existing' });

      const event = makeEvent('charge.refunded', {
        id: 'ch_dup',
        amount_refunded: 1500,
        customer: 'cus_abc',
        payment_intent: null,
      });

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });

    it('extracts customer ID from object form', async () => {
      tx.subscription.findFirst.mockResolvedValue({
        organizationId: 'org_1',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });
      tx.ocrCreditLedger.findFirst.mockResolvedValue(null);

      const event = makeEvent('charge.refunded', {
        id: 'ch_obj',
        amount_refunded: 500,
        customer: { id: 'cus_obj_id' },
        payment_intent: null,
      });

      await routeStripeEvent(event, tx);

      expect(tx.subscription.findFirst).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_obj_id' },
        select: expect.any(Object),
      });
    });
  });

  // =========================================================================
  // handleSubscriptionUpdated - tier change notification
  // =========================================================================

  describe('handleSubscriptionUpdated - tier change', () => {
    it('dispatches notification when tier changes', async () => {
      tx.subscription.findUnique.mockResolvedValue({ tier: 'STARTER' });
      tx.member.findMany.mockResolvedValue([{ userId: 'usr_1' }]);
      mockResolveTierFromPriceId.mockReturnValue('PRO');

      const event = makeEvent('customer.subscription.updated', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUBSCRIPTION_CHANGED',
          body: expect.stringContaining('STARTER'),
        }),
      );
    });

    it('does not dispatch notification when tier stays the same', async () => {
      tx.subscription.findUnique.mockResolvedValue({ tier: 'PRO' });
      mockResolveTierFromPriceId.mockReturnValue('PRO');

      const event = makeEvent('customer.subscription.updated', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('extracts customer ID from object form', async () => {
      tx.subscription.findUnique.mockResolvedValue(null);
      const sub = makeSubscription({ customer: { id: 'cus_obj' } });
      const event = makeEvent('customer.subscription.updated', sub);

      await routeStripeEvent(event, tx);

      expect(tx.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            stripeCustomerId: 'cus_obj',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // handleCheckoutCompleted - missing subscription ID
  // =========================================================================

  describe('handleCheckoutCompleted - edge cases', () => {
    it('returns early when session has no subscription ID', async () => {
      const event = makeEvent(
        'checkout.session.completed',
        makeCheckoutSession({ subscription: null }),
      );

      await routeStripeEvent(event, tx);

      expect(mockStripeSubscriptionsRetrieve).not.toHaveBeenCalled();
    });

    it('returns early when organizationId missing from subscription metadata', async () => {
      mockStripeSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({ status: 'trialing', metadata: {} }),
      );
      tx.subscription.findUnique.mockResolvedValue(null);

      const event = makeEvent('checkout.session.completed', makeCheckoutSession());

      await routeStripeEvent(event, tx);

      expect(tx.ocrCreditLedger.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleTrialWillEnd - edge cases
  // =========================================================================

  describe('handleTrialWillEnd - edge cases', () => {
    it('returns early when subscription not found in DB', async () => {
      tx.subscription.findUnique.mockResolvedValue(null);

      const event = makeEvent('customer.subscription.trial_will_end', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it('skips dispatch when no admin members found', async () => {
      tx.subscription.findUnique.mockResolvedValue({
        organization: { id: 'org_1', billingEmail: 'billing@test.com' },
      });
      tx.member.findMany.mockResolvedValue([]);

      const event = makeEvent('customer.subscription.trial_will_end', makeSubscription());

      await routeStripeEvent(event, tx);

      expect(mockDispatch).not.toHaveBeenCalled();
      // email should still be sent
      expect(mockEmailSend).toHaveBeenCalled();
    });
  });
});
