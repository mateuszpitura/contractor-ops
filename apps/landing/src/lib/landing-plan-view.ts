/**
 * Convert canonical Stripe-backed `PricingPlan[]` into the localized
 * `LandingPlanView[]` shape consumed by landing components.
 *
 * Per-market feature copy comes from i18n (Pricing.tiers.*) when available
 * and falls back to the structural defaults in `pricing-content.ts`.
 * Keeping marketing copy in i18n preserves per-market positioning (KSeF for
 * PL, ZUGFeRD for DE, Peppol PINT-AE for UAE …) without code changes.
 */
import type { PricingPlan, Tier } from '@contractor-ops/billing/types';
import type { Locale } from '@/i18n';
import type { TranslationMessages } from '@/i18n/get-translations';
import { TIER_CONTENT_FALLBACK } from './pricing-content';
import type { LandingPlanView } from './pricing-types';
import { formatPrice } from './pricing-types';

interface TierMessages {
  name?: string;
  description?: string;
  features?: readonly string[];
  excludedFeatures?: readonly string[];
}

interface PricingMessages {
  startFree?: string;
  startTrial?: string;
  talkToSales?: string;
  tiers?: Partial<Record<Tier, TierMessages>>;
}

type MessagesWithTiers = TranslationMessages & {
  pricing: PricingMessages & TranslationMessages['pricing'];
};

function pickTierContent(
  tier: Tier,
  messages?: MessagesWithTiers,
): { features: string[]; excludedFeatures: string[]; name?: string; description?: string } {
  const i18n = messages?.pricing.tiers?.[tier];
  const fallback = TIER_CONTENT_FALLBACK[tier];
  return {
    features: i18n?.features ? [...i18n.features] : [...fallback.features],
    excludedFeatures: i18n?.excludedFeatures
      ? [...i18n.excludedFeatures]
      : [...fallback.excludedFeatures],
    name: i18n?.name,
    description: i18n?.description,
  };
}

function pickCtaLabel(plan: PricingPlan, messages: MessagesWithTiers): string {
  if (plan.tier === 'ENTERPRISE') return messages.pricing.talkToSales ?? 'Talk to sales';
  return messages.pricing.startTrial ?? 'Start 14-day trial';
}

export function buildLandingPlanViews(
  plans: readonly PricingPlan[],
  messages: TranslationMessages,
  locale: Locale,
): LandingPlanView[] {
  const msg = messages as MessagesWithTiers;
  return plans.map(plan => {
    const content = pickTierContent(plan.tier, msg);
    const view: LandingPlanView = {
      plan:
        content.name || content.description
          ? {
              ...plan,
              name: content.name ?? plan.name,
              description: content.description ?? plan.description,
            }
          : plan,
      features: content.features,
      excludedFeatures: content.excludedFeatures,
      ctaHref: `/${locale}/signup?plan=${plan.id}`,
      ctaLabel: pickCtaLabel(plan, msg),
      monthlyPriceFormatted: plan.monthly
        ? formatPrice(plan.monthly.amount, plan.monthly.currency)
        : formatPrice(null, 'eur'),
      annualPriceFormatted: plan.annual
        ? formatPrice(plan.annual.amount, plan.annual.currency)
        : formatPrice(null, 'eur'),
    };
    return view;
  });
}

/**
 * Compute the annual savings percent for display next to the toggle.
 *
 * Returns `null` if monthly or annual price is missing, or if annual is not
 * actually a discount on monthly × 12. Uses the price of the popular plan
 * as the representative number (avoids per-tier label noise).
 */
export function annualSavingsPercent(plans: readonly PricingPlan[]): number | null {
  const candidate = plans.find(p => p.popular) ?? plans[0];
  if (!(candidate?.monthly && candidate.annual)) return null;
  const monthlyEquivalent = candidate.monthly.amount * 12;
  if (monthlyEquivalent <= 0) return null;
  const saved = monthlyEquivalent - candidate.annual.amount;
  if (saved <= 0) return null;
  return Math.round((saved / monthlyEquivalent) * 100);
}
