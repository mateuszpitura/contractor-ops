'use client';

import { ArrowRight, FileSignature, Receipt, Send, UserPlus, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TrackClick } from '@/components/analytics/track-click';
import { FadeUp, StaggerContainer, StaggerItem } from '@/components/motion-wrapper';
import type { CreditPack } from '@/lib/stripe';
import { formatPrice } from '@/lib/stripe';

const creditCosts = [
  {
    icon: FileSignature,
    action: 'E-signature request',
    cost: 5,
    description: 'Send a contract for signing via DocuSign',
  },
  {
    icon: Receipt,
    action: 'KSeF invoice pull',
    cost: 1,
    description: 'Auto-fetch and match one invoice from KSeF',
  },
  {
    icon: UserPlus,
    action: 'Onboarding flow',
    cost: 3,
    description: 'Full onboarding checklist for one contractor',
  },
  {
    icon: Send,
    action: 'Batch payment export',
    cost: 2,
    description: 'Export one batch of approved invoices',
  },
];

const sliderStops = [10, 25, 50, 100, 200, 500];

export function CreditsSection({ creditPacks }: { creditPacks: CreditPack[] }) {
  const [contractorsCount, setContractorsCount] = useState(2);

  const contractors = sliderStops[contractorsCount];

  const monthlyEstimate = useMemo(() => {
    // Rough estimate: per contractor per month
    // ~2 KSeF pulls + 1 batch payment + 0.5 e-sign + 0.3 onboarding
    const creditsPerContractor = 2 * 1 + 1 * 2 + 0.5 * 5 + 0.3 * 3;
    const totalCredits = Math.ceil(contractors * creditsPerContractor);

    // Find best pack
    const pack =
      creditPacks.find(p => p.credits >= totalCredits) ?? creditPacks[creditPacks.length - 1];

    return { credits: totalCredits, pack };
  }, [contractors, creditPacks]);

  return (
    <section className="relative py-28 sm:py-36 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-2/30 to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-6">
        <FadeUp className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-warm/10">
            <Zap className="h-6 w-6 text-accent-warm" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-warm">
            Credits & Pay-as-you-go
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl font-display text-display">
            Pay only for <span className="gradient-text">what you use</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Some actions consume credits — e-signatures, KSeF pulls, batch exports. Buy credit packs
            upfront at a discount, or pay as you go. Unused credits never expire.
          </p>
        </FadeUp>

        {/* Credit cost reference */}
        <StaggerContainer
          className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          staggerDelay={0.07}>
          {creditCosts.map(item => (
            <StaggerItem key={item.action}>
              <div className="flex flex-col items-center rounded-2xl border border-border/40 bg-surface-1/60 p-5 text-center backdrop-blur-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
                  {item.cost}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                  credits
                </span>
                <p className="mt-2 text-sm font-medium text-foreground">{item.action}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Usage calculator */}
        <FadeUp className="mt-16" delay={0.2}>
          <div className="glass-medium rounded-3xl p-8 sm:p-10">
            <div className="flex flex-col items-center text-center">
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                Estimate your monthly credits
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Drag the slider to match your team size
              </p>

              <div className="mt-8 w-full max-w-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">10 contractors</span>
                  <span className="text-xs text-muted-foreground">500 contractors</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={sliderStops.length - 1}
                  value={contractorsCount}
                  onChange={e => setContractorsCount(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
                  aria-label="Number of contractors"
                />
                <div className="mt-4 flex items-baseline justify-center gap-2">
                  <span className="font-display text-4xl font-extrabold tracking-tight text-foreground">
                    {contractors}
                  </span>
                  <span className="text-sm text-muted-foreground">contractors</span>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
                <div className="text-center">
                  <div className="font-display text-3xl font-bold text-primary metric-glow">
                    ~{monthlyEstimate.credits}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">credits / month</div>
                </div>
                <div className="hidden sm:block h-10 w-px bg-border/40" />
                <div className="text-center">
                  <div className="font-display text-3xl font-bold text-foreground">
                    {formatPrice(monthlyEstimate.pack.price, monthlyEstimate.pack.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {monthlyEstimate.pack.name} ({monthlyEstimate.pack.credits.toLocaleString()}{' '}
                    credits)
                  </div>
                </div>
                <div className="hidden sm:block h-10 w-px bg-border/40" />
                <div className="text-center">
                  <div className="font-display text-3xl font-bold text-accent-warm">
                    {formatPrice(monthlyEstimate.pack.perCredit, monthlyEstimate.pack.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">per credit</div>
                </div>
              </div>
            </div>
          </div>
        </FadeUp>

        {/* Credit packs grid — data from Stripe API at build time */}
        <StaggerContainer
          className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          staggerDelay={0.08}>
          {creditPacks.map(pack => (
            <StaggerItem key={pack.id}>
              <div
                className={`card-glow relative flex flex-col rounded-2xl border p-6 backdrop-blur-sm ${
                  pack.popular
                    ? 'border-accent-warm/40 bg-accent-warm/3 shadow-lg'
                    : 'border-border/50 bg-surface-1/70'
                }`}>
                {!!pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent-warm px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-warm-foreground shadow-sm">
                    Best value
                  </div>
                )}
                <h4 className="font-display text-base font-bold text-foreground">{pack.name}</h4>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-extrabold tracking-tight text-foreground">
                    {pack.credits.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">credits</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">
                    {formatPrice(pack.price, pack.currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatPrice(pack.perCredit, pack.currency)} per credit
                </p>
                <TrackClick
                  event="credit_pack_click"
                  properties={{ pack: pack.name, credits: pack.credits }}
                  className="mt-5">
                  <a
                    href={pack.ctaHref}
                    className={`group inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                      pack.popular
                        ? 'bg-accent-warm text-accent-warm-foreground shadow-md hover:bg-accent-warm/90'
                        : 'border border-border bg-surface-1 text-foreground hover:bg-muted/50'
                    }`}>
                    Buy credits
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </TrackClick>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
