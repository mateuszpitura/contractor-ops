/**
 * Monthly spend chart — Recharts area chart with 6m / 12m / YTD toggle
 * and multi-currency stacking (PLN + EUR). Ported from legacy
 * `apps/web/src/components/dashboard/spend-chart.tsx` (commit 62a97d73)
 * and rewired for the Vite SPA per `apps/web-vite/ARCHITECTURE.md`
 * (data layer in `./hooks/use-spend-chart.ts`).
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useCallback, useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRtlChartConfig } from '../../hooks/use-rtl-chart-config.js';
import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { SpendRange } from './hooks/use-spend-chart.js';
import { useSpendChart } from './hooks/use-spend-chart.js';

interface ChartDataPoint {
  month: string;
  PLN: number;
  EUR: number;
}

function formatMonthLabel(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

interface RangeToggleProps {
  value: SpendRange;
  onChange: (value: SpendRange) => void;
  t: ReturnType<typeof useTranslations>;
}

const RANGES: ReadonlyArray<{ value: SpendRange; labelKey: string }> = [
  { value: '6', labelKey: 'spend.range6m' },
  { value: '12', labelKey: 'spend.range12m' },
  { value: 'ytd', labelKey: 'spend.rangeYtd' },
];

interface RangeButtonProps {
  range: { value: SpendRange; labelKey: string };
  active: boolean;
  onChange: (value: SpendRange) => void;
  t: ReturnType<typeof useTranslations>;
}

function RangeButton({ range, active, onChange, t }: RangeButtonProps) {
  const handleClick = useCallback(() => onChange(range.value), [onChange, range.value]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
        active
          ? 'bg-background text-foreground shadow-sm ring-1 ring-foreground/[0.06]'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}>
      {t(range.labelKey)}
    </button>
  );
}

function RangeToggle({ value, onChange, t }: RangeToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5">
      {RANGES.map(range => (
        <RangeButton
          key={range.value}
          range={range}
          active={value === range.value}
          onChange={onChange}
          t={t}
        />
      ))}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter: Intl.NumberFormat;
}) {
  if (!(active && payload?.length)) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-background/95 p-3 shadow-lg backdrop-blur">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
        {label}
      </p>
      {payload.map(entry => (
        <div key={entry.name} className="flex items-baseline gap-2">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.name}</span>
          <span className="ms-auto font-display text-sm font-bold tabular-nums">
            {formatter.format(entry.value / 100)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SpendChart() {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const { xAxisProps, yAxisProps, chartStyle } = useRtlChartConfig();
  const reactId = useId();
  const gradPlnId = `${reactId}-gradPLN`;
  const gradEurId = `${reactId}-gradEUR`;
  const { isLoading, rows, spendRange, setSpendRange } = useSpendChart();

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

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (rows.length === 0) return [];
    const monthMap = new Map<string, ChartDataPoint>();
    for (const row of rows) {
      const label = formatMonthLabel(row.month);
      const existing = monthMap.get(label) ?? { month: label, PLN: 0, EUR: 0 };
      if (row.currency === 'PLN') existing.PLN = row.totalMinor;
      else if (row.currency === 'EUR') existing.EUR = row.totalMinor;
      monthMap.set(label, existing);
    }
    return Array.from(monthMap.values());
  }, [rows]);

  const hasEur = chartData.some(d => d.EUR > 0);

  const formatYAxisTick = useCallback(
    (val: number) => currencyFormatter.format(val / 100),
    [currencyFormatter],
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-display text-lg font-semibold">{t('spend.title')}</CardTitle>
        <RangeToggle value={spendRange} onChange={setSpendRange} t={t} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : chartData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
            {t('spend.empty')}
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 p-4">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={chartData}
                style={chartStyle}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradPlnId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.65 0.145 178)" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="oklch(0.55 0.15 178)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="oklch(0.55 0.15 178)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id={gradEurId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.14 65)" stopOpacity={0.3} />
                    <stop offset="50%" stopColor="oklch(0.72 0.14 65)" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="oklch(0.72 0.14 65)" stopOpacity={0.02} />
                  </linearGradient>
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
                  tickFormatter={formatYAxisTick}
                  width={70}
                  {...yAxisProps}
                />
                <Tooltip
                  content={<ChartTooltip formatter={currencyFormatter} />}
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
                  stroke="var(--color-primary)"
                  fill={`url(#${gradPlnId})`}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: 'var(--color-primary)',
                    stroke: 'var(--color-background)',
                    strokeWidth: 2,
                  }}
                />
                {hasEur && (
                  <Area
                    type="monotone"
                    dataKey="EUR"
                    stackId="1"
                    stroke="var(--color-accent)"
                    fill={`url(#${gradEurId})`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: 'var(--color-accent)',
                      stroke: 'var(--color-background)',
                      strokeWidth: 2,
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
