import type Stripe from 'stripe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPricingPlans,
  filterByMarket,
  findPlanByPriceId,
  planId,
  resetPricingCache,
} from '../pricing-fetcher.js';
import { PricingMetadataError } from '../types.js';

// ---------------------------------------------------------------------------
// Test helpers — build minimal Stripe API stub returning fixture data
// ---------------------------------------------------------------------------

interface Fixture {
  products: Stripe.Product[];
  prices: Stripe.Price[];
}

function makeProduct(overrides: Partial<Stripe.Product> & { id: string }): Stripe.Product {
  return {
    id: overrides.id,
    object: 'product',
    active: true,
    name: overrides.name ?? 'Test product',
    description: overrides.description ?? null,
    metadata: overrides.metadata ?? {},
    created: 0,
    updated: 0,
    livemode: false,
    type: 'service',
    attributes: [],
    default_price: null,
    images: [],
    package_dimensions: null,
    shippable: null,
    statement_descriptor: null,
    tax_code: null,
    unit_label: null,
    url: null,
  } as unknown as Stripe.Product;
}

function makePrice(
  overrides: Partial<Stripe.Price> & { id: string; product: string },
): Stripe.Price {
  return {
    id: overrides.id,
    object: 'price',
    active: true,
    billing_scheme: 'per_unit',
    created: 0,
    currency: overrides.currency ?? 'pln',
    livemode: false,
    lookup_key: null,
    metadata: {},
    nickname: null,
    product: overrides.product,
    recurring: overrides.recurring ?? {
      aggregate_usage: null,
      interval: 'month',
      interval_count: 1,
      trial_period_days: null,
      usage_type: 'licensed',
    },
    tax_behavior: 'unspecified',
    tiers_mode: null,
    transform_quantity: null,
    type: 'recurring',
    unit_amount: overrides.unit_amount ?? 9900,
    unit_amount_decimal: String(overrides.unit_amount ?? 9900),
    custom_unit_amount: null,
  } as unknown as Stripe.Price;
}

function makeStripe(fixture: Fixture): Stripe {
  const productsList = vi.fn(() => makeAsyncIterable(fixture.products));
  const pricesList = vi.fn(() => makeAsyncIterable(fixture.prices));
  return {
    products: { list: productsList },
    prices: { list: pricesList },
  } as unknown as Stripe;
}

function makeAsyncIterable<T>(items: T[]): AsyncIterable<T> & { autoPagingEach?: unknown } {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next(): Promise<IteratorResult<T>> {
          if (i < items.length) {
            return Promise.resolve({ value: items[i++] as T, done: false });
          }
          return Promise.resolve({ value: undefined as unknown as T, done: true });
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  resetPricingCache();
});

describe('fetchPricingPlans', () => {
  it('normalizes a single PL Starter product with monthly + annual prices', async () => {
    const product = makeProduct({
      id: 'prod_pl_starter',
      name: 'Starter — PL',
      description: 'Entry tier for Polish market',
      metadata: {
        tier: 'STARTER',
        market: 'PL',
        included_seats: '3',
        credits_included: '20',
        sort_order: '1',
        extra_seat_price_id: 'price_pl_extra',
        popular: 'false',
      },
    });
    const monthly = makePrice({
      id: 'price_pl_starter_m',
      product: product.id,
      currency: 'pln',
      unit_amount: 9900,
      recurring: { interval: 'month' } as Stripe.Price.Recurring,
    });
    const annual = makePrice({
      id: 'price_pl_starter_y',
      product: product.id,
      currency: 'pln',
      unit_amount: 99000,
      recurring: { interval: 'year' } as Stripe.Price.Recurring,
    });

    const plans = await fetchPricingPlans(
      makeStripe({ products: [product], prices: [monthly, annual] }),
      { forceRefresh: true },
    );

    expect(plans).toHaveLength(1);
    const plan = plans[0]!;
    expect(plan.id).toBe('pl-starter');
    expect(plan.market).toBe('PL');
    expect(plan.tier).toBe('STARTER');
    expect(plan.includedSeats).toBe(3);
    expect(plan.creditsIncluded).toBe(20);
    expect(plan.extraSeatPriceId).toBe('price_pl_extra');
    expect(plan.monthly).toEqual({
      stripePriceId: 'price_pl_starter_m',
      amount: 99,
      currency: 'pln',
      period: 'month',
    });
    expect(plan.annual).toEqual({
      stripePriceId: 'price_pl_starter_y',
      amount: 990,
      currency: 'pln',
      period: 'year',
    });
  });

  it('throws PricingMetadataError when required metadata is missing', async () => {
    const product = makeProduct({
      id: 'prod_bad',
      metadata: { tier: 'STARTER' },
    });
    const price = makePrice({
      id: 'price_bad',
      product: product.id,
      recurring: { interval: 'month' } as Stripe.Price.Recurring,
    });

    await expect(
      fetchPricingPlans(makeStripe({ products: [product], prices: [price] }), {
        forceRefresh: true,
      }),
    ).rejects.toBeInstanceOf(PricingMetadataError);
  });

  it('rejects products whose price currency does not match the market currency', async () => {
    const product = makeProduct({
      id: 'prod_de_mismatch',
      metadata: {
        tier: 'PRO',
        market: 'DE',
        included_seats: '10',
        credits_included: '100',
        sort_order: '2',
      },
    });
    const price = makePrice({
      id: 'price_de_mismatch',
      product: product.id,
      currency: 'pln',
      recurring: { interval: 'month' } as Stripe.Price.Recurring,
    });

    await expect(
      fetchPricingPlans(makeStripe({ products: [product], prices: [price] }), {
        forceRefresh: true,
      }),
    ).rejects.toThrowError(/does not match market currency/);
  });

  it('caches results across calls within the TTL window', async () => {
    const product = makeProduct({
      id: 'prod_intl',
      metadata: {
        tier: 'STARTER',
        market: 'INTL',
        included_seats: '3',
        credits_included: '20',
        sort_order: '1',
      },
    });
    const price = makePrice({
      id: 'price_intl_m',
      product: product.id,
      currency: 'eur',
      recurring: { interval: 'month' } as Stripe.Price.Recurring,
    });
    const stripe = makeStripe({ products: [product], prices: [price] });

    const first = await fetchPricingPlans(stripe, { forceRefresh: true, ttlMs: 60_000 });
    const second = await fetchPricingPlans(stripe);

    expect(second).toBe(first);
    expect(stripe.products.list).toHaveBeenCalledTimes(1);
  });

  it('skips products without tier metadata', async () => {
    const tiered = makeProduct({
      id: 'prod_pl',
      metadata: {
        tier: 'STARTER',
        market: 'PL',
        included_seats: '3',
        credits_included: '20',
        sort_order: '1',
      },
    });
    const untiered = makeProduct({
      id: 'prod_credit_pack',
      name: 'Credit pack',
      metadata: { plan_type: 'credits' },
    });
    const tieredPrice = makePrice({
      id: 'price_pl',
      product: tiered.id,
      currency: 'pln',
      recurring: { interval: 'month' } as Stripe.Price.Recurring,
    });

    const plans = await fetchPricingPlans(
      makeStripe({ products: [tiered, untiered], prices: [tieredPrice] }),
      { forceRefresh: true },
    );

    expect(plans.map(p => p.id)).toEqual(['pl-starter']);
  });
});

describe('filterByMarket', () => {
  it('returns only plans for the requested market in sort order', () => {
    const plans = [
      { id: 'de-pro', market: 'DE', tier: 'PRO', sortOrder: 2 },
      { id: 'pl-starter', market: 'PL', tier: 'STARTER', sortOrder: 1 },
      { id: 'pl-pro', market: 'PL', tier: 'PRO', sortOrder: 2 },
    ] as unknown as Parameters<typeof filterByMarket>[0];

    const result = filterByMarket(plans, 'PL');
    expect(result.map(p => p.id)).toEqual(['pl-starter', 'pl-pro']);
  });
});

describe('findPlanByPriceId', () => {
  it('matches monthly and annual prices to their plans', () => {
    const plan = {
      id: 'pl-starter',
      market: 'PL',
      tier: 'STARTER',
      monthly: { stripePriceId: 'price_m', amount: 99, currency: 'pln', period: 'month' },
      annual: { stripePriceId: 'price_y', amount: 990, currency: 'pln', period: 'year' },
    } as unknown as Parameters<typeof findPlanByPriceId>[0][number];

    expect(findPlanByPriceId([plan], 'price_m')).toEqual({ plan, period: 'month' });
    expect(findPlanByPriceId([plan], 'price_y')).toEqual({ plan, period: 'year' });
    expect(findPlanByPriceId([plan], 'price_unknown')).toBeNull();
  });
});

describe('planId', () => {
  it('produces lowercase market-tier slug', () => {
    expect(planId('PL', 'STARTER')).toBe('pl-starter');
    expect(planId('UAE', 'ENTERPRISE')).toBe('uae-enterprise');
  });
});
