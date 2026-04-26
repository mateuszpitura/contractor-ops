import { createLogger } from '@contractor-ops/logger';
import Stripe from 'stripe';
import { CREDIT_PACK_CONTENT, PLAN_CONTENT } from './pricing-content';

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
  cachedStripeClient = new Stripe(key);
  return cachedStripeClient;
}

/** Safely extract a Stripe.Price from an expanded default_price field. */
function resolvePrice(defaultPrice: string | Stripe.Price | null | undefined): Stripe.Price | null {
  if (!defaultPrice || typeof defaultPrice === 'string') return null;
  return defaultPrice;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface PricingPlan {
  id: string;
  name: string;
  /** Marketing description — from local config */
  description: string;
  /** Feature list — from local config, NOT Stripe metadata */
  features: string[];
  monthlyPrice: number | null;
  annualPrice: number | null;
  currency: string;
  /** CTA destination — always your app's signup route */
  ctaHref: string;
  popular: boolean;
  order: number;
}

export interface CreditPack {
  id: string;
  name: string;
  /** Marketing description — from local config */
  description: string;
  credits: number;
  price: number;
  currency: string;
  perCredit: number;
  /** CTA destination — always your app's signup/billing route */
  ctaHref: string;
  popular: boolean;
  order: number;
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

      return {
        id: product.id,
        name: product.name,
        description: content?.description ?? product.description ?? '',
        features: content?.features ?? [],
        monthlyPrice: monthlyPrice?.unit_amount ? monthlyPrice.unit_amount / 100 : null,
        annualPrice: annualPrice?.unit_amount ? annualPrice.unit_amount / 100 : null,
        currency: monthlyPrice?.currency ?? annualPrice?.currency ?? 'pln',
        ctaHref: `/signup?plan=${slug}`,
        popular: content?.popular ?? false,
        order: Number(product.metadata.order) || content?.order || 99,
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

      return {
        id: product.id,
        name: product.name,
        description: content?.description ?? '',
        credits,
        price: amount,
        currency: price?.currency ?? 'pln',
        perCredit: credits > 0 ? Math.round((amount / credits) * 100) / 100 : 0,
        ctaHref: `/signup?credits=${slug}`,
        popular: content?.popular ?? false,
        order: Number(product.metadata.order) || content?.order || 99,
      };
    })
    .sort((a, b) => a.order - b.order);

  return packs;
}

// ─── Helpers ────────────────────────────────────────────────────────

export function formatPrice(amount: number | null, currency: string): string {
  if (amount === null) return 'Custom';
  if (amount === 0) return 'Free';

  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
  }));
}

function getStaticFallbackCredits(): CreditPack[] {
  return Object.entries(CREDIT_PACK_CONTENT).map(([slug, content]) => ({
    id: slug,
    name: content.name,
    description: content.description,
    credits: content.fallbackCredits,
    price: content.fallbackPrice,
    currency: 'pln',
    perCredit:
      content.fallbackCredits > 0
        ? Math.round((content.fallbackPrice / content.fallbackCredits) * 100) / 100
        : 0,
    ctaHref: `/signup?credits=${slug}`,
    popular: content.popular,
    order: content.order,
  }));
}
