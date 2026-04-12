"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { fadeUp, springs, stagger } from "@/lib/motion";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KpiCardConfig {
  key: string;
  labelKey: string;
  href: string;
  isCurrency?: boolean;
  isHero?: boolean;
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
    isHero: true,
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

function formatCurrency(minor: number): string {
  return currencyFormatter.format(minor / 100);
}

function getTrend(value: number, prevValue: number) {
  if (prevValue === 0) return { change: 0, direction: "neutral" as const };
  const change = ((value - prevValue) / prevValue) * 100;
  if (change > 0) return { change, direction: "up" as const };
  if (change < 0) return { change, direction: "down" as const };
  return { change: 0, direction: "neutral" as const };
}

// ---------------------------------------------------------------------------
// Trend Indicator
// ---------------------------------------------------------------------------

function TrendIndicator({
  direction,
  change,
  t,
}: {
  direction: "up" | "down" | "neutral";
  change: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {direction === "up" && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10">
          <TrendingUp className="h-3 w-3 text-success" />
        </span>
      )}
      {direction === "down" && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10">
          <TrendingDown className="h-3 w-3 text-destructive" />
        </span>
      )}
      {direction === "neutral" && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
          <Minus className="h-3 w-3 text-muted-foreground" />
        </span>
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
  );
}

// ---------------------------------------------------------------------------
// Hero KPI Card (spans 2 columns, conic border, large typography)
// ---------------------------------------------------------------------------

function HeroKpiCard({
  card,
  value,
  displayValue,
  direction,
  change,
  t,
}: {
  card: KpiCardConfig;
  value: number;
  displayValue: string | number;
  direction: "up" | "down" | "neutral";
  change: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Link href={card.href} className="group/kpi bento-span-2">
      <div className="conic-border neon-card iridescent rounded-xl">
        <Card className="relative min-h-[140px] cursor-pointer border-0 ring-0 shadow-none hover:shadow-none hover:ring-0">
          <CardContent className="relative flex h-full flex-col justify-between pt-0">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                {t(card.labelKey as Parameters<typeof t>[0])}
              </p>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/0 transition-all duration-300 group-hover/kpi:text-primary group-hover/kpi:translate-x-0.5 group-hover/kpi:-translate-y-0.5" />
            </div>
            <div>
              <p className="hero-metric hero-metric-glow font-display text-4xl font-bold tracking-tighter sm:text-5xl">
                {displayValue}
              </p>
              <div className="mt-3">
                <TrendIndicator direction={direction} change={change} t={t} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * 5 KPI cards in a bento grid. The "Ready to Pay" card is a hero card
 * spanning 2 columns with animated conic border and glowing typography.
 */
export function KpiCards() {
  const t = useTranslations("Dashboard");
  const { data, isLoading } = useQuery(trpc.dashboard.kpis.queryOptions());

  if (isLoading) {
    return (
      <div className="bento-grid">
        {KPI_CARDS.map((card) => (
          <Skeleton
            key={card.key}
            className={`h-[120px] rounded-xl ${card.isHero ? "bento-span-2" : ""}`}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className="bento-grid"
      initial="hidden"
      animate="visible"
      transition={stagger.default}
    >
      {KPI_CARDS.map((card) => {
        const kpiData = data?.[card.key as keyof NonNullable<typeof data>];
        let value = 0;
        let prevValue = 0;

        if (card.isCurrency && kpiData && "valueMinor" in kpiData) {
          value = kpiData.valueMinor;
          prevValue = kpiData.prevValueMinor;
        } else if (kpiData && "value" in kpiData) {
          value = kpiData.value;
          prevValue = "prevValue" in kpiData ? kpiData.prevValue : 0;
        }

        const { change, direction } = getTrend(value, prevValue);
        const displayValue = card.isCurrency ? formatCurrency(value) : value;

        if (card.isHero) {
          return (
            <motion.div
              key={card.key}
              variants={fadeUp}
              transition={springs.gentle}
              className="bento-span-2"
            >
              <HeroKpiCard
                card={card}
                value={value}
                displayValue={displayValue}
                direction={direction}
                change={change}
                t={t}
              />
            </motion.div>
          );
        }

        return (
          <motion.div key={card.key} variants={fadeUp} transition={springs.gentle}>
            <Link href={card.href} className="group/kpi block h-full">
              <Card className="card-interactive neon-card atelier-shimmer h-full min-w-0 cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-primary/40">
                <CardContent className="relative pt-0">
                  <ArrowUpRight className="absolute top-0 end-0 h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover/kpi:text-primary/60 group-hover/kpi:translate-x-0.5 group-hover/kpi:-translate-y-0.5" />
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t(card.labelKey as Parameters<typeof t>[0])}
                  </p>
                  <p className="hero-metric mt-1.5 font-display text-2xl font-semibold leading-tight tracking-tight">
                    {displayValue}
                  </p>
                  <div className="mt-2.5">
                    <TrendIndicator direction={direction} change={change} t={t} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
