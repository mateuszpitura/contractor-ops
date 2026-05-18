/**
 * Pricing types + display helpers for landing components.
 *
 * Subscription pricing comes from `@contractor-ops/billing` (Stripe is the
 * single source of truth — see packages/billing/src/pricing-fetcher.ts).
 * Credit-pack pricing is one-off and stays local for now.
 */
import type { Currency, PricingPlan } from '@contractor-ops/billing/types';

export type {
  Currency,
  Market,
  Period,
  PricingPlan,
  Tier,
} from '@contractor-ops/billing/types';
export { MARKET_CURRENCY, MARKETS } from '@contractor-ops/billing/types';

/**
 * Plan as rendered on a landing page — pairs the canonical Stripe-backed
 * data with the localized marketing copy that surrounds it.
 */
export interface LandingPlanView {
  plan: PricingPlan;
  /** Localized bullet list (from i18n messages) */
  features: string[];
  /** Localized excluded-features list (optional, for comparison table) */
  excludedFeatures?: string[];
  ctaHref: string;
  /** Localized CTA label (e.g. "Start 14-day trial", "Talk to sales") */
  ctaLabel: string;
  /** Server-formatted price strings. Pre-rendered on the server so the
   * client doesn't re-run Intl.NumberFormat — eliminates the SSR/CSR
   * narrow-no-break-space drift that triggered hydration mismatches on
   * the pricing page. */
  monthlyPriceFormatted: string;
  annualPriceFormatted: string;
}

export interface CreditPack {
  id: string;
  name: string;
  description: string;
  credits: number;
  price: number;
  currency: string;
  perCredit: number;
  ctaHref: string;
  popular: boolean;
  order: number;
  /** Server-formatted display strings. Pre-rendered so the client doesn't
   * re-run Intl.NumberFormat / .toLocaleString() — eliminates SSR/CSR
   * narrow-no-break-space drift on the pricing page. */
  creditsFormatted: string;
  priceFormatted: string;
  perCreditFormatted: string;
}

/** Format an integer count (credits, contractor counts) with the same
 * locale-pinned formatter we use for prices. Keeps server and client
 * outputs byte-identical. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('pl-PL').format(value);
}

const CURRENCY_LOCALE: Record<Currency, string> = {
  pln: 'pl-PL',
  eur: 'de-DE',
  gbp: 'en-GB',
  aed: 'ar-AE',
  sar: 'ar-SA',
};

export function formatPrice(
  amount: number | null | undefined,
  currency: string,
  options: { fallback?: string; locale?: string } = {},
): string {
  if (amount === null || amount === undefined) return options.fallback ?? 'Custom';
  if (amount === 0) return options.fallback ?? 'Free';
  const cur = currency.toLowerCase();
  const locale = options.locale ?? CURRENCY_LOCALE[cur as Currency] ?? 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: cur.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
