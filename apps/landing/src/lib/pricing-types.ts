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
