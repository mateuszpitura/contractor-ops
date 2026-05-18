import type { Market, PricingPlan } from '@contractor-ops/billing/types';
import { fetchPricingPlans as billingFetchPricingPlans } from '@contractor-ops/billing';
import { createLogger } from '@contractor-ops/logger';
import Stripe from 'stripe';
import { CREDIT_PACK_CONTENT } from './pricing-content';
import type { CreditPack } from './pricing-types';
import { formatCount, formatPrice } from './pricing-types';

const log = createLogger({ service: 'landing-stripe' });

/**
 * Stripe client — server-side only (build / ISR revalidation).
 *
 * The landing app uses `output: 'export'`, so every Stripe call runs at
 * build time. Page revalidation re-runs the build for an individual
 * route; the in-process cache in `@contractor-ops/billing` collapses
 * duplicate calls across pages within a single build.
 */
let cachedStripeClient: Stripe | null | undefined;

function getStripeClient() {
  if (cachedStripeClient !== undefined) return cachedStripeClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'STRIPE_SECRET_KEY is required for production builds. ' +
          'Pricing comes from Stripe; without the key the build cannot resolve prices.',
      );
    }
    log.warn({}, 'STRIPE_SECRET_KEY not set — pricing fetches will return empty (dev only).');
    cachedStripeClient = null;
    return null;
  }
  cachedStripeClient = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  return cachedStripeClient;
}

/**
 * Fetch all subscription plans from Stripe and (optionally) filter by market.
 *
 * Throws if Stripe is configured but any active subscription product is
 * missing the required metadata. That failure is intentional — it surfaces
 * configuration drift in the build log before it reaches production.
 */
export async function fetchPricingPlans(market?: Market): Promise<PricingPlan[]> {
  const stripe = getStripeClient();
  if (!stripe) return [];
  const all = await billingFetchPricingPlans(stripe);
  return market ? all.filter(p => p.market === market) : all;
}

/**
 * Fetch credit / pay-as-you-go packs.
 *
 * Credit packs aren't market-scoped yet — leave them in landing for now.
 * When they move to multi-market, fold into `@contractor-ops/billing`.
 */
export async function fetchCreditPacks(): Promise<CreditPack[]> {
  const stripe = getStripeClient();

  if (!stripe) {
    return getStaticFallbackCredits();
  }

  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price'],
    limit: 50,
  });

  const packs: CreditPack[] = products.data
    .filter(p => p.metadata.plan_type === 'credits')
    .map(product => {
      const slug = product.metadata.slug ?? product.name.toLowerCase();
      const content = CREDIT_PACK_CONTENT[slug];
      const price =
        product.default_price && typeof product.default_price !== 'string'
          ? product.default_price
          : null;
      const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
      const credits = Number(product.metadata.credits) || 0;

      const currency = price?.currency ?? 'eur';
      const perCredit = credits > 0 ? Math.round((amount / credits) * 100) / 100 : 0;
      return {
        id: product.id,
        name: product.name,
        description: content?.description ?? '',
        credits,
        price: amount,
        currency,
        perCredit,
        ctaHref: `/signup?credits=${slug}`,
        popular: content?.popular ?? false,
        order: Number(product.metadata.order) || content?.order || 99,
        creditsFormatted: formatCount(credits),
        priceFormatted: formatPrice(amount, currency),
        perCreditFormatted: formatPrice(perCredit, currency),
      };
    })
    .sort((a, b) => a.order - b.order);

  return packs;
}

function getStaticFallbackCredits(): CreditPack[] {
  return Object.entries(CREDIT_PACK_CONTENT).map(([slug, content]) => {
    const perCredit =
      content.fallbackCredits > 0
        ? Math.round((content.fallbackPrice / content.fallbackCredits) * 100) / 100
        : 0;
    return {
      id: slug,
      name: content.name,
      description: content.description,
      credits: content.fallbackCredits,
      price: content.fallbackPrice,
      currency: 'eur',
      perCredit,
      ctaHref: `/signup?credits=${slug}`,
      popular: content.popular,
      order: content.order,
      creditsFormatted: formatCount(content.fallbackCredits),
      priceFormatted: formatPrice(content.fallbackPrice, 'eur'),
      perCreditFormatted: formatPrice(perCredit, 'eur'),
    };
  });
}
