"use client";

import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/trpc/init";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, RefreshCw } from "lucide-react";

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CurrentPlanSummary() {
  const {
    data: subscription,
    isLoading,
    isError,
    refetch,
  } = useQuery(trpc.billing.getSubscription.queryOptions());

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-36" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Failed to load billing data
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No active subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Choose a plan to unlock all features for your organization. Your
            data from the trial is preserved.
          </p>
        </CardContent>
      </Card>
    );
  }

  const statusText = getStatusText(subscription);
  const renewalText = getRenewalText(subscription);
  const badgeVariant =
    STATUS_BADGE_VARIANT[subscription.status] ?? "secondary";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{subscription.tier} Plan</CardTitle>
          <Badge variant={badgeVariant}>{formatStatus(subscription.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{statusText}</p>
        <p className="text-sm text-muted-foreground">{renewalText}</p>
        <p className="text-sm text-muted-foreground">
          {subscription.seatCount} seat{subscription.seatCount !== 1 ? "s" : ""}{" "}
          (active contractors)
        </p>
        {(subscription.status === "PAST_DUE" ||
          subscription.status === "UNPAID") && (
          <p className="text-sm font-medium text-destructive">
            Update your payment method to avoid service interruption.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getStatusText(subscription: {
  status: string;
  trialEnd?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
}): string {
  if (subscription.status === "TRIALING" && subscription.trialEnd) {
    const trialEnd = new Date(subscription.trialEnd);
    const daysRemaining = Math.max(
      0,
      Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );
    return `Trial - ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`;
  }

  if (subscription.status === "CANCELED" && subscription.currentPeriodEnd) {
    const endDate = new Date(subscription.currentPeriodEnd);
    return `Canceled - access until ${endDate.toLocaleDateString()}`;
  }

  return formatStatus(subscription.status);
}

function getRenewalText(subscription: {
  status: string;
  trialEnd?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
}): string {
  if (subscription.status === "TRIALING" && subscription.trialEnd) {
    return `Trial ends ${new Date(subscription.trialEnd).toLocaleDateString()}`;
  }

  if (subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    return `Access until ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`;
  }

  if (subscription.currentPeriodEnd) {
    return `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`;
  }

  return "";
}
