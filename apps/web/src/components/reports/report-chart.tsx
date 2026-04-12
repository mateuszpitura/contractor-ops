"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { useRtlChartConfig } from "@/hooks/use-rtl-chart-config";

type ChartType = "bar-horizontal" | "bar-grouped" | "pie";

interface ReportChartProps {
  type: ChartType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  dataKey: string;
  nameKey: string;
  activeId?: string;
  onSegmentClick: (id: string) => void;
  isLoading?: boolean;
  idKey?: string;
}

const CHART_HEIGHT = 240;

const PIE_COLORS: Record<string, string> = {
  critical: "var(--color-destructive)",
  warning: "var(--color-warning, #f59e0b)",
  ok: "var(--color-success, #22c55e)",
};

export function ReportChart({
  type,
  data,
  dataKey,
  nameKey,
  activeId,
  onSegmentClick,
  isLoading,
  idKey = "id",
}: ReportChartProps) {
  const locale = useLocale();
  const { xAxisProps, yAxisProps, chartStyle } = useRtlChartConfig();

  const formatCurrency = useMemo(() => {
    const fmt = new Intl.NumberFormat(
      locale === "ar" ? "ar-SA-u-nu-latn" : locale === "pl" ? "pl-PL" : "en-US",
      {
        style: "currency",
        currency: locale === "ar" ? "AED" : "PLN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      },
    );
    return (value: number) => fmt.format(value / 100);
  }, [locale]);

  const sortedData = useMemo(() => {
    if (type === "bar-horizontal") {
      return [...data].sort((a, b) => (b[dataKey] as number) - (a[dataKey] as number)).slice(0, 10);
    }
    return data;
  }, [data, dataKey, type]);

  // Pie chart data transformation (must be called unconditionally for hooks rules)
  const pieData = useMemo(() => {
    if (type !== "pie") return [];
    if (Array.isArray(data) && data.length > 0 && "name" in data[0]) {
      return data as Array<{ name: string; value: number; id?: string }>;
    }
    // Transform { critical, warning, ok } to array
    const obj = (data[0] ?? {}) as Record<string, number>;
    return [
      { name: "Critical", value: obj.critical ?? 0, id: "critical" },
      { name: "Warning", value: obj.warning ?? 0, id: "warning" },
      { name: "OK", value: obj.ok ?? 0, id: "ok" },
    ].filter((d) => d.value > 0);
  }, [data, type]);

  if (isLoading) {
    return <Skeleton className="h-[240px] w-full rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return null;
  }

  if (type === "bar-horizontal") {
    return (
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
            style={chartStyle}
          >
            <XAxis
              type="number"
              tickFormatter={(v: number) => formatCurrency(v)}
              tick={{ fontSize: 12 }}
              {...xAxisProps}
            />
            <YAxis
              type="category"
              dataKey={nameKey}
              width={150}
              tick={{ fontSize: 12 }}
              {...yAxisProps}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
            />
            <Bar
              dataKey={dataKey}
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(_data, _index, e) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const payload = (e as any)?.payload ?? _data;
                const id = payload?.[idKey] as string;
                if (id) onSegmentClick(id);
              }}
            >
              {sortedData.map((entry) => {
                const entryId = entry[idKey] as string;
                const isActive = !activeId || entryId === activeId;
                return (
                  <Cell
                    key={entryId}
                    fill={isActive ? "var(--color-primary)" : "var(--color-muted-foreground)"}
                    opacity={isActive ? 1 : 0.3}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "bar-grouped") {
    return (
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData}
            margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
            style={chartStyle}
          >
            <XAxis dataKey={nameKey} tick={{ fontSize: 12 }} {...xAxisProps} />
            <YAxis tick={{ fontSize: 12 }} {...yAxisProps} />
            <Tooltip cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
            <Bar
              dataKey={dataKey}
              fill="var(--color-primary)"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(_data, _index, e) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const payload = (e as any)?.payload ?? _data;
                const id = payload?.[idKey] as string;
                if (id) onSegmentClick(id);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "pie") {
    return (
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              cursor="pointer"
              onClick={(_data, _index, e) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const payload = (e as any)?.payload ?? _data;
                const id = (payload?.id ?? payload?.name?.toLowerCase()) as string;
                if (id) onSegmentClick(id);
              }}
              label={({ name, value }: { name?: string; value?: number }) =>
                `${name ?? ""}: ${value ?? 0}`
              }
            >
              {pieData.map((entry) => (
                <Cell
                  key={entry.id ?? entry.name}
                  fill={
                    PIE_COLORS[(entry.id ?? entry.name ?? "").toLowerCase()] ??
                    "var(--color-primary)"
                  }
                  opacity={
                    !activeId || (entry.id ?? entry.name ?? "").toLowerCase() === activeId ? 1 : 0.3
                  }
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}
