'use client';

import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useLocale, useTranslations } from '@/i18n';
import { intlLocaleFor } from '@/lib/market';
import type { LandingPlanView } from '@/lib/pricing-types';
import { formatPrice } from '@/lib/pricing-types';
import { TrackClick } from './analytics/track-click';
import { FadeUp, StaggerContainer, StaggerItem } from './motion-wrapper';

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
            role="tablist"
            aria-label="Billing period"
            className="inline-flex items-center rounded-full border border-border/60 bg-surface-1/60 p-1">
            <button
              role="tab"
              type="button"
              aria-selected={period === 'month'}
              onClick={() => setPeriod('month')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                period === 'month'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              {toggleMonthly}
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={period === 'year'}
              onClick={() => setPeriod('year')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
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

        <StaggerContainer
          className="mt-12 mx-auto max-w-4xl grid grid-cols-1 gap-5 md:grid-cols-3 items-stretch"
          staggerDelay={0.1}>
          {views.map(view => {
            const { plan, features, ctaHref, ctaLabel } = view;
            const price = period === 'month' ? plan.monthly : plan.annual;
            const priceAmount = price?.amount ?? null;
            const checkoutHref = price
              ? `${ctaHref}&priceId=${price.stripePriceId}&period=${period}`
              : ctaHref;
            return (
              <StaggerItem key={plan.id}>
                <div className="relative h-full">
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                      <Sparkles className="h-3 w-3" />
                      Most popular
                    </div>
                  )}
                  <div
                    className={`card-glow glass-medium atelier-shimmer relative flex h-full flex-col rounded-2xl p-7 ${
                      plan.popular ? 'atelier-border-glow' : ''
                    }`}>
                    <div className="mb-6">
                      <h3 className="font-display text-lg font-bold text-foreground">
                        {plan.name}
                      </h3>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="font-display text-4xl font-extrabold tracking-tight text-foreground">
                          {formatPrice(priceAmount, price?.currency ?? 'eur', {
                            locale: intlLocale,
                          })}
                        </span>
                        {priceAmount !== null && priceAmount > 0 && (
                          <span className="text-sm text-muted-foreground">
                            / {period === 'month' ? 'mo' : 'yr'}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Includes {plan.includedSeats} seats &middot; {plan.creditsIncluded} OCR
                        credits
                      </p>
                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    <ul className="mb-8 flex-1 space-y-3">
                      {features.map(feature => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="text-sm text-foreground/85">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <TrackClick
                      event="pricing_cta_click"
                      properties={{ plan: plan.id, tier: plan.tier, market: plan.market, period }}>
                      <a
                        href={checkoutHref}
                        className={`group inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                          plan.popular
                            ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                            : 'border border-border bg-surface-1 text-foreground hover:bg-muted/50'
                        }`}>
                        {ctaLabel}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </a>
                    </TrackClick>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

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
