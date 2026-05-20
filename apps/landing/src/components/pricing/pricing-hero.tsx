'use client';

import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { TrackClick } from '@/components/analytics/track-click';
import { FadeUp, StaggerContainer, StaggerItem } from '@/components/motion-wrapper';
import { useLocale } from '@/i18n';
import type { PricingPlan } from '@/lib/pricing-types';

export function PricingHero({ plans }: { plans: PricingPlan[] }) {
  const locale = useLocale();

  return (
    <section className="hero-mesh noise-overlay relative pt-32 pb-20 overflow-hidden">
      {/* Orbs */}
      <div className="orb orb-teal absolute -top-24 -right-32 h-[450px] w-[450px]" />
      <div className="orb orb-amber absolute bottom-0 -left-20 h-[350px] w-[350px]" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Back link */}
        <FadeUp>
          <a
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground mb-10">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </a>
        </FadeUp>

        <FadeUp className="text-center" delay={0.1}>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-hero leading-[1.05] tracking-[-0.035em]">
            Choose your <span className="gradient-text">plan</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-subhead text-muted-foreground">
            Start free, upgrade when you&rsquo;re ready. Every plan includes a 14-day Pro trial so
            you can explore everything before committing.
          </p>
        </FadeUp>

        {/* Plan cards — data from Stripe API at build time */}
        <StaggerContainer
          className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3 items-stretch max-w-4xl mx-auto"
          staggerDelay={0.1}>
          {plans.map(plan => (
            <StaggerItem key={plan.id}>
              <div
                className={`card-glow relative flex h-full flex-col rounded-2xl border bg-surface-1/70 p-7 backdrop-blur-sm ${
                  plan.popular ? 'border-primary/40 shadow-lg' : 'border-border/50'
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
                      {plan.monthlyPriceFormatted}
                    </span>
                    {plan.monthlyPrice !== null && plan.monthlyPrice > 0 && (
                      <span className="text-sm text-muted-foreground">/ contractor / mo</span>
                    )}
                    {plan.monthlyPrice === 0 && (
                      <span className="text-sm text-muted-foreground">up to 5 contractors</span>
                    )}
                  </div>
                  {plan.annualPrice !== null && plan.annualPrice > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      or {plan.annualPriceFormatted}/year (save ~20%)
                    </p>
                  )}
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

                <TrackClick event="pricing_hero_cta" properties={{ plan: plan.name }}>
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

        {/* Trust note */}
        <FadeUp className="mt-8 text-center" delay={0.35}>
          <p className="text-xs text-muted-foreground">
            Prices shown in PLN &middot; VAT added where applicable &middot; Cancel anytime &middot;
            No lock-in
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
