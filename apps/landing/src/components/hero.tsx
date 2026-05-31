'use client';

import type { AtelierStatusVariant } from '@contractor-ops/ui';
import {
  AnimatedNumber,
  AtelierIntensityProvider,
  AtelierStatusPill,
  Sparkline,
  TiltCard,
} from '@contractor-ops/ui';
import { Spotlight } from '@contractor-ops/ui/components/ace/spotlight-new';
import { BlurFade } from '@contractor-ops/ui/components/magic/blur-fade';
import { ArrowRight, Play } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from '@/i18n';
import { heroExperimentFor } from '@/lib/experiments';
import type { Market } from '@/lib/market';
import { AnimatedCounter } from './animated-counter';
import { VariantSlot } from './variant-slot';

const metrics = [
  { value: 4, suffix: 'h', label: 'saved per week' },
  { value: 100, suffix: '%', label: 'invoice accuracy' },
  { value: 2, suffix: 'min', label: 'onboarding time' },
];

interface MockMetricCard {
  label: string;
  value: number;
  format?: (n: number) => string;
  color: string;
}

const PLN_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const dashboardCards: readonly MockMetricCard[] = [
  {
    label: 'Active contractors',
    value: 34,
    color: 'var(--color-teal-500)',
  },
  {
    label: 'Pending invoices',
    value: 12,
    color: 'var(--color-accent-warm)',
  },
  {
    label: 'Due this week',
    value: 47200,
    format: n => `PLN ${PLN_FORMAT.format(n / 1000)}k`,
    color: 'var(--color-info)',
  },
];

interface MockDashboardRow {
  name: string;
  statusLabel: string;
  variant: AtelierStatusVariant;
  amount: string;
}

const dashboardRows: readonly MockDashboardRow[] = [
  { name: 'Anna Kowalska', statusLabel: 'Active', variant: 'success', amount: 'PLN 12,500' },
  { name: 'Tomasz Nowak', statusLabel: 'Pending', variant: 'warning', amount: 'PLN 8,900' },
  { name: 'Maria Wisniewska', statusLabel: 'Active', variant: 'success', amount: 'PLN 15,200' },
  { name: 'Jan Zielinski', statusLabel: 'Review', variant: 'info', amount: 'PLN 6,400' },
];

// Static seed data for the hero sparkline — six months of mock spend
// trending gently up. Real product data isn't fetched on the marketing page.
const MOCK_SPEND_TREND = [3200, 3850, 3500, 4100, 4400, 4720];

interface HeroProps {
  market: Market;
}

export function Hero({ market }: HeroProps) {
  const reduced = useReducedMotion();
  const t = reduced ? { duration: 0 } : undefined;
  const messages = useTranslations();
  const heroExperiment = heroExperimentFor(market);
  const controlSubheadline = messages.hero.subheadline;
  const headlineText = messages.hero.headline;
  const headlineHighlight = messages.hero.headlineHighlight;

  return (
    <section className="hero-mesh noise-overlay relative min-h-[100dvh] flex items-center justify-center pt-20 pb-16 overflow-hidden">
      {/* Aceternity spotlight — ambient lighting layer above mesh, below content */}
      {!reduced && <Spotlight />}

      {/* Floating orbs — restrained to 2, higher blur for subtlety */}
      <div className="orb orb-teal absolute -top-20 -left-32 h-[500px] w-[500px] opacity-70" />
      <div className="orb orb-amber absolute top-40 -right-24 h-[400px] w-[400px] opacity-60" />

      {/* Dot grid pattern */}
      <div className="dot-grid absolute inset-0 opacity-30" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 40, filter: 'blur(16px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={t ?? { duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-4xl font-display text-hero leading-[1.05] tracking-[-0.035em]">
          {headlineText} <span className="gradient-text">{headlineHighlight}</span>
        </motion.h1>

        {/* Subheadline — variant slot per market */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={t ?? { duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-2xl text-subhead text-muted-foreground">
          <VariantSlot
            experimentKey={heroExperiment.key}
            fallback={heroExperiment.fallback}
            variants={{
              control: <p>{controlSubheadline}</p>,
              A: <p>{messages.hero.variantA ?? controlSubheadline}</p>,
              B: <p>{messages.hero.variantB ?? controlSubheadline}</p>,
              C: <p>{messages.hero.variantC ?? controlSubheadline}</p>,
              D: <p>{messages.hero.variantD ?? controlSubheadline}</p>,
            }}
          />
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={t ?? { duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#cta"
            className="group inline-flex items-center gap-2.5 rounded-2xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl active:scale-[0.98]">
            Start free trial
            <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href="#how-it-works"
            className="group inline-flex items-center gap-2.5 rounded-2xl border border-border bg-surface-1/60 px-8 py-4 text-base font-medium text-foreground backdrop-blur-sm transition-all hover:bg-surface-2 hover:border-border/80">
            <Play className="h-4 w-4 text-primary" />
            See how it works
          </a>
        </motion.div>

        {/* Animated metrics strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={t ?? { duration: 0.6, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-14">
          {metrics.map((m, i) => (
            <BlurFade key={m.label} delay={0.95 + i * 0.08} className="flex flex-col items-center">
              <AnimatedCounter
                value={m.value}
                suffix={m.suffix}
                duration={1.8}
                className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              />
              <span className="mt-1 text-sm text-muted-foreground">{m.label}</span>
            </BlurFade>
          ))}
        </motion.div>

        {/*
         * Animated browser mockup — rebuilt from real @contractor-ops/ui
         * primitives so marketing tracks product visuals automatically.
         * Wrapped in AtelierIntensityProvider value="exhibition" so the
         * leaf primitives render at full Exhibition intensity (sparkline
         * pulse on, full TiltCard treatment).
         */}
        <AtelierIntensityProvider value="exhibition">
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.92, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={t ?? { duration: 1, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto mt-20 max-w-4xl">
            <div
              className="glass-heavy rounded-2xl border border-border/50 overflow-hidden shadow-xl"
              role="img"
              aria-label="Contractor Ops dashboard showing active contractors, pending invoices, and payment tracking">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-border/40 bg-surface-2/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-destructive/60" aria-hidden="true" />
                  <div className="h-3 w-3 rounded-full bg-warning/60" aria-hidden="true" />
                  <div className="h-3 w-3 rounded-full bg-success/60" aria-hidden="true" />
                </div>
                <div className="mx-auto flex h-7 w-64 items-center justify-center rounded-lg bg-muted/50 text-xs text-muted-foreground font-mono">
                  app.contractorops.com
                </div>
              </div>

              {/* Dashboard preview — real Atelier primitives */}
              <div className="relative aspect-[16/9.5] bg-gradient-to-br from-surface-0 to-surface-2 p-6 sm:p-8">
                {/* Metric cards — TiltCard + AnimatedNumber */}
                <div className="grid grid-cols-3 gap-4 sm:gap-5 mb-5">
                  {dashboardCards.map((card, i) => (
                    <BlurFade key={card.label} delay={1.6 + i * 0.12}>
                      <TiltCard className="!rounded-xl !p-3 sm:!p-4">
                        <div className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          {card.label}
                        </div>
                        <div className="mt-1 text-lg sm:text-2xl font-display font-bold tracking-tight tabular-nums">
                          <AnimatedNumber value={card.value} format={card.format} duration={1400} />
                        </div>
                      </TiltCard>
                    </BlurFade>
                  ))}
                </div>

                {/* Sparkline strip — Sparkline primitive */}
                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={t ?? { duration: 0.5, delay: 1.95, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-5 flex items-center justify-between rounded-xl border border-border/30 bg-surface-1/60 px-4 py-2.5 backdrop-blur-sm">
                  <div>
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      6-month spend
                    </div>
                    <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
                      PLN 23.6k{' '}
                      <span className="text-emerald-600 dark:text-emerald-400">+8.2%</span>
                    </div>
                  </div>
                  <Sparkline
                    data={MOCK_SPEND_TREND}
                    srLabel="Six-month spend trend, up 8 percent"
                    w={220}
                    h={36}
                    color="var(--color-primary)"
                  />
                </motion.div>

                {/* Table rows — AtelierStatusPill */}
                <div className="space-y-2">
                  {dashboardRows.map((row, i) => (
                    <BlurFade
                      key={row.name}
                      delay={2.1 + i * 0.1}
                      direction="right"
                      className="flex items-center justify-between rounded-lg border border-border/30 bg-surface-1/60 px-3 sm:px-4 py-2 sm:py-2.5 backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] sm:text-xs font-bold text-primary">
                          {row.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-foreground">
                          {row.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <AtelierStatusPill variant={row.variant}>
                          {row.statusLabel}
                        </AtelierStatusPill>
                        <span className="text-xs sm:text-sm font-mono font-medium text-foreground/80 hidden sm:block">
                          {row.amount}
                        </span>
                      </div>
                    </BlurFade>
                  ))}
                </div>

                {/* Gradient fade at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface-0 to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Subtle shadow behind mockup */}
            <div className="absolute -inset-2 -z-10 rounded-3xl bg-primary/4 blur-3xl" />
          </motion.div>
        </AtelierIntensityProvider>
      </div>
    </section>
  );
}
