// Opt-in programmatic-ACH payout initiation (_initiatePayoutForRun).
//
// Asserts the load-bearing invariants directly on the helper the tRPC procedure
// delegates to, without the full router harness:
//   - no double-pay: a duplicate idempotency key returns the cached result and
//     never re-originates (the adapter is called once per item, on the first call)
//   - Plaid fail-open: an unverified / missing profile surfaces a per-item
//     advisory warning but the payout still proceeds — it never throws or blocks
//   - tenant isolation: items are loaded `where { paymentRunId, organizationId }`
//     with the exact `billingProfile.plaidVerificationStatus` include
//   - settlement wiring: the per-run override threads into resolveSettlementCurrency
//     and the adapter receives the settled amount; a missing rate errors, never zeroes

import { MockModernTreasuryAdapter } from '@contractor-ops/integrations';
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as E from '../../../errors';
import { __resetIdempotencyForTests } from '../../../lib/idempotency';
import { _initiatePayoutForRun } from '../payment-shared';

// The api vitest env points UPSTASH_REDIS_REST_URL at a placeholder, so the real
// idempotency helper would make a hanging network call. Replace it with a
// faithful in-memory store — the no-double-pay semantics (MISS → PENDING → HIT)
// are preserved so the duplicate-key assertion stays meaningful.
vi.mock('../../../lib/idempotency', () => {
  const PENDING = '__PENDING__';
  const store = new Map<string, string>();
  return {
    reserve: async (key: string) => {
      const existing = store.get(key);
      if (existing === undefined) {
        store.set(key, PENDING);
        return { kind: 'MISS' };
      }
      if (existing === PENDING) return { kind: 'PENDING' };
      return { kind: 'HIT', result: JSON.parse(existing) };
    },
    complete: async (key: string, result: unknown) => {
      store.set(key, JSON.stringify(result));
    },
    clear: async (key: string) => {
      store.delete(key);
    },
    __resetIdempotencyForTests: () => {
      store.clear();
    },
  };
});

vi.mock('../../../services/compliance-payment-gate', () => ({
  assertContractorPaymentEligibility: vi.fn(async () => undefined),
}));

const ORG_ID = 'org-1';
const OTHER_ORG_ID = 'org-2';
const USER_ID = 'user-1';
const RUN_ID = 'run-1';

type StubItem = {
  id: string;
  amountMinor: number;
  currency: string;
  contractorId: string;
  status: string;
  billingProfile: {
    plaidVerificationStatus: string | null;
    usRoutingNumberMasked: string | null;
    usAccountNumberMasked: string | null;
  } | null;
  contractor: { legalName: string; currency: string | null } | null;
};

function makeItem(overrides: Partial<StubItem> = {}): StubItem {
  return {
    id: 'item-1',
    amountMinor: 50_000,
    currency: 'USD',
    contractorId: 'contractor-1',
    status: 'PENDING',
    billingProfile: {
      plaidVerificationStatus: 'VERIFIED',
      usRoutingNumberMasked: '****0021',
      usAccountNumberMasked: '****6789',
    },
    contractor: { legalName: 'Jan Kowalski', currency: 'USD' },
    ...overrides,
  };
}

/**
 * Minimal Prisma-shaped stub. `paymentRunItem.findMany` echoes the seeded items,
 * `paymentRunItem.update` captures the persisted FX provenance, `auditLog.create`
 * is spied for the write-audit assertion, `exchangeRate.findFirst` models the ECB
 * feed (absent key → missing rate → null).
 */
function makeDb(items: StubItem[], rates: Record<string, number> = {}) {
  const seeded = items.map(i => ({ ...i, status: i.status ?? 'PENDING' }));
  const findMany = vi.fn(async (args?: { where?: { status?: { in: string[] } } }) => {
    const allowed = args?.where?.status?.in;
    if (!allowed) return seeded;
    return seeded.filter(i => allowed.includes(i.status));
  });
  const auditCreate = vi.fn(async () => ({}));
  const itemUpdate = vi.fn(async (_args: { where: { id: string }; data: unknown }) => ({}));
  const itemUpdateMany = vi.fn(async () => ({ count: 0 }));
  const runFindFirst = vi.fn(async () => ({ status: 'LOCKED' }));
  const runUpdate = vi.fn(async () => ({}));
  const tx = {
    paymentRunItem: { update: itemUpdate, updateMany: itemUpdateMany },
    paymentRun: { update: runUpdate },
  };
  const transaction = vi.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx));
  return {
    db: {
      paymentRun: { findFirst: runFindFirst, update: runUpdate },
      paymentRunItem: { findMany, update: itemUpdate },
      auditLog: { create: auditCreate },
      exchangeRate: {
        findFirst: async ({ where }: { where: { base: string; target: string } }) => {
          const rate = rates[`${where.base}->${where.target}`];
          if (rate === undefined) return null;
          return { rate, date: new Date('2026-07-01'), source: 'ECB' };
        },
      },
      $transaction: transaction,
    } as never,
    findMany,
    auditCreate,
    itemUpdate,
    runFindFirst,
    itemUpdateMany,
    runUpdate,
    transaction,
  };
}

const paymentDate = new Date('2026-07-01');

beforeEach(() => {
  __resetIdempotencyForTests();
});

describe('_initiatePayoutForRun — idempotency (no double-pay)', () => {
  it('returns the cached result on a duplicate idempotency key without re-originating', async () => {
    const { db } = makeDb([makeItem()]);
    const adapter = new MockModernTreasuryAdapter();
    const spy = vi.spyOn(adapter, 'initiatePayout');

    const args = {
      organizationId: ORG_ID,
      userId: USER_ID,
      runId: RUN_ID,
      idempotencyKey: 'idem-key-1',
      provider: 'MODERN_TREASURY' as const,
      adapter,
      paymentDate,
    };

    const first = await _initiatePayoutForRun(db, args);
    const second = await _initiatePayoutForRun(db, args);

    expect(spy).toHaveBeenCalledTimes(1); // one item, called once on the first run only
    expect(second).toEqual(first);
    expect(first.orders).toHaveLength(1);
  });
});

describe('_initiatePayoutForRun — Plaid advisory (fail-open, never blocks)', () => {
  it('warns on an unverified item but still initiates the payout', async () => {
    const { db } = makeDb([
      makeItem({
        id: 'item-pending',
        billingProfile: {
          plaidVerificationStatus: 'PENDING',
          usRoutingNumberMasked: '****0021',
          usAccountNumberMasked: '****6789',
        },
      }),
    ]);
    const adapter = new MockModernTreasuryAdapter();

    const result = await _initiatePayoutForRun(db, {
      organizationId: ORG_ID,
      userId: USER_ID,
      runId: RUN_ID,
      idempotencyKey: 'idem-key-pending',
      provider: 'MODERN_TREASURY',
      adapter,
      paymentDate,
    });

    expect(result.advisoryWarnings.length).toBeGreaterThan(0);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]?.orderId).toBeTruthy();
    expect(result.orders[0]?.advisoryWarning).toBeTruthy();
  });

  it('warns on a missing billing profile but still initiates the payout', async () => {
    const { db } = makeDb([makeItem({ id: 'item-noprofile', billingProfile: null })]);
    const adapter = new MockModernTreasuryAdapter();

    const result = await _initiatePayoutForRun(db, {
      organizationId: ORG_ID,
      userId: USER_ID,
      runId: RUN_ID,
      idempotencyKey: 'idem-key-noprofile',
      provider: 'MODERN_TREASURY',
      adapter,
      paymentDate,
    });

    expect(result.advisoryWarnings.length).toBeGreaterThan(0);
    expect(result.orders).toHaveLength(1);
  });

  it('carries no advisory warning when the item is Plaid-VERIFIED', async () => {
    const { db } = makeDb([makeItem()]);
    const adapter = new MockModernTreasuryAdapter();

    const result = await _initiatePayoutForRun(db, {
      organizationId: ORG_ID,
      userId: USER_ID,
      runId: RUN_ID,
      idempotencyKey: 'idem-key-verified',
      provider: 'MODERN_TREASURY',
      adapter,
      paymentDate,
    });

    expect(result.advisoryWarnings).toHaveLength(0);
    expect(result.orders[0]?.advisoryWarning).toBeUndefined();
  });
});

describe('_initiatePayoutForRun — tenant isolation', () => {
  it('loads run items scoped to the organization with the plaidVerificationStatus include', async () => {
    const { db, findMany } = makeDb([makeItem()]);
    const adapter = new MockModernTreasuryAdapter();

    await _initiatePayoutForRun(db, {
      organizationId: ORG_ID,
      userId: USER_ID,
      runId: RUN_ID,
      idempotencyKey: 'idem-key-tenant',
      provider: 'MODERN_TREASURY',
      adapter,
      paymentDate,
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    const call = findMany.mock.calls[0]?.[0] as {
      where: { paymentRunId: string; organizationId: string };
      include: { billingProfile: { select: { plaidVerificationStatus: boolean } } };
    };
    expect(call.where).toEqual({
      paymentRunId: RUN_ID,
      organizationId: ORG_ID,
      status: { in: ['PENDING'] },
    });
    expect(call.where.organizationId).not.toBe(OTHER_ORG_ID);
    expect(call.include.billingProfile.select.plaidVerificationStatus).toBe(true);
  });
});

describe('_initiatePayoutForRun — settlement wiring (88-05 seam)', () => {
  it('sends the raw amount when the settlement currency equals the item currency', async () => {
    const { db, itemUpdate } = makeDb([
      makeItem({
        amountMinor: 50_000,
        currency: 'USD',
        contractor: { legalName: 'A', currency: 'USD' },
      }),
    ]);
    const adapter = new MockModernTreasuryAdapter();
    const spy = vi.spyOn(adapter, 'initiatePayout');

    const result = await _initiatePayoutForRun(db, {
      organizationId: ORG_ID,
      userId: USER_ID,
      runId: RUN_ID,
      idempotencyKey: 'idem-key-same',
      provider: 'MODERN_TREASURY',
      adapter,
      paymentDate,
    });

    expect(result.orders[0]?.settlementCurrency).toBe('USD');
    expect(result.orders[0]?.settledAmountMinor).toBe(50_000);
    expect(spy.mock.calls[0]?.[0]?.currency).toBe('USD');
    expect(spy.mock.calls[0]?.[0]?.amountMinor).toBe(50_000);
    // Same-currency: no FX provenance, but the provider order id is persisted for ACH reconciliation.
    expect(itemUpdate).toHaveBeenCalledTimes(1);
    expect(itemUpdate.mock.calls[0]?.[0]?.data).toMatchObject({
      status: 'EXPORTED',
      paymentReference: expect.any(String),
    });
  });

  it('threads the per-run settlementCurrency override into the adapter amount', async () => {
    // Item is USD; override to PLN. Rate USD->PLN cross-rates through EUR:
    // EUR->USD 1.0 and EUR->PLN 4.0 => USD->PLN 4.0. 50_000 -> 200_000.
    const { db, itemUpdate } = makeDb([makeItem({ amountMinor: 50_000, currency: 'USD' })], {
      'EUR->USD': 1.0,
      'EUR->PLN': 4.0,
    });
    const adapter = new MockModernTreasuryAdapter();
    const spy = vi.spyOn(adapter, 'initiatePayout');

    const result = await _initiatePayoutForRun(db, {
      organizationId: ORG_ID,
      userId: USER_ID,
      runId: RUN_ID,
      idempotencyKey: 'idem-key-override',
      provider: 'MODERN_TREASURY',
      settlementCurrency: 'PLN',
      adapter,
      paymentDate,
    });

    expect(result.orders[0]?.settlementCurrency).toBe('PLN');
    expect(result.orders[0]?.settledAmountMinor).toBe(200_000);
    expect(spy.mock.calls[0]?.[0]?.currency).toBe('PLN');

    // FX provenance persisted, plus a second write stores the provider order id.
    expect(itemUpdate).toHaveBeenCalledTimes(2);
    const persisted = itemUpdate.mock.calls[0]?.[0]?.data as {
      settlementRate: number;
      settlementRateDate: Date;
    };
    expect(persisted.settlementRateDate).toEqual(paymentDate);
    expect(Math.round(50_000 * persisted.settlementRate)).toBe(200_000);
  });

  it('errors (never zeroes) when the settlement rate is missing', async () => {
    const { db } = makeDb([makeItem({ amountMinor: 50_000, currency: 'USD' })]); // no rates stubbed
    const adapter = new MockModernTreasuryAdapter();

    await expect(
      _initiatePayoutForRun(db, {
        organizationId: ORG_ID,
        userId: USER_ID,
        runId: RUN_ID,
        idempotencyKey: 'idem-key-norate',
        provider: 'MODERN_TREASURY',
        settlementCurrency: 'EUR',
        adapter,
        paymentDate,
      }),
    ).rejects.toMatchObject({ message: E.PAYMENT_SETTLEMENT_RATE_UNAVAILABLE });
  });
});

describe('_initiatePayoutForRun — audit + not-found', () => {
  it('writes a masked payout-initiated audit entry (no full routing/account)', async () => {
    const { db, auditCreate } = makeDb([makeItem()]);
    const adapter = new MockModernTreasuryAdapter();

    await _initiatePayoutForRun(db, {
      organizationId: ORG_ID,
      userId: USER_ID,
      runId: RUN_ID,
      idempotencyKey: 'idem-key-audit',
      provider: 'MODERN_TREASURY',
      adapter,
      paymentDate,
    });

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const row = auditCreate.mock.calls[0]?.[0] as {
      data: { action: string; metadataJson: unknown };
    };
    expect(row.data.action).toBe('payment_run.payout_initiated');
    const serialized = JSON.stringify(row.data.metadataJson);
    expect(serialized).not.toContain('6789'); // masked value never surfaces raw
    expect(serialized).not.toContain('routingNumber');
    expect(serialized).not.toContain('accountNumber');
  });

  it('throws NOT_FOUND when the run has no items for the tenant', async () => {
    const { db } = makeDb([]);
    const adapter = new MockModernTreasuryAdapter();

    await expect(
      _initiatePayoutForRun(db, {
        organizationId: ORG_ID,
        userId: USER_ID,
        runId: RUN_ID,
        idempotencyKey: 'idem-key-empty',
        provider: 'MODERN_TREASURY',
        adapter,
        paymentDate,
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
