'use client';

import { Button as MovingBorderButton } from '@contractor-ops/ui/components/ace/moving-border';
import type { TailarkPricingTier } from '@contractor-ops/ui/components/tailark/pricing';
import { TailarkPricing } from '@contractor-ops/ui/components/tailark/pricing';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
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

export function Pricing({ views, annualSavings }: PricingProps) {
  const locale = useLocale();
  const t = useTranslations();
  const [period, setPeriod] = useState<Period>('month');
  const intlLocale = intlLocaleFor(locale);

  const toggleMonthly = t.pricing.toggleMonthly ?? 'Monthly';
  const toggleAnnual = t.pricing.toggleAnnual ?? 'Annual';
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
          <div
            role="group"
            aria-label="Billing period"
            className="inline-flex items-center rounded-full border border-border/60 bg-surface-1/60 p-1">
            <button
              type="button"
              aria-pressed={period === 'month'}
              onClick={() => setPeriod('month')}
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
              onClick={() => setPeriod('year')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                period === 'year'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              {toggleAnnual}
            </button>
          </div>
          {annualBadge && period === 'year' && (
            <p className="text-xs text-primary font-medium">{annualBadge}</p>
          )}
        </FadeUp>

        <FadeUp className="mt-12 mx-auto max-w-5xl" delay={0.2}>
          <TailarkPricing
            tiers={views.map((view): TailarkPricingTier => {
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
                  priceAmount !== null && priceAmount > 0
                    ? `/ ${period === 'month' ? 'mo' : 'yr'}`
                    : undefined,
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
                    {plan.popular ? (
                      <MovingBorderButton
                        as="a"
                        href={checkoutHref}
                        borderRadius="0.875rem"
                        duration={3200}
                        containerClassName="h-12 w-full"
                        borderClassName="bg-[radial-gradient(var(--color-primary)_40%,transparent_60%)] opacity-80"
                        className="bg-primary px-5 text-primary-foreground border-primary/40 text-sm font-semibold gap-2 w-full">
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" />
                          {ctaLabel}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </MovingBorderButton>
                    ) : (
                      <a
                        href={checkoutHref}
                        className="group inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] border border-border bg-surface-1 text-foreground hover:bg-muted/50">
                        {ctaLabel}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </a>
                    )}
                  </TrackClick>
                ),
              };
            })}
          />
        </FadeUp>

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
