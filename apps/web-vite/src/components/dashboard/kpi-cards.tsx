/**
 * Premium bento-grid KPI cards with trend arrows + TiltCard chrome.
 *
 * The slimmer 5-cell row that renders inside `dashboard-home-container`
 * keeps shipping for the basic dashboard skeleton; this richer
 * presentation can be wired in by replacing the inline UsageKpiCard
 * block when product wants the bento layout back.
 */

import { AnimatedNumber, TiltCard } from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { Link, useLocale } from '../../i18n/navigation.js';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useKpiCards } from './hooks/use-kpi-cards.js';

interface KpiCardConfig {
  key: string;
  labelKey: string;
  href: string;
  isCurrency?: boolean;
  /** Hero takes 2 columns in the bento grid + larger typography. */
  isHero?: boolean;
}

const KPI_CARDS: KpiCardConfig[] = [
  {
    key: 'activeContractors',
    labelKey: 'kpi.activeContractors',
    href: '/contractors?lifecycleStage=ACTIVE',
  },
  {
    key: 'pendingApprovals',
    labelKey: 'kpi.pendingApprovals',
    href: '/approvals?tab=my&status=PENDING',
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
  { key: 'openTasks', labelKey: 'kpi.openTasks', href: '/workflows?tab=tasks' },
];

function getTrend(value: number, prevValue: number) {
  if (prevValue === 0) return { change: 0, direction: 'neutral' as const };
  const change = ((value - prevValue) / prevValue) * 100;
  if (change > 0) return { change, direction: 'up' as const };
  if (change < 0) return { change, direction: 'down' as const };
  return { change: 0, direction: 'neutral' as const };
}

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

export function KpiCards() {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const { isLoading, data } = useKpiCards();

  const formatCurrency = (minor: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(minor / 100);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {KPI_CARDS.map(card => (
          <Skeleton
            key={card.key}
            className={`h-[120px] rounded-2xl ${card.isHero ? 'xl:col-span-2' : ''}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {KPI_CARDS.map(card => {
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
            className={`group/kpi block ${card.isHero ? 'xl:col-span-2' : ''}`}
            aria-label={cardLabel}>
            <TiltCard entrance={false} shimmer={!card.isHero} glow={card.isHero} className="h-full">
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
                        ? 'bg-gradient-to-r from-foreground via-primary/80 to-foreground bg-clip-text text-4xl font-black tracking-tighter text-transparent sm:text-5xl'
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
