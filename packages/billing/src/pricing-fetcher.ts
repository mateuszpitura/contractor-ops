import { createLogger } from '@contractor-ops/logger';
import type Stripe from 'stripe';
import type { Currency, Market, Period, PricingPlan, PricingPrice, Tier } from './types.js';
import {
  CURRENCIES,
  MARKET_CURRENCY,
  MARKETS,
  PERIODS,
  PricingMetadataError,
  TIERS,
} from './types.js';

const log = createLogger({ service: 'billing-pricing-fetcher' });

const FIVE_MINUTES_MS = 5 * 60 * 1_000;

interface CacheEntry {
  plans: PricingPlan[];
  expiresAt: number;
}

interface FetchOptions {
  /**
   * Bypass the in-process cache. Useful for the seed script and tests.
   */
  forceRefresh?: boolean;
  /**
   * Override cache TTL in ms. Defaults to 5 minutes.
   */
  ttlMs?: number;
}

let cache: CacheEntry | null = null;

/**
 * Reset the in-process cache. Test-only helper.
 */
export function resetPricingCache(): void {
  cache = null;
}

interface ProductMetadata {
  tier: Tier;
  market: Market;
  includedSeats: number;
  creditsIncluded: number;
  extraSeatPriceId: string | null;
  sortOrder: number;
  popular: boolean;
}

const REQUIRED_KEYS = [
  'tier',
  'market',
  'included_seats',
  'credits_included',
  'sort_order',
] as const;

function isTier(value: string): value is Tier {
  return (TIERS as readonly string[]).includes(value);
}

function isMarket(value: string): value is Market {
  return (MARKETS as readonly string[]).includes(value);
}

function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

function isPeriod(value: string): value is Period {
  return (PERIODS as readonly string[]).includes(value);
}

function parseProductMetadata(product: Stripe.Product): ProductMetadata {
  const md = product.metadata ?? {};
  const missing: string[] = [];

  for (const key of REQUIRED_KEYS) {
    const raw = md[key];
    if (raw === undefined || raw === null || raw.trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new PricingMetadataError(
      `Stripe product ${product.id} (${product.name}) missing required metadata: ${missing.join(', ')}`,
      product.id,
      missing,
    );
  }

  const tier = md.tier?.trim().toUpperCase();
  if (!isTier(tier)) {
    throw new PricingMetadataError(
      `Stripe product ${product.id} has invalid tier "${md.tier}". Expected one of: ${TIERS.join(', ')}`,
      product.id,
      ['tier'],
    );
  }

  const market = md.market?.trim().toUpperCase();
  if (!isMarket(market)) {
    throw new PricingMetadataError(
      `Stripe product ${product.id} has invalid market "${md.market}". Expected one of: ${MARKETS.join(', ')}`,
      product.id,
      ['market'],
    );
  }

  const includedSeats = Number.parseInt(md.included_seats ?? '', 10);
  if (!Number.isFinite(includedSeats) || includedSeats < 0) {
    throw new PricingMetadataError(
      `Stripe product ${product.id} has invalid included_seats "${md.included_seats}"`,
      product.id,
      ['included_seats'],
    );
  }

  const creditsIncluded = Number.parseInt(md.credits_included ?? '', 10);
  if (!Number.isFinite(creditsIncluded) || creditsIncluded < 0) {
    throw new PricingMetadataError(
      `Stripe product ${product.id} has invalid credits_included "${md.credits_included}"`,
      product.id,
      ['credits_included'],
    );
  }

  const sortOrder = Number.parseInt(md.sort_order ?? '', 10);
  if (!Number.isFinite(sortOrder)) {
    throw new PricingMetadataError(
      `Stripe product ${product.id} has invalid sort_order "${md.sort_order}"`,
      product.id,
      ['sort_order'],
    );
  }

  return {
    tier,
    market,
    includedSeats,
    creditsIncluded,
    extraSeatPriceId: md.extra_seat_price_id?.trim() || null,
    sortOrder,
    popular: md.popular === 'true' || md.popular === '1',
  };
}

function normalizePrice(price: Stripe.Price, expected: Currency): PricingPrice {
  if (!price.recurring) {
    throw new Error(
      `Stripe price ${price.id} is not recurring. Pricing fetcher only handles subscription prices.`,
    );
  }

  const period = price.recurring.interval;
  if (!isPeriod(period)) {
    throw new Error(
      `Stripe price ${price.id} has unsupported interval "${period}". Expected month or year.`,
    );
  }

  if (price.unit_amount === null) {
    throw new Error(
      `Stripe price ${price.id} has null unit_amount. Tiered/usage pricing is not supported by the fetcher.`,
    );
  }

  const currency = price.currency.toLowerCase();
  if (!isCurrency(currency)) {
    throw new Error(
      `Stripe price ${price.id} has unsupported currency "${currency}". Expected one of: ${CURRENCIES.join(', ')}`,
    );
  }

  if (currency !== expected) {
    throw new Error(
      `Stripe price ${price.id} currency "${currency}" does not match market currency "${expected}"`,
    );
  }

  return {
    stripePriceId: price.id,
    amount: price.unit_amount / 100,
    currency,
    period,
  };
}

/**
 * Build the deterministic plan id from market + tier.
 *
 * Used as React key, analytics property, and URL slug. Lowercase for URL
 * friendliness; market segment is first so the slug groups by market when
 * sorted alphabetically.
 */
export function planId(market: Market, tier: Tier): string {
  return `${market.toLowerCase()}-${tier.toLowerCase()}`;
}

/**
 * Fetch all active subscription pricing from Stripe and normalize into a
 * deterministic shape consumed by landing + in-app billing UI.
 *
 * Stripe is the single source of truth: any plan that should be visible must
 * have an active product with full metadata + at least one active price.
 *
 * Throws {@link PricingMetadataError} if any active subscription product is
 * missing required metadata — this fails the landing build, surfacing config
 * drift before it reaches production.
 */
export async function fetchPricingPlans(
  stripe: Stripe,
  options: FetchOptions = {},
): Promise<PricingPlan[]> {
  const now = Date.now();
  if (!options.forceRefresh && cache && cache.expiresAt > now) {
    return cache.plans;
  }

  const ttl = options.ttlMs ?? FIVE_MINUTES_MS;

  // Paginate products. Active subscription products are tagged with metadata
  // `tier`; we filter on metadata after listing to avoid maintaining a
  // separate product-type taxonomy in Stripe.
  const products: Stripe.Product[] = [];
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (product.metadata?.tier) {
      products.push(product);
    }
  }

  if (products.length === 0) {
    log.warn({}, 'no active Stripe products with tier metadata — pricing will be empty');
    cache = { plans: [], expiresAt: now + ttl };
    return [];
  }

  // Fetch all active recurring prices once; map by product id below.
  const allPrices: Stripe.Price[] = [];
  for await (const price of stripe.prices.list({
    active: true,
    type: 'recurring',
    limit: 100,
  })) {
    allPrices.push(price);
  }

  const plans: PricingPlan[] = [];
  for (const product of products) {
    const metadata = parseProductMetadata(product);
    const expectedCurrency = MARKET_CURRENCY[metadata.market];
    const productPrices = allPrices.filter(p => {
      const productRef = typeof p.product === 'string' ? p.product : p.product.id;
      return productRef === product.id;
    });

    const monthlyRaw = productPrices.find(p => p.recurring?.interval === 'month');
    const annualRaw = productPrices.find(p => p.recurring?.interval === 'year');

    if (!(monthlyRaw || annualRaw)) {
      throw new PricingMetadataError(
        `Stripe product ${product.id} (${product.name}) has no active monthly or annual price`,
        product.id,
        ['price'],
      );
    }

    const monthly = monthlyRaw ? normalizePrice(monthlyRaw, expectedCurrency) : null;
    const annual = annualRaw ? normalizePrice(annualRaw, expectedCurrency) : null;

    plans.push({
      id: planId(metadata.market, metadata.tier),
      market: metadata.market,
      tier: metadata.tier,
      name: product.name,
      description: product.description ?? '',
      includedSeats: metadata.includedSeats,
      creditsIncluded: metadata.creditsIncluded,
      extraSeatPriceId: metadata.extraSeatPriceId,
      monthly,
      annual,
      popular: metadata.popular,
      sortOrder: metadata.sortOrder,
    });
  }

  plans.sort((a, b) => {
    if (a.market !== b.market) return a.market.localeCompare(b.market);
    return a.sortOrder - b.sortOrder;
  });

  cache = { plans, expiresAt: now + ttl };
  return plans;
}

/**
 * Filter fetched plans to a single market in display order.
 */
export function filterByMarket(plans: readonly PricingPlan[], market: Market): PricingPlan[] {
  return plans.filter(p => p.market === market).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Resolve a single plan by Stripe price id. Used by webhook handlers + tier
 * resolution that previously read from `PRICE_TO_TIER_MAP`.
 */
export function findPlanByPriceId(
  plans: readonly PricingPlan[],
  priceId: string,
): { plan: PricingPlan; period: Period } | null {
  for (const plan of plans) {
    if (plan.monthly?.stripePriceId === priceId) return { plan, period: 'month' };
    if (plan.annual?.stripePriceId === priceId) return { plan, period: 'year' };
  }
  return null;
}
