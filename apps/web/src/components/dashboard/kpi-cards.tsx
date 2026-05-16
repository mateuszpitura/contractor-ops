'use client';

import { AnimatedNumber, TiltCard } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';
import { tKey } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KpiCardConfig {
  key: string;
  labelKey: string;
  href: string;
  isCurrency?: boolean;
  /** Hero takes 2 columns in the bento grid + larger typography. */
  isHero?: boolean;
}

// ---------------------------------------------------------------------------
// KPI card definitions
// ---------------------------------------------------------------------------

const KPI_CARDS: KpiCardConfig[] = [
  {
    key: 'activeContractors',
    labelKey: 'kpi.activeContractors',
    href: '/contractors?status=active',
  },
  {
    key: 'pendingApprovals',
    labelKey: 'kpi.pendingApprovals',
    href: '/approvals?tab=my&status=pending',
  },
  {
    key: 'readyToPayTotal',
    labelKey: 'kpi.readyToPay',
    href: '/payments?status=ready',
    isCurrency: true,
    isHero: true,
  },
  {
    key: 'expiringContracts',
    labelKey: 'kpi.expiringContracts',
    href: '/contracts?status=expiring',
  },
  {
    key: 'openTasks',
    labelKey: 'kpi.openTasks',
    href: '/workflows?tab=my-tasks',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrend(value: number, prevValue: number) {
  if (prevValue === 0) return { change: 0, direction: 'neutral' as const };
  const change = ((value - prevValue) / prevValue) * 100;
  if (change > 0) return { change, direction: 'up' as const };
  if (change < 0) return { change, direction: 'down' as const };
  return { change: 0, direction: 'neutral' as const };
}

// ---------------------------------------------------------------------------
// Trend Indicator
// ---------------------------------------------------------------------------

function TrendIndicator({
  direction,
  change,
  t,
}: {
  direction: 'up' | 'down' | 'neutral';
  change: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {direction === 'up' && (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10">
          <TrendingUp className="h-3 w-3 text-success" />
        </span>
      )}
      {direction === 'down' && (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10">
          <TrendingDown className="h-3 w-3 text-destructive" />
        </span>
      )}
      {direction === 'neutral' && (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
          <Minus className="h-3 w-3 text-muted-foreground" />
        </span>
      )}
      <span
        className={`text-xs font-semibold ${
          direction === 'up'
            ? 'text-success'
            : direction === 'down'
              ? 'text-destructive'
              : 'text-muted-foreground'
        }`}>
        {direction === 'neutral'
          ? t('kpi.noChange')
          : `${change > 0 ? '+' : ''}${change.toFixed(0)}% ${t('kpi.vsLastMonth')}`}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * 5 KPI cards in a bento grid. The "Ready to Pay" card is a hero card
 * spanning 2 columns with larger typography. All cards now ride on the
 * Atelier TiltCard primitive — frosted-glass surface, optional shimmer,
 * cursor-driven 3D tilt that auto-disables on touch / reduced-motion /
 * Workbench tier.
 *
 * Locale comes from next-intl. Currency formatter uses the active
 * locale instead of the hardcoded 'pl-PL' it carried before.
 */
export function KpiCards() {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const { data, isLoading } = useQuery(trpc.dashboard.kpis.queryOptions());

  const formatCurrency = (minor: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(minor / 100);

  if (isLoading) {
    return (
      <div className="bento-grid">
        {KPI_CARDS.map(card => (
          <Skeleton
            key={card.key}
            className={`h-[120px] rounded-2xl ${card.isHero ? 'bento-span-2' : ''}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="bento-grid">
      {KPI_CARDS.map((card, index) => {
        const kpiData = data?.[card.key as keyof NonNullable<typeof data>];
        let value = 0;
        let prevValue = 0;

        if (card.isCurrency && kpiData && 'valueMinor' in kpiData) {
          value = kpiData.valueMinor;
          prevValue = kpiData.prevValueMinor;
        } else if (kpiData && 'value' in kpiData) {
          value = kpiData.value;
          prevValue = 'prevValue' in kpiData ? kpiData.prevValue : 0;
        }

        const { change, direction } = getTrend(value, prevValue);
        const cardLabel = tKey(t, card.labelKey);

        return (
          <Link
            key={card.key}
            href={card.href}
            className={`group/kpi block ${card.isHero ? 'bento-span-2' : ''}`}
            aria-label={cardLabel}>
            <TiltCard
              shimmer={!card.isHero}
              glow={card.isHero}
              delay={index * 60}
              className="h-full">
              <div className="flex h-full flex-col justify-between gap-3">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {cardLabel}
                  </p>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-4 w-4 text-muted-foreground/0 transition-all duration-300 group-hover/kpi:text-primary group-hover/kpi:translate-x-0.5 group-hover/kpi:-translate-y-0.5"
                  />
                </div>

                <div>
                  <p
                    className={`font-display font-semibold leading-tight tracking-tight tabular-nums ${
                      card.isHero
                        ? 'atelier-hero-glow bg-gradient-to-r from-foreground via-primary/80 to-foreground bg-clip-text text-4xl font-black tracking-tighter text-transparent sm:text-5xl'
                        : 'text-2xl'
                    }`}>
                    <AnimatedNumber
                      value={value}
                      format={card.isCurrency ? formatCurrency : undefined}
                    />
                  </p>
                  <div className="mt-2.5">
                    <TrendIndicator direction={direction} change={change} t={t} />
                  </div>
                </div>
              </div>
            </TiltCard>
          </Link>
        );
      })}
    </div>
  );
}
