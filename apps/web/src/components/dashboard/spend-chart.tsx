"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { trpc } from "@/trpc/init";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatMonthLabel(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Toggle buttons (inline -- no toggle-group UI primitive needed)
// ---------------------------------------------------------------------------

interface RangeToggleProps {
  value: string;
  onChange: (value: string) => void;
  t: ReturnType<typeof useTranslations>;
}

const RANGES = [
  { value: "6", labelKey: "spend.range6m" },
  { value: "12", labelKey: "spend.range12m" },
  { value: "ytd", labelKey: "spend.rangeYtd" },
] as const;

function RangeToggle({ value, onChange, t }: RangeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
      {RANGES.map((range) => (
        <button
          key={range.value}
          type="button"
          onClick={() => onChange(range.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === range.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(range.labelKey as Parameters<typeof t>[0])}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip
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
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {currencyFormatter.format(entry.value / 100)}
        </p>
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
 */
export function SpendChart() {
  const t = useTranslations("Dashboard");
  const [spendRange, setSpendRange] = useQueryState(
    "spend",
    parseAsString.withDefault("6"),
  );

  const { data, isLoading } = useQuery(
    trpc.dashboard.spendTrend.queryOptions({
      months: spendRange as "6" | "12" | "ytd",
    }),
  );

  // Pivot raw data into chart format: { month, PLN, EUR }
  const chartData = useMemo(() => {
    if (!data?.length) return [];

    const monthMap = new Map<string, ChartDataPoint>();

    for (const row of data) {
      const label = formatMonthLabel(row.month);
      const existing = monthMap.get(label) ?? { month: label, PLN: 0, EUR: 0 };
      if (row.currency === "PLN") {
        existing.PLN = row.totalGrosze;
      } else if (row.currency === "EUR") {
        existing.EUR = row.totalGrosze;
      }
      monthMap.set(label, existing);
    }

    return Array.from(monthMap.values());
  }, [data]);

  const hasEur = chartData.some((d) => d.EUR > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-[20px] font-semibold">
          {t("spend.title")}
        </CardTitle>
        <RangeToggle value={spendRange} onChange={setSpendRange} t={t} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : chartData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            {t("spend.empty")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground) / 0.15)"
              />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) =>
                  currencyFormatter.format(val / 100)
                }
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="PLN"
                stackId="1"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.2)"
                strokeWidth={2}
              />
              {hasEur && (
                <Area
                  type="monotone"
                  dataKey="EUR"
                  stackId="1"
                  stroke="hsl(220 70% 55%)"
                  fill="hsl(220 70% 55% / 0.2)"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
