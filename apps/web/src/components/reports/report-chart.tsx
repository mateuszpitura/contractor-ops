'use client';

import { useLocale } from 'next-intl';
import { useId, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Skeleton } from '@/components/ui/skeleton';
import { useRtlChartConfig } from '@/hooks/use-rtl-chart-config';

type ChartType = 'bar-horizontal' | 'bar-grouped' | 'pie';

interface ReportChartProps {
  type: ChartType;
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  activeId?: string;
  onSegmentClick: (id: string) => void;
  isLoading?: boolean;
  idKey?: string;
}

const _CHART_HEIGHT = 240;

const PIE_COLORS: Record<string, string> = {
  critical: 'oklch(0.55 0.2 25)',
  warning: 'oklch(0.72 0.17 65)',
  ok: 'oklch(0.65 0.17 155)',
};

export function ReportChart({
  type,
  data,
  dataKey,
  nameKey,
  activeId,
  onSegmentClick,
  isLoading,
  idKey = 'id',
}: ReportChartProps) {
  const locale = useLocale();
  const { xAxisProps, yAxisProps, chartStyle } = useRtlChartConfig();
  const reactId = useId();
  const gradId = `${reactId}-grad`;
  const glowId = `${reactId}-glow`;

  const formatCurrency = useMemo(() => {
    const fmt = new Intl.NumberFormat(
      locale === 'ar' ? 'ar-SA-u-nu-latn' : locale === 'pl' ? 'pl-PL' : 'en-US',
      {
        style: 'currency',
        currency: locale === 'ar' ? 'AED' : 'PLN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      },
    );
    return (value: number) => fmt.format(value / 100);
  }, [locale]);

  const sortedData = useMemo(() => {
    if (type === 'bar-horizontal') {
      return [...data].sort((a, b) => (b[dataKey] as number) - (a[dataKey] as number)).slice(0, 10);
    }
    return data;
  }, [data, dataKey, type]);

  // Pie chart data transformation (must be called unconditionally for hooks rules)
  const pieData = useMemo(() => {
    if (type !== 'pie') return [];
    if (Array.isArray(data) && data.length > 0 && 'name' in data[0]) {
      return data as Array<{ name: string; value: number; id?: string }>;
    }
    // Transform { critical, warning, ok } to array
    const obj = (data[0] ?? {}) as Record<string, number>;
    return [
      { name: 'Critical', value: obj.critical ?? 0, id: 'critical' },
      { name: 'Warning', value: obj.warning ?? 0, id: 'warning' },
      { name: 'OK', value: obj.ok ?? 0, id: 'ok' },
    ].filter(d => d.value > 0);
  }, [data, type]);

  if (isLoading) {
    return <Skeleton className="h-[240px] w-full rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
        {/* Intentionally no text — the table below carries the empty-state message */}
      </div>
    );
  }

  if (type === 'bar-horizontal') {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-4">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 8, right: 20, bottom: 0, left: 0 }}
              style={chartStyle}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.65 0.145 178)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="oklch(0.55 0.15 178)" stopOpacity={0.6} />
                </linearGradient>
                <filter id={glowId} x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)"
                horizontal={false}
              />
              <XAxis
                type="number"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                tickFormatter={(v: number) => formatCurrency(v)}
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                {...xAxisProps}
              />
              <YAxis
                type="category"
                dataKey={nameKey}
                width={150}
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                {...yAxisProps}
              />
              <Tooltip
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                formatter={(value) => [formatCurrency(Number(value)), '']}
                cursor={{ fill: 'var(--color-muted)', opacity: 0.15 }}
                contentStyle={{
                  borderRadius: '0.75rem',
                  border: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                  backgroundColor: 'var(--color-popover)',
                  color: 'var(--color-popover-foreground)',
                  backdropFilter: 'blur(8px)',
                  fontSize: '0.8rem',
                }}
                labelStyle={{ color: 'var(--color-popover-foreground)' }}
                itemStyle={{ color: 'var(--color-popover-foreground)' }}
              />
              <Bar
                dataKey={dataKey}
                radius={[0, 6, 6, 0]}
                cursor="pointer"
                filter={`url(#${glowId})`}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={(_data, _index, e) => {
                  const payload =
                    ((e as unknown as Record<string, unknown>)?.payload as Record<
                      string,
                      unknown
                    >) ?? _data;
                  const id = payload?.[idKey] as string;
                  if (id) onSegmentClick(id);
                }}>
                {sortedData.map(entry => {
                  const entryId = entry[idKey] as string;
                  const isActive = !activeId || entryId === activeId;
                  return (
                    <Cell
                      key={entryId}
                      fill={isActive ? `url(#${gradId})` : 'var(--color-muted-foreground)'}
                      opacity={isActive ? 1 : 0.2}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (type === 'bar-grouped') {
    const hasValues = sortedData.some(d => (d[dataKey] as number) > 0);
    if (!hasValues) {
      return (
        <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground" />
      );
    }
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-4">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              margin={{ top: 8, right: 20, bottom: 0, left: 0 }}
              style={chartStyle}>
              <defs>
                <linearGradient id={`${gradId}-v`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.145 178)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="oklch(0.55 0.15 178)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)"
                vertical={false}
              />
              <XAxis
                dataKey={nameKey}
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                {...xAxisProps}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                {...yAxisProps}
              />
              <Tooltip
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                formatter={(value) => [Number(value), '']}
                cursor={{ fill: 'var(--color-muted)', opacity: 0.15 }}
                contentStyle={{
                  borderRadius: '0.75rem',
                  border: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                  backgroundColor: 'var(--color-popover)',
                  color: 'var(--color-popover-foreground)',
                  backdropFilter: 'blur(8px)',
                  fontSize: '0.8rem',
                }}
                labelStyle={{ color: 'var(--color-popover-foreground)' }}
                itemStyle={{ color: 'var(--color-popover-foreground)' }}
              />
              <Bar
                dataKey={dataKey}
                fill={`url(#${gradId}-v)`}
                radius={[6, 6, 0, 0]}
                filter={`url(#${glowId})`}
                cursor="pointer"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={(_data, _index, e) => {
                  const payload =
                    ((e as unknown as Record<string, unknown>)?.payload as Record<
                      string,
                      unknown
                    >) ?? _data;
                  const id = payload?.[idKey] as string;
                  if (id) onSegmentClick(id);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (type === 'pie') {
    if (pieData.length === 0) {
      return (
        <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground" />
      );
    }
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-4">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <filter id={`${glowId}-pie`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={3}
                cornerRadius={4}
                cursor="pointer"
                stroke="none"
                filter={`url(#${glowId}-pie)`}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={(_data, _index, e) => {
                  const payload =
                    ((e as unknown as Record<string, unknown>)?.payload as Record<
                      string,
                      unknown
                    >) ?? (_data as unknown as Record<string, unknown>);
                  const id = (payload?.id ??
                    (payload?.name as string | undefined)?.toLowerCase()) as string;
                  if (id) onSegmentClick(id);
                }}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                label={({ name, value }: { name?: string; value?: number }) =>
                  `${name ?? ''}: ${value ?? 0}`
                }>
                {pieData.map(entry => (
                  <Cell
                    key={entry.id ?? entry.name}
                    fill={
                      PIE_COLORS[(entry.id ?? entry.name ?? '').toLowerCase()] ??
                      'oklch(0.65 0.145 178)'
                    }
                    opacity={
                      !activeId || (entry.id ?? entry.name ?? '').toLowerCase() === activeId
                        ? 1
                        : 0.25
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '0.75rem',
                  border: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                  backgroundColor: 'var(--color-popover)',
                  color: 'var(--color-popover-foreground)',
                  backdropFilter: 'blur(8px)',
                  fontSize: '0.8rem',
                }}
                labelStyle={{ color: 'var(--color-popover-foreground)' }}
                itemStyle={{ color: 'var(--color-popover-foreground)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
}
