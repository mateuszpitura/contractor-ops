/**
 * Pricing types and pure formatting helpers — safe to import from client
 * components. Server-side Stripe client lives in `./stripe.ts`.
 */

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  monthlyPrice: number | null;
  annualPrice: number | null;
  currency: string;
  ctaHref: string;
  popular: boolean;
  order: number;
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
