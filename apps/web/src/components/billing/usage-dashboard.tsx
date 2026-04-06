"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Crown, FileSearch, RefreshCw } from "lucide-react";
import { trpc } from "@/trpc/init";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { UsageKpiCard } from "./usage-kpi-card";
import { SeatCountCard } from "./seat-count-card";
import { BillingDateCard } from "./billing-date-card";
import { CreditProgressBar } from "./credit-progress-bar";
import { PlanComparisonGrid } from "./plan-comparison-grid";
import { TopUpDialog } from "./top-up-dialog";
import type { TierId } from "./plan-comparison-grid";
import { Link } from "@/i18n/navigation";

// ---------------------------------------------------------------------------
// Status badge variant mapping
// ---------------------------------------------------------------------------

const STATUS_BADGE_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  ACTIVE: "success",
  TRIALING: "warning",
  PAST_DUE: "destructive",
  CANCELED: "secondary",
  UNPAID: "destructive",
  INCOMPLETE: "warning",
  INCOMPLETE_EXPIRED: "secondary",
  PAUSED: "secondary",
};

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "Active",
    TRIALING: "Trial",
    PAST_DUE: "Past due",
    CANCELED: "Canceled",
    UNPAID: "Unpaid",
    INCOMPLETE: "Incomplete",
    INCOMPLETE_EXPIRED: "Expired",
    PAUSED: "Paused",
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsageDashboard() {
  const t = useTranslations("Billing.usage");
  const tCredits = useTranslations("Billing.credits");
  const [topUpOpen, setTopUpOpen] = useState(false);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.billing.getUsageDashboard.queryOptions());

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // ---- Error state ----
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm text-muted-foreground">{t("errorLoading")}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw size={14} aria-hidden="true" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  const {
    subscription,
    credits,
    activeContractors,
    includedSeats,
    planConfig,
  } = data as {
    subscription: any;
    credits: { balance: number; allowance: number; used: number; tier: string };
    activeContractors: number;
    includedSeats: number;
    planConfig: { tiers: any[] };
  };

  // ---- No subscription state ----
  if (!subscription) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-lg font-semibold">{t("noSubscription")}</p>
        <p className="text-sm text-muted-foreground max-w-md">
          {t("noSubscriptionBody")}
        </p>
        <Button
          variant="default"
          render={<Link href="/settings?tab=billing" />}
        >
          {t("choosePlan")}
        </Button>
      </div>
    );
  }

  // ---- Derive values ----
  const currentTier = subscription.tier as TierId;
  const tierConfig = planConfig?.tiers?.find(
    (tier: any) => tier.id === currentTier,
  );
  const seatPriceGrosze = tierConfig?.seatPriceGrosze ?? 0;
  const isTrialing = subscription.status === "TRIALING";
  const billingDate = isTrialing
    ? subscription.trialEnd
    : subscription.currentPeriodEnd;
  const badgeVariant =
    STATUS_BADGE_VARIANT[subscription.status] ?? "secondary";
  const remaining = credits?.balance ?? 0;
  const total = credits?.allowance ?? 0;
  const isLowCredits = total > 0 && remaining / total < 0.2;

  return (
    <div className="space-y-8">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Current Plan */}
        <UsageKpiCard
          icon={<Crown size={16} aria-hidden="true" />}
          label={t("currentPlan")}
          value={
            <div className="flex items-center gap-2">
              <span>{subscription.tier}</span>
              <Badge variant={badgeVariant} className="text-xs">
                {formatStatus(subscription.status)}
              </Badge>
            </div>
          }
        />

        {/* Card 2: Active Seats */}
        <SeatCountCard
          activeContractors={activeContractors}
          includedSeats={includedSeats}
          seatPriceGrosze={seatPriceGrosze}
        />

        {/* Card 3: OCR Credits */}
        <UsageKpiCard
          icon={<FileSearch size={16} aria-hidden="true" />}
          label={t("ocrCredits")}
          value={
            <div className="space-y-2">
              <CreditProgressBar
                used={credits?.used ?? 0}
                total={total}
              />
              {isLowCredits && (
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0 text-xs"
                  onClick={() => setTopUpOpen(true)}
                >
                  {tCredits("buyMore")}
                </Button>
              )}
            </div>
          }
        />

        {/* Card 4: Next Billing Date */}
        <BillingDateCard
          date={billingDate ?? null}
          isTrialing={isTrialing}
        />
      </div>

      <Separator />

      {/* Plan Comparison Grid */}
      <PlanComparisonGrid currentTier={currentTier} onSelectPlan={() => {}} />

      <TopUpDialog open={topUpOpen} onOpenChange={setTopUpOpen} />
    </div>
  );
}
