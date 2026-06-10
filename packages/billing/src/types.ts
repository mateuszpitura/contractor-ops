/**
 * Types for the pricing fetcher. Stripe is the single source of truth for
 * prices; these types describe the normalized shape consumed by landing and
 * the in-app billing UI.
 *
 * Markets, tiers, periods, and currencies are closed unions — any new entry
 * is a deliberate addition (Stripe metadata that does not match is rejected
 * at fetch time, surfacing the drift early).
 */

export const MARKETS = ['PL', 'DE', 'INTL', 'UK', 'UAE', 'SA'] as const;
export type Market = (typeof MARKETS)[number];

export const TIERS = ['STARTER', 'PRO', 'ENTERPRISE'] as const;
export type Tier = (typeof TIERS)[number];

export const PERIODS = ['month', 'year'] as const;
export type Period = (typeof PERIODS)[number];

export const CURRENCIES = ['pln', 'eur', 'gbp', 'aed', 'sar'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MARKET_CURRENCY: Record<Market, Currency> = {
  PL: 'pln',
  DE: 'eur',
  INTL: 'eur',
  UK: 'gbp',
  UAE: 'aed',
  SA: 'sar',
};

export const EU_MARKETS: ReadonlySet<Market> = new Set(['PL', 'DE', 'INTL']);
export const GDPR_CONSENT_MARKETS: ReadonlySet<Market> = new Set(['PL', 'DE', 'INTL', 'UK']);

export interface PricingPrice {
  /** Stripe price id, used directly in checkout */
  stripePriceId: string;
  /** Unit amount in major units (e.g. 49 for 49 PLN), already divided by 100 */
  amount: number;
  currency: Currency;
  period: Period;
}

export interface PricingPlan {
  /** Stable slug used in URLs + analytics events. Derived from tier + market. */
  id: string;
  market: Market;
  tier: Tier;
  /** Display name (from Stripe product) */
  name: string;
  /** Marketing description (from Stripe product description) */
  description: string;
  /** Seats included in the base price */
  includedSeats: number;
  /** OCR credits included per period */
  creditsIncluded: number;
  /** Stripe price id for per-seat overage */
  extraSeatPriceId: string | null;
  monthly: PricingPrice | null;
  annual: PricingPrice | null;
  /** True for the recommended/highlighted tier within a market */
  popular: boolean;
  sortOrder: number;
}

export type PricingByMarket = Record<Market, PricingPlan[]>;

export class PricingMetadataError extends Error {
  readonly stripeProductId: string;
  readonly missingFields: readonly string[];

  constructor(message: string, stripeProductId: string, missingFields: readonly string[]) {
    super(message);
    this.name = 'PricingMetadataError';
    this.stripeProductId = stripeProductId;
    this.missingFields = missingFields;
  }
}
