import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: {
    subscription: { findUnique: vi.fn() },
    ocrCreditLedger: { aggregate: vi.fn(), create: vi.fn() },
    member: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../stripe-client', () => ({
  stripe: {
    billing: { meterEvents: { create: vi.fn() } },
  },
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn() },
}));

vi.mock('../notification-service', () => ({
  dispatch: vi.fn(),
}));

vi.mock('../cache', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(),
  CacheKeys: { creditBalance: (id: string) => `credit:${id}` },
  CacheTTL: { CREDIT_BALANCE: 300 },
}));

vi.mock('../billing-constants', () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@contractor-ops/db';
import { invalidate } from '../cache';
import { allocateTopUpCredits, checkAndDeductCredit, getCreditBalance } from '../credit-service';
import { stripe } from '../stripe-client';

// ---------------------------------------------------------------------------
// Typed mock handles
// ---------------------------------------------------------------------------

const mockPrisma = prisma as unknown as {
  subscription: { findUnique: ReturnType<typeof vi.fn> };
  ocrCreditLedger: {
    aggregate: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  member: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockStripe = stripe as unknown as {
  billing: {
    meterEvents: { create: ReturnType<typeof vi.fn> };
  };
};

const mockInvalidate = invalidate as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org_test_123';

function makeSubscription(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    organizationId: ORG_ID,
    status: 'ACTIVE',
    tier: 'STARTER',
    stripeCustomerId: 'cus_test',
    currentPeriodStart: new Date('2026-04-01'),
    currentPeriodEnd: new Date('2026-05-01'),
    ...overrides,
  };
}

function agg(sum: number | null) {
  return { _sum: { credits: sum } };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // $transaction passes the callback through with mockPrisma as the tx client
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  );

  mockStripe.billing.meterEvents.create.mockResolvedValue({});
});

// ===========================================================================
// getCreditBalance - CALCULATION LOGIC
// ===========================================================================

describe('getCreditBalance', () => {
  it('returns zeros when no subscription exists', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const result = await getCreditBalance(ORG_ID);

    expect(result).toEqual({ balance: 0, allowance: 0, used: 0, tier: null });
  });

  it('returns zeros when subscription status is CANCELED (not ACTIVE/TRIALING)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ status: 'CANCELED' }));

    const result = await getCreditBalance(ORG_ID);

    expect(result).toEqual({ balance: 0, allowance: 0, used: 0, tier: null });
  });

  it('computes balance and used from aggregate sums for STARTER (allowance=20)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
    // Net sum: top-ups offset deductions → net = -5
    mockPrisma.ocrCreditLedger.aggregate
      .mockResolvedValueOnce(agg(-5)) // all entries net
      .mockResolvedValueOnce(agg(-5)); // negative entries only

    const result = await getCreditBalance(ORG_ID);

    expect(result).toEqual({
      balance: -5,
      allowance: 20,
      used: 5,
      tier: 'STARTER',
    });
  });

  it('maps PRO tier to allowance=100', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'PRO' }));
    mockPrisma.ocrCreditLedger.aggregate
      .mockResolvedValueOnce(agg(0))
      .mockResolvedValueOnce(agg(0));

    const result = await getCreditBalance(ORG_ID);

    expect(result.allowance).toBe(100);
    expect(result.used).toBe(0);
    expect(result.tier).toBe('PRO');
  });

  it('maps ENTERPRISE tier to allowance=500', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'ENTERPRISE' }));
    mockPrisma.ocrCreditLedger.aggregate
      .mockResolvedValueOnce(agg(-50))
      .mockResolvedValueOnce(agg(-50));

    const result = await getCreditBalance(ORG_ID);

    expect(result.allowance).toBe(500);
    expect(result.used).toBe(50);
  });

  it('uses TRIAL_CREDIT_ALLOWANCE=5 for TRIALING status regardless of tier', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(
      makeSubscription({ status: 'TRIALING', tier: 'PRO' }),
    );
    mockPrisma.ocrCreditLedger.aggregate
      .mockResolvedValueOnce(agg(-3))
      .mockResolvedValueOnce(agg(-3));

    const result = await getCreditBalance(ORG_ID);

    // Allowance comes from TRIAL_CREDIT_ALLOWANCE, NOT from PRO tier
    expect(result.allowance).toBe(5);
    expect(result.used).toBe(3);
    expect(result.balance).toBe(-3);
  });

  it('defaults null aggregate sums to 0', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
    // Prisma returns null _sum when no rows match
    mockPrisma.ocrCreditLedger.aggregate
      .mockResolvedValueOnce(agg(null))
      .mockResolvedValueOnce(agg(null));

    const result = await getCreditBalance(ORG_ID);

    expect(result.balance).toBe(0);
    expect(result.used).toBe(0);
    expect(result.allowance).toBe(20);
  });

  it('balance reflects top-ups: net sum includes positive entries', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
    // 10 top-up credits added, 3 deducted → net = 7
    // Negative entries only: -3
    mockPrisma.ocrCreditLedger.aggregate
      .mockResolvedValueOnce(agg(7))
      .mockResolvedValueOnce(agg(-3));

    const result = await getCreditBalance(ORG_ID);

    expect(result.balance).toBe(7);
    expect(result.used).toBe(3);
  });
});

// ===========================================================================
// checkAndDeductCredit - DECISION TREE
// ===========================================================================

describe('checkAndDeductCredit', () => {
  // -------------------------------------------------------------------------
  // Branch: no subscription → { allowed: false, reason: "noSubscription" }
  // -------------------------------------------------------------------------

  describe('when no active subscription exists', () => {
    it("denies with reason 'noSubscription' when subscription is null", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        reason: 'noSubscription',
      });
    });

    it("denies with reason 'noSubscription' when status is CANCELED", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ status: 'CANCELED' }),
      );

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        reason: 'noSubscription',
      });
    });

    it('exits early before ledger/meter — no subscription means no credit check attempted', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await checkAndDeductCredit(ORG_ID);

      // The noSubscription branch returns immediately after findUnique,
      // so neither ledger deduction nor Stripe metering should run
      expect(mockPrisma.ocrCreditLedger.create).not.toHaveBeenCalled();
      expect(mockPrisma.ocrCreditLedger.aggregate).not.toHaveBeenCalled();
      expect(mockStripe.billing.meterEvents.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Branch: used >= allowance → { allowed: false, reason: "creditsExhausted" }
  // -------------------------------------------------------------------------

  describe('when credits are exhausted', () => {
    it('STARTER: denies at exactly 20 used (boundary: used === allowance)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-20));

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        reason: 'creditsExhausted',
      });
    });

    it('STARTER: denies when over-consumed (used > allowance, e.g., from race)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-22));

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        reason: 'creditsExhausted',
      });
    });

    it('TRIALING: denies at exactly 5 used (TRIAL_CREDIT_ALLOWANCE boundary)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ status: 'TRIALING', tier: 'STARTER' }),
      );
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-5));

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result).toEqual({
        allowed: false,
        remaining: 0,
        reason: 'creditsExhausted',
      });
    });

    it('skips deduction, meter, and cache — remaining <= 0 exits before side effects', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-20));

      await checkAndDeductCredit(ORG_ID);

      // The creditsExhausted branch returns after aggregate check (remaining <= 0),
      // so no ledger entry is created, no Stripe event is fired, and cache is not invalidated
      expect(mockPrisma.ocrCreditLedger.create).not.toHaveBeenCalled();
      expect(mockStripe.billing.meterEvents.create).not.toHaveBeenCalled();
      expect(mockInvalidate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Branch: used < allowance → deduct, return { allowed: true, remaining }
  // -------------------------------------------------------------------------

  describe('when credits are available', () => {
    it('STARTER: allows at used=19 (boundary: last credit), remaining=0', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-19));
      mockPrisma.ocrCreditLedger.create.mockResolvedValue({});

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result.allowed).toBe(true);
      // remaining = allowance(20) - used(19) - 1(deducted) = 0
      expect(result.remaining).toBe(0);
    });

    it('STARTER: allows at used=0 (fresh period), remaining=19', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(0));
      mockPrisma.ocrCreditLedger.create.mockResolvedValue({});

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result.allowed).toBe(true);
      // remaining = 20 - 0 - 1 = 19
      expect(result.remaining).toBe(19);
    });

    it('PRO: remaining = 100 - used - 1', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'PRO' }));
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-50));
      mockPrisma.ocrCreditLedger.create.mockResolvedValue({});

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49); // 100 - 50 - 1
    });

    it('ENTERPRISE: remaining = 500 - used - 1', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ tier: 'ENTERPRISE' }),
      );
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-200));
      mockPrisma.ocrCreditLedger.create.mockResolvedValue({});

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(299); // 500 - 200 - 1
    });

    it('TRIALING: allows at used=4, remaining=0 (last trial credit)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ status: 'TRIALING', tier: 'STARTER' }),
      );
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-4));
      mockPrisma.ocrCreditLedger.create.mockResolvedValue({});

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result.allowed).toBe(true);
      // remaining = 5 - 4 - 1 = 0
      expect(result.remaining).toBe(0);
    });

    it('handles null aggregate sum as 0 used (no ledger rows yet)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(null));
      mockPrisma.ocrCreditLedger.create.mockResolvedValue({});

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // 20 - 0 - 1
    });
  });

  // -------------------------------------------------------------------------
  // Side effects: ledger entry, Stripe meter, cache invalidation
  // -------------------------------------------------------------------------

  describe('side effects on successful deduction', () => {
    beforeEach(() => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ tier: 'STARTER', stripeCustomerId: 'cus_abc' }),
      );
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-5));
      mockPrisma.ocrCreditLedger.create.mockResolvedValue({});
    });

    it("creates ledger entry with credits=-1 and reason='OCR_EXTRACTION'", async () => {
      await checkAndDeductCredit(ORG_ID);

      expect(mockPrisma.ocrCreditLedger.create).toHaveBeenCalledOnce();
      const data = mockPrisma.ocrCreditLedger.create.mock.calls[0]?.[0].data;
      expect(data.organizationId).toBe(ORG_ID);
      expect(data.credits).toBe(-1);
      expect(data.reason).toBe('OCR_EXTRACTION');
      expect(data.periodStart).toEqual(new Date('2026-04-01'));
      expect(data.periodEnd).toEqual(new Date('2026-05-01'));
    });

    it("fires Stripe meter event with customer ID and value '1'", async () => {
      await checkAndDeductCredit(ORG_ID);

      expect(mockStripe.billing.meterEvents.create).toHaveBeenCalledOnce();
      // F-INT-04: meter event identifier is derived from the ledger row id
      // (or organizationId+timestamp fallback) so Stripe natively dedupes
      // concurrent retries within the meter-aggregation window.
      expect(mockStripe.billing.meterEvents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: 'ocr_extraction',
          identifier: expect.any(String),
          payload: {
            stripe_customer_id: 'cus_abc',
            value: '1',
          },
        }),
      );
    });

    it('invalidates credit balance cache', async () => {
      await checkAndDeductCredit(ORG_ID);

      expect(mockInvalidate).toHaveBeenCalledWith(`credit:${ORG_ID}`);
    });
  });

  describe('side effects when deduction uses last credit (remaining=0)', () => {
    it('does not strip reason field from result (no reason on success)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-19));
      mockPrisma.ocrCreditLedger.create.mockResolvedValue({});
      // Prevent notification lookup from failing
      mockPrisma.member.findMany.mockResolvedValue([]);

      const result = await checkAndDeductCredit(ORG_ID);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('Stripe meter event is skipped when stripeCustomerId is null', () => {
    it('does not call meterEvents.create', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ tier: 'STARTER', stripeCustomerId: null }),
      );
      mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(-5));
      mockPrisma.ocrCreditLedger.create.mockResolvedValue({});

      await checkAndDeductCredit(ORG_ID);

      expect(mockStripe.billing.meterEvents.create).not.toHaveBeenCalled();
    });
  });
});

// ===========================================================================
// allocateTopUpCredits - INPUT VALIDATION + BALANCE CALCULATION
// ===========================================================================

describe('allocateTopUpCredits', () => {
  it('throws when credits <= 0 (zero)', async () => {
    await expect(allocateTopUpCredits({ organizationId: ORG_ID, credits: 0 })).rejects.toThrow(
      'Credits must be positive',
    );
  });

  it('throws when credits <= 0 (negative)', async () => {
    await expect(allocateTopUpCredits({ organizationId: ORG_ID, credits: -5 })).rejects.toThrow(
      'Credits must be positive',
    );
  });

  it('throws when no subscription exists', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(allocateTopUpCredits({ organizationId: ORG_ID, credits: 10 })).rejects.toThrow(
      'No subscription found',
    );
  });

  it('creates ledger entry with correct amount and period from subscription', async () => {
    const sub = makeSubscription({ tier: 'STARTER' });
    mockPrisma.subscription.findUnique.mockResolvedValue(sub);
    mockPrisma.ocrCreditLedger.create.mockResolvedValue({});
    mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(25));

    await allocateTopUpCredits({
      organizationId: ORG_ID,
      credits: 25,
      stripeEventId: 'evt_abc',
    });

    expect(mockPrisma.ocrCreditLedger.create).toHaveBeenCalledWith({
      data: {
        organizationId: ORG_ID,
        credits: 25,
        reason: 'TOP_UP',
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
        stripeEventId: 'evt_abc',
      },
    });
  });

  it('sets stripeEventId to null when not provided', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
    mockPrisma.ocrCreditLedger.create.mockResolvedValue({});
    mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(10));

    await allocateTopUpCredits({
      organizationId: ORG_ID,
      credits: 10,
    });

    const data = mockPrisma.ocrCreditLedger.create.mock.calls[0]?.[0].data;
    expect(data.stripeEventId).toBeNull();
  });

  it('queries aggregate within subscription billing period after top-up', async () => {
    const sub = makeSubscription({ tier: 'STARTER' });
    mockPrisma.subscription.findUnique.mockResolvedValue(sub);
    mockPrisma.ocrCreditLedger.create.mockResolvedValue({});
    mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(35));

    const result = await allocateTopUpCredits({
      organizationId: ORG_ID,
      credits: 10,
    });

    // Verify aggregate uses the subscription's billing period as filter
    expect(mockPrisma.ocrCreditLedger.aggregate).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
      },
      _sum: { credits: true },
    });
    expect(result.balance).toBe(35);
  });

  it('returns 0 balance when aggregate sum is null', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
    mockPrisma.ocrCreditLedger.create.mockResolvedValue({});
    mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(null));

    const result = await allocateTopUpCredits({
      organizationId: ORG_ID,
      credits: 10,
    });

    expect(result.balance).toBe(0);
  });

  it('invalidates credit balance cache after top-up', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSubscription({ tier: 'STARTER' }));
    mockPrisma.ocrCreditLedger.create.mockResolvedValue({});
    mockPrisma.ocrCreditLedger.aggregate.mockResolvedValue(agg(10));

    await allocateTopUpCredits({
      organizationId: ORG_ID,
      credits: 10,
    });

    expect(mockInvalidate).toHaveBeenCalledWith(`credit:${ORG_ID}`);
  });
});
