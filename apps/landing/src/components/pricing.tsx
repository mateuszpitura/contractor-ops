'use client';

import type { TailarkPricingTier } from '@contractor-ops/ui/components/tailark/pricing';
import { TailarkPricing } from '@contractor-ops/ui/components/tailark/pricing';
import { ArrowRight } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useLocale, useTranslations } from '@/i18n';
import { intlLocaleFor } from '@/lib/market';
import type { LandingPlanView } from '@/lib/pricing-types';
import { formatPrice } from '@/lib/pricing-types';
import { TrackClick } from './analytics/track-click';
import { FadeUp } from './motion-wrapper';

type Period = 'month' | 'year';

interface PricingProps {
  views: LandingPlanView[];
  annualSavings: number | null;
}

function PricingCta({ href, label, popular }: { href: string; label: string; popular: boolean }) {
  return (
    <a
      href={href}
      className={`group inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-semibold leading-snug transition-all active:scale-[0.98] ${
        popular
          ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
          : 'border border-border bg-surface-1 text-foreground hover:bg-muted/50'
      }`}>
      {label}
      <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

function buildPricingTier(
  view: LandingPlanView,
  period: Period,
  intlLocale: string,
): TailarkPricingTier {
  const { plan, features, ctaHref, ctaLabel } = view;
  const price = period === 'month' ? plan.monthly : plan.annual;
  const priceAmount = price?.amount ?? null;
  const checkoutHref = price
    ? `${ctaHref}&priceId=${price.stripePriceId}&period=${period}`
    : ctaHref;
  return {
    id: plan.id,
    name: plan.name,
    priceLabel: formatPrice(priceAmount, price?.currency ?? 'eur', {
      locale: intlLocale,
    }),
    priceSuffix:
      priceAmount !== null && priceAmount > 0 ? `/ ${period === 'month' ? 'mo' : 'yr'}` : undefined,
    description: `${plan.description} · Includes ${plan.includedSeats} seats · ${plan.creditsIncluded} OCR credits`,
    features,
    popular: plan.popular,
    cta: (
      <TrackClick
        event="pricing_cta_click"
        properties={{
          plan: plan.id,
          tier: plan.tier,
          market: plan.market,
          period,
        }}>
        <PricingCta href={checkoutHref} label={ctaLabel} popular={plan.popular} />
      </TrackClick>
    ),
  };
}

export function Pricing({ views, annualSavings }: PricingProps) {
  const locale = useLocale();
  const t = useTranslations();
  const [period, setPeriod] = useState<Period>('month');
  const intlLocale = intlLocaleFor(locale);

  const selectMonthly = useCallback(() => setPeriod('month'), []);
  const selectAnnual = useCallback(() => setPeriod('year'), []);

  const toggleMonthly = t.pricing.toggleMonthly ?? 'Monthly';
  const toggleAnnual = t.pricing.toggleAnnual ?? 'Annual';
  const popularBadge = t.pricing.popularBadge ?? 'Most popular';
  const annualBadge =
    annualSavings === null ? null : (t.pricing.annualSaveBadge ?? `Save ~${annualSavings}%`);

  return (
    // biome-ignore lint/correctness/useUniqueElementIds: anchor target for scroll navigation
    <section id="pricing" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <FadeUp className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            {t.pricing.label}
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-display">
            {t.pricing.headline}{' '}
            <span className="gradient-text">{t.pricing.headlineHighlight}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            {t.pricing.description}
          </p>
        </FadeUp>

        <FadeUp className="mt-10 flex flex-col items-center gap-2" delay={0.15}>
          {views.length > 0 && (
            <>
              <fieldset
                aria-label="Billing period"
                className="inline-flex items-center rounded-full border border-border/60 bg-surface-1/60 p-1">
                <button
                  type="button"
                  aria-pressed={period === 'month'}
                  onClick={selectMonthly}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    period === 'month'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {toggleMonthly}
                </button>
                <button
                  type="button"
                  aria-pressed={period === 'year'}
                  onClick={selectAnnual}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    period === 'year'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {toggleAnnual}
                </button>
              </fieldset>
              {annualBadge && period === 'year' && (
                <p className="text-xs font-medium text-primary">{annualBadge}</p>
              )}
            </>
          )}
        </FadeUp>

        {views.length === 0 ? (
          <FadeUp className="mt-12 text-center" delay={0.2}>
            <p className="text-muted-foreground">
              {t.pricing.unavailable ??
                'Pricing is loading from our billing provider. See the full pricing page for details.'}
            </p>
            <a
              href={`/${locale}/pricing`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
              {t.pricing.detailedLink}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </FadeUp>
        ) : (
          <FadeUp className="mx-auto mt-12 max-w-5xl" delay={0.2}>
            <TailarkPricing
              popularLabel={popularBadge}
              tiers={views.map(view => buildPricingTier(view, period, intlLocale))}
            />
          </FadeUp>
        )}

        <FadeUp className="mt-10 text-center" delay={0.3}>
          <a
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80 underline underline-offset-4">
            {t.pricing.detailedLink}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </FadeUp>
      </div>
    </section>
  );
}
