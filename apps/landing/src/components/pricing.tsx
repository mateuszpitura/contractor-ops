'use client';

import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { useLocale } from '@/i18n';
import type { PricingPlan } from '@/lib/stripe';
import { formatPrice } from '@/lib/stripe';
import { TrackClick } from './analytics/track-click';
import { FadeUp, StaggerContainer, StaggerItem } from './motion-wrapper';

export function Pricing({ plans }: { plans: PricingPlan[] }) {
  const locale = useLocale();

  return (
    // biome-ignore lint/correctness/useUniqueElementIds: anchor target for scroll navigation
    <section id="pricing" className="relative py-28 sm:py-36 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <FadeUp className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-display">
            Simple pricing, <span className="gradient-text">serious value</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Start free with up to 5 contractors. Scale as you grow. No hidden fees, no per-seat
            surprises.
          </p>
        </FadeUp>

        <StaggerContainer
          className="mt-16 mx-auto max-w-4xl grid grid-cols-1 gap-5 md:grid-cols-3 items-stretch"
          staggerDelay={0.1}>
          {plans.map(plan => (
            <StaggerItem key={plan.id}>
              <div
                className={`card-glow glass-medium atelier-shimmer relative flex h-full flex-col rounded-2xl p-7 ${
                  plan.popular ? 'atelier-border-glow' : ''
                }`}>
                {!!plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                    <Sparkles className="h-3 w-3" />
                    Most popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-display text-lg font-bold text-foreground">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-extrabold tracking-tight text-foreground">
                      {formatPrice(plan.monthlyPrice, plan.currency)}
                    </span>
                    {plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
                      <span className="text-sm text-muted-foreground">per contractor / month</span>
                    )}
                    {plan.monthlyPrice === 0 && (
                      <span className="text-sm text-muted-foreground">up to 5 contractors</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm text-foreground/85">{feature}</span>
                    </li>
                  ))}
                </ul>

                <TrackClick event="pricing_cta_click" properties={{ plan: plan.name }}>
                  <a
                    href={plan.ctaHref}
                    className={`group inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                      plan.popular
                        ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                        : 'border border-border bg-surface-1 text-foreground hover:bg-muted/50'
                    }`}>
                    {plan.monthlyPrice === 0
                      ? 'Start free'
                      : plan.monthlyPrice === null
                        ? 'Talk to sales'
                        : 'Start 14-day trial'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </TrackClick>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Link to detailed pricing */}
        <FadeUp className="mt-10 text-center" delay={0.3}>
          <a
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80 underline underline-offset-4">
            See detailed pricing, credits & pay-as-you-go options
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </FadeUp>
      </div>
    </section>
  );
}
