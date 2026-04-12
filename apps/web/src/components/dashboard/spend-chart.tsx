'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRtlChartConfig } from '@/hooks/use-rtl-chart-config';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChartDataPoint {
  month: string;
  PLN: number;
  EUR: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonthLabel(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Toggle buttons
// ---------------------------------------------------------------------------

interface RangeToggleProps {
  value: string;
  onChange: (value: string) => void;
  t: ReturnType<typeof useTranslations>;
}

const RANGES = [
  { value: '6', labelKey: 'spend.range6m' },
  { value: '12', labelKey: 'spend.range12m' },
  { value: 'ytd', labelKey: 'spend.rangeYtd' },
] as const;

function RangeToggle({ value, onChange, t }: RangeToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-surface-3 p-0.5">
      {RANGES.map(range => (
        <button
          key={range.value}
          type="button"
          onClick={() => onChange(range.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
            value === range.value
              ? 'bg-surface-1 text-foreground shadow-sm ring-1 ring-foreground/[0.06]'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
          }`}>
          {t(range.labelKey as Parameters<typeof t>[0])}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip — glass morphism with accent line
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!(active && payload?.length)) return null;

  return (
    <div className="glass-medium relative overflow-hidden rounded-xl border border-border/40 p-3 shadow-lg">
      {/* Top accent line */}
      <div className="accent-line absolute top-0 end-0 start-0 rounded-t-xl" />
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
        {label}
      </p>
      {payload.map(entry => (
        <div key={entry.name} className="flex items-baseline gap-2">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" />
          <span className="text-xs text-muted-foreground">{entry.name}</span>
          <span className="ms-auto font-display text-sm font-bold tabular-nums">
            {currencyFormatter.format(entry.value / 100)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Recharts AreaChart showing monthly spend with 6m/12m/YTD toggle.
 * Supports multi-currency stacking (PLN + EUR).
 * Enhanced with gradient fills and glow-line strokes.
 */
export function SpendChart() {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const { xAxisProps, yAxisProps, chartStyle } = useRtlChartConfig();

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(
        locale === 'ar' ? 'ar-SA-u-nu-latn' : locale === 'pl' ? 'pl-PL' : 'en-US',
        {
          style: 'currency',
          currency: locale === 'ar' ? 'AED' : 'PLN',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        },
      ),
    [locale],
  );

  const [spendRange, setSpendRange] = useQueryState('spend', parseAsString.withDefault('6'));

  const { data, isLoading } = useQuery(
    trpc.dashboard.spendTrend.queryOptions({
      months: spendRange as '6' | '12' | 'ytd',
    }),
  );

  // Pivot raw data into chart format: { month, PLN, EUR }
  const chartData = useMemo(() => {
    if (!data?.length) return [];

    const monthMap = new Map<string, ChartDataPoint>();

    for (const row of data) {
      const label = formatMonthLabel(row.month);
      const existing = monthMap.get(label) ?? { month: label, PLN: 0, EUR: 0 };
      if (row.currency === 'PLN') {
        existing.PLN = row.totalMinor;
      } else if (row.currency === 'EUR') {
        existing.EUR = row.totalMinor;
      }
      monthMap.set(label, existing);
    }

    return Array.from(monthMap.values());
  }, [data]);

  const hasEur = chartData.some(d => d.EUR > 0);

  return (
    <Card className="iridescent neon-card">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-display text-lg font-semibold">{t('spend.title')}</CardTitle>
        <RangeToggle value={spendRange} onChange={setSpendRange} t={t} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : chartData.length === 0 ? (
          <div className="corner-marks flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            {t('spend.empty')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} style={chartStyle}>
              <defs>
                <linearGradient id="gradPLN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.145 178)" stopOpacity={0.35} />
                  <stop offset="50%" stopColor="oklch(0.55 0.15 178)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="oklch(0.55 0.15 178)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradEUR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.14 65)" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="oklch(0.72 0.14 65)" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="oklch(0.72 0.14 65)" stopOpacity={0.02} />
                </linearGradient>
                {/* Glow filter for stroke lines */}
                <filter id="glowPLN" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--color-muted-foreground)' }}
                {...xAxisProps}
              />
              <YAxis
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--color-muted-foreground)' }}
                tickFormatter={(val: number) => currencyFormatter.format(val / 100)}
                width={70}
                {...yAxisProps}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{
                  stroke: 'var(--color-primary)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                  strokeOpacity: 0.3,
                }}
              />
              <Area
                type="monotone"
                dataKey="PLN"
                stackId="1"
                stroke="var(--color-viz-1)"
                fill="url(#gradPLN)"
                strokeWidth={2.5}
                filter="url(#glowPLN)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: 'var(--color-viz-1)',
                  stroke: 'var(--color-surface-1)',
                  strokeWidth: 2,
                }}
              />
              {hasEur && (
                <Area
                  type="monotone"
                  dataKey="EUR"
                  stackId="1"
                  stroke="var(--color-viz-2)"
                  fill="url(#gradEUR)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: 'var(--color-viz-2)',
                    stroke: 'var(--color-surface-1)',
                    strokeWidth: 2,
                  }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
