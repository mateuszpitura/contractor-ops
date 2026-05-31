/**
 * Hero spend metric — full-width card with a large animated 6-month
 * total + sparkline + month-over-month trend chip. Sits above the KPI
 * row in the bento dashboard layout.
 *
 * Ported from legacy `apps/web/src/components/dashboard/hero-spend-metric.tsx`
 * (commit 62a97d73). Aggregates across currencies into a single
 * PLN-formatted total (same math as the legacy V1 SpendChart).
 */

import { AnimatedNumber, Sparkline, TiltCard } from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { Link, useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useHeroSpendMetric } from './hooks/use-hero-spend-metric.js';

export function HeroSpendMetric() {
  const t = useTranslations('Dashboard.heroSpend');
  const locale = useLocale();
  const { isLoading, rows } = useHeroSpendMetric();

  const monthlyTotals = useMemo(() => {
    if (rows.length === 0) return [] as number[];
    const byMonth = new Map<string, number>();
    for (const row of rows) {
      byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + row.totalMinor);
    }
    return Array.from(byMonth.values());
  }, [rows]);

  const totalMinor = monthlyTotals.reduce((sum, v) => sum + v, 0);

  const trendPct = useMemo(() => {
    if (monthlyTotals.length < 2) return null;
    const prev = monthlyTotals[monthlyTotals.length - 2] as number;
    const curr = monthlyTotals[monthlyTotals.length - 1] as number;
    if (prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  }, [monthlyTotals]);

  const formatPLN = useCallback(
    (minor: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'PLN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(minor / 100),
    [locale],
  );

  if (isLoading) {
    return <Skeleton className="h-[200px] w-full rounded-2xl" />;
  }

  const trendDirection: 'up' | 'down' | 'flat' =
    trendPct === null || trendPct === 0 ? 'flat' : trendPct > 0 ? 'up' : 'down';

  const trendLabel =
    trendPct === null
      ? t('trendUnavailable')
      : trendDirection === 'flat'
        ? t('trendFlat')
        : t('trendChange', {
            sign: trendPct > 0 ? '+' : '',
            pct: trendPct.toFixed(1),
          });

  const srLabel = t('srTrendLabel', {
    months: 6,
    direction:
      trendDirection === 'flat'
        ? t('directionFlat')
        : trendDirection === 'up'
          ? t('directionUp')
          : t('directionDown'),
    pct: trendPct === null ? '0' : Math.abs(trendPct).toFixed(0),
  });

  return (
    <TiltCard entrance={false} glow shimmer className="group/hero w-full">
      <Link href="/reports" className="block" aria-label={t('viewReports')}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
              {t('eyebrow')}
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/0 transition-all group-hover/hero:text-primary/60 group-hover/hero:translate-x-0.5 group-hover/hero:-translate-y-0.5" />
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <p
              aria-label={t('totalAriaLabel', { total: formatPLN(totalMinor) })}
              className="bg-gradient-to-r from-foreground via-primary/80 to-foreground bg-clip-text font-display text-[48px] font-black leading-none tracking-tighter tabular-nums text-transparent sm:text-[64px] lg:text-[72px]">
              <AnimatedNumber value={totalMinor} format={formatPLN} duration={2200} />
            </p>

            {trendPct !== null && trendDirection !== 'flat' && (
              <div
                className={`mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  trendDirection === 'up'
                    ? 'bg-emerald-500/8 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/8 text-red-600 dark:text-red-400'
                }`}>
                {trendDirection === 'up' ? (
                  <TrendingUp className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3 w-3" aria-hidden="true" />
                )}
                {trendLabel}
              </div>
            )}
          </div>

          <div className="w-full">
            <Sparkline
              data={monthlyTotals}
              srLabel={srLabel}
              w={720}
              h={56}
              color="var(--color-primary)"
            />
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}
