/**
 * Tailark-style multi-tier pricing block.
 *
 * Stands in for `@tailark/pricing-*` since tailark.com returns HTML for
 * every `/r/pricing-*.json` probe (probed 2026-05-26). Layout matches the
 * tailark 4-tier comparison pattern: aligned tier cards with feature
 * list, accented "popular" tier, plug-in CTA slot.
 */

import { Check } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../../lib/utils.js';

export interface TailarkPricingTier {
  id: string;
  name: string;
  priceLabel: string;
  priceSuffix?: string;
  description: string;
  features: readonly string[];
  popular?: boolean;
  cta: React.ReactNode;
}

export interface TailarkPricingProps {
  tiers: readonly TailarkPricingTier[];
  className?: string;
  popularLabel?: string;
}

export function TailarkPricing({ tiers, className, popularLabel }: TailarkPricingProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-5 items-stretch md:grid-cols-2 lg:grid-cols-4',
        className,
      )}>
      {tiers.map(tier => (
        <article
          key={tier.id}
          className={cn(
            'relative flex h-full flex-col rounded-2xl border bg-card p-6 transition-colors',
            tier.popular
              ? 'border-primary/40 pt-8 shadow-md'
              : 'border-border hover:border-border/80',
          )}>
          {tier.popular ? (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
              {popularLabel ?? 'Most popular'}
            </span>
          ) : null}
          <header className="mb-5">
            <h3 className="font-display text-lg font-semibold text-foreground">{tier.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                {tier.priceLabel}
              </span>
              {tier.priceSuffix ? (
                <span className="text-sm text-muted-foreground">{tier.priceSuffix}</span>
              ) : null}
            </p>
          </header>
          <ul className="mb-6 flex-1 space-y-2.5">
            {tier.features.map(feature => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="text-foreground/85">{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto">{tier.cta}</div>
        </article>
      ))}
    </div>
  );
}
