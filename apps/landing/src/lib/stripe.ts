import { createLogger } from '@contractor-ops/logger';
import Stripe from 'stripe';
import { CREDIT_PACK_CONTENT, PLAN_CONTENT } from './pricing-content';
import type { CreditPack, PricingPlan } from './pricing-types';
import { formatCount, formatPrice } from './pricing-types';

const log = createLogger({ service: 'landing-stripe' });

/**
 * Stripe client — runs server-side only (build / ISR revalidation).
 * Never shipped to the client.
 */
let cachedStripeClient: Stripe | null | undefined;

function getStripeClient() {
  if (cachedStripeClient !== undefined) return cachedStripeClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'STRIPE_SECRET_KEY is required for production builds. ' +
          'Set it in your environment or the build will use fallback prices.',
      );
    }
    log.warn({}, 'STRIPE_SECRET_KEY not set — using fallback prices from pricing-content.ts');
    cachedStripeClient = null;
    return null;
  }
  cachedStripeClient = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  return cachedStripeClient;
}

/** Safely extract a Stripe.Price from an expanded default_price field. */
function resolvePrice(defaultPrice: string | Stripe.Price | null | undefined): Stripe.Price | null {
  if (!defaultPrice || typeof defaultPrice === 'string') return null;
  return defaultPrice;
}

// ─── Fetchers ───────────────────────────────────────────────────────

/**
 * Fetch subscription plans.
 *
 * Prices come from Stripe. Features, descriptions, and marketing copy
 * come from the local pricing-content.ts config — because those are
 * marketing decisions, not billing data.
 *
 * Stripe product metadata used:
 *   - `slug`: maps to PLAN_CONTENT key (e.g. "starter", "pro", "enterprise")
 *   - `order`: numeric sort order
 *   - `plan_type`: omit or "subscription" (vs "credits")
 */
export async function fetchPricingPlans(): Promise<PricingPlan[]> {
  const stripe = getStripeClient();

  if (!stripe) {
    return getStaticFallbackPlans();
  }

  const [products, prices] = await Promise.all([
    stripe.products.list({ active: true, limit: 50 }),
    stripe.prices.list({ active: true, type: 'recurring', limit: 100 }),
  ]);

  const plans: PricingPlan[] = products.data
    .filter(p => p.metadata.plan_type !== 'credits')
    .map(product => {
      const slug = product.metadata.slug ?? product.name.toLowerCase();
      const content = PLAN_CONTENT[slug];

      const productPrices = prices.data.filter(price => price.product === product.id);
      const monthlyPrice = productPrices.find(p => p.recurring?.interval === 'month');
      const annualPrice = productPrices.find(p => p.recurring?.interval === 'year');

      const monthlyAmount = monthlyPrice?.unit_amount ? monthlyPrice.unit_amount / 100 : null;
      const annualAmount = annualPrice?.unit_amount ? annualPrice.unit_amount / 100 : null;
      const currency = monthlyPrice?.currency ?? annualPrice?.currency ?? 'pln';
      return {
        id: product.id,
        name: product.name,
        description: content?.description ?? product.description ?? '',
        features: content?.features ?? [],
        monthlyPrice: monthlyAmount,
        annualPrice: annualAmount,
        currency,
        ctaHref: `/signup?plan=${slug}`,
        popular: content?.popular ?? false,
        order: Number(product.metadata.order) || content?.order || 99,
        monthlyPriceFormatted: formatPrice(monthlyAmount, currency),
        annualPriceFormatted: formatPrice(annualAmount, currency),
      };
    })
    .sort((a, b) => a.order - b.order);

  return plans;
}

/**
 * Fetch credit / pay-as-you-go packs.
 *
 * Stripe product metadata:
 *   - `plan_type`: "credits"
 *   - `slug`: maps to CREDIT_PACK_CONTENT key
 *   - `credits`: number of credits
 *   - `order`: sort order
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
      const price = resolvePrice(product.default_price);
      const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
      const credits = Number(product.metadata.credits) || 0;

      const currency = price?.currency ?? 'pln';
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

// ─── Static Fallbacks (dev without STRIPE_SECRET_KEY) ───────────────

function getStaticFallbackPlans(): PricingPlan[] {
  return Object.entries(PLAN_CONTENT).map(([slug, content]) => ({
    id: slug,
    name: content.name,
    description: content.description,
    features: content.features,
    monthlyPrice: content.fallbackMonthlyPrice,
    annualPrice: content.fallbackAnnualPrice,
    currency: 'pln',
    ctaHref: `/signup?plan=${slug}`,
    popular: content.popular,
    order: content.order,
    monthlyPriceFormatted: formatPrice(content.fallbackMonthlyPrice, 'pln'),
    annualPriceFormatted: formatPrice(content.fallbackAnnualPrice, 'pln'),
  }));
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
      currency: 'pln',
      perCredit,
      ctaHref: `/signup?credits=${slug}`,
      popular: content.popular,
      order: content.order,
      creditsFormatted: formatCount(content.fallbackCredits),
      priceFormatted: formatPrice(content.fallbackPrice, 'pln'),
      perCreditFormatted: formatPrice(perCredit, 'pln'),
    };
  });
}
