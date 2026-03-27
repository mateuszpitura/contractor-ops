"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import { ArrowUpRight } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KpiCardConfig {
  key: string;
  labelKey: string;
  href: string;
  isCurrency?: boolean;
}

// ---------------------------------------------------------------------------
// KPI card definitions
// ---------------------------------------------------------------------------

const KPI_CARDS: KpiCardConfig[] = [
  {
    key: "activeContractors",
    labelKey: "kpi.activeContractors",
    href: "/contractors?status=active",
  },
  {
    key: "pendingApprovals",
    labelKey: "kpi.pendingApprovals",
    href: "/approvals?tab=my&status=pending",
  },
  {
    key: "readyToPayTotal",
    labelKey: "kpi.readyToPay",
    href: "/payments?status=ready",
    isCurrency: true,
  },
  {
    key: "expiringContracts",
    labelKey: "kpi.expiringContracts",
    href: "/contracts?status=expiring",
  },
  {
    key: "openTasks",
    labelKey: "kpi.openTasks",
    href: "/workflows?tab=my-tasks",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatCurrency(grosze: number): string {
  return currencyFormatter.format(grosze / 100);
}

function getTrend(value: number, prevValue: number) {
  if (prevValue === 0) return { change: 0, direction: "neutral" as const };
  const change = ((value - prevValue) / prevValue) * 100;
  if (change > 0) return { change, direction: "up" as const };
  if (change < 0) return { change, direction: "down" as const };
  return { change: 0, direction: "neutral" as const };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * 5 clickable KPI cards with trend indicators.
 * Displays active contractors, pending approvals, ready-to-pay total,
 * expiring contracts, and open tasks.
 */
export function KpiCards() {
  const t = useTranslations("Dashboard");
  const { data, isLoading } = useQuery(trpc.dashboard.kpis.queryOptions());

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {KPI_CARDS.map((card) => (
          <Skeleton key={card.key} className="h-[100px] min-w-[200px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {KPI_CARDS.map((card) => {
        const kpiData = data?.[card.key as keyof NonNullable<typeof data>];
        let value = 0;
        let prevValue = 0;

        if (card.isCurrency && kpiData && "valueGrosze" in kpiData) {
          value = kpiData.valueGrosze;
          prevValue = kpiData.prevValueGrosze;
        } else if (kpiData && "value" in kpiData) {
          value = kpiData.value;
          prevValue = "prevValue" in kpiData ? kpiData.prevValue : 0;
        }

        const { change, direction } = getTrend(value, prevValue);
        const displayValue = card.isCurrency ? formatCurrency(value) : value;

        return (
          <Link key={card.key} href={card.href} className="group/kpi">
            <Card className="card-interactive min-w-[200px] cursor-pointer hover:ring-primary/40">
              <CardContent className="relative pt-0">
                <ArrowUpRight className="absolute top-0 right-0 h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover/kpi:text-muted-foreground/60 group-hover/kpi:translate-x-0.5 group-hover/kpi:-translate-y-0.5" />
                <p className="text-xs text-muted-foreground">
                  {t(card.labelKey as Parameters<typeof t>[0])}
                </p>
                <p className="mt-1 font-display text-[28px] font-semibold leading-tight">
                  {displayValue}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  {direction === "up" && (
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                  )}
                  {direction === "down" && (
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  )}
                  {direction === "neutral" && (
                    <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      direction === "up"
                        ? "text-success"
                        : direction === "down"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {direction === "neutral"
                      ? t("kpi.noChange")
                      : `${change > 0 ? "+" : ""}${change.toFixed(0)}% ${t("kpi.vsLastMonth")}`}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
