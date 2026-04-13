'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState } from 'react';
import { trpc } from '@/trpc/init';
import { plnFmt } from './dashboard-primitives';

// =============================================================================
// SPEND CHART V2
// =============================================================================

type RechartsBundle = typeof import('recharts');

export function SpendChartV2() {
  const t = useTranslations('Dashboard');
  const [RC, setRC] = useState<RechartsBundle | null>(null);
  useEffect(() => {
    void import('recharts').then(setRC);
  }, []);

  const reactId = useId();
  const gradPlnId = `${reactId}-v2p`;
  const gradEurId = `${reactId}-v2e`;

  const [range, setRange] = useState<'6' | '12' | 'ytd'>('6');
  const { data, isLoading } = useQuery(trpc.dashboard.spendTrend.queryOptions({ months: range }));

  const chartData = useMemo(() => {
    if (!data?.length) return [];
    const m = new Map<string, { month: string; PLN: number; EUR: number }>();
    for (const r of data) {
      const label = new Date(r.month).toLocaleDateString('en-US', { month: 'short' });
      const ex = m.get(label) ?? { month: label, PLN: 0, EUR: 0 };
      if (r.currency === 'PLN') ex.PLN = r.totalMinor;
      else if (r.currency === 'EUR') ex.EUR = r.totalMinor;
      m.set(label, ex);
    }
    return Array.from(m.values());
  }, [data]);

  const hasEur = chartData.some(d => d.EUR > 0);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-[15px] font-bold">{t('spend.title')}</h3>
        <div className="flex gap-0.5 rounded-xl border border-border/30 p-0.5">
          {(['6', '12', 'ytd'] as const).map(r => (
            <button
              key={r}
              type="button"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1 text-[9px] font-bold uppercase tracking-[0.1em] transition-all ${
                range === r
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-muted-foreground/50 hover:text-foreground'
              }`}>
              {r === 'ytd' ? 'YTD' : `${r}M`}
            </button>
          ))}
        </div>
      </div>

      {!RC || isLoading ? (
        <div className="flex h-[280px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground">
          {t('spend.empty')}
        </div>
      ) : (
        <RC.ResponsiveContainer width="100%" height={280}>
          <RC.AreaChart data={chartData}>
            <defs>
              <linearGradient id={gradPlnId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={gradEurId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <RC.CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              strokeOpacity={0.2}
              vertical={false}
            />
            <RC.XAxis
              dataKey="month"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              stroke="var(--color-muted-foreground)"
            />
            <RC.YAxis
              fontSize={9}
              tickLine={false}
              axisLine={false}
              stroke="var(--color-muted-foreground)"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              tickFormatter={(v: number) => plnFmt.format(v / 100)}
              width={72}
            />
            <RC.Tooltip
              contentStyle={{
                background: 'var(--color-popover)',
                border: '1px solid var(--color-border)',
                borderRadius: '14px',
                fontSize: 11,
                boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
                backdropFilter: 'blur(16px)',
              }}
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              formatter={(value: unknown, name: unknown) => [
                plnFmt.format(Number(value) / 100),
                String(name),
              ]}
            />
            <RC.Area
              type="monotone"
              dataKey="PLN"
              stackId="1"
              stroke="var(--color-chart-1)"
              fill={`url(#${gradPlnId})`}
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: 'var(--color-card)',
                fill: 'var(--color-chart-1)',
              }}
            />
            {hasEur && (
              <RC.Area
                type="monotone"
                dataKey="EUR"
                stackId="1"
                stroke="var(--color-chart-3)"
                fill={`url(#${gradEurId})`}
                strokeWidth={2.5}
                dot={false}
              />
            )}
          </RC.AreaChart>
        </RC.ResponsiveContainer>
      )}
    </div>
  );
}
