"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/trpc/init";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TopUpDialog } from "./top-up-dialog";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreditUsageCard() {
  const [topUpOpen, setTopUpOpen] = useState(false);

  const { data: subscription, isLoading } = useQuery(
    trpc.billing.getSubscription.queryOptions(),
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  // No subscription means no credits
  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>OCR Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Subscribe to a plan to get OCR credits.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Fetch real credit balance from the backend ledger
  const { data: creditBalance } = useQuery(
    trpc.billing.getCreditBalance.queryOptions(),
  );

  const used = creditBalance?.used ?? 0;
  const allowance = creditBalance?.allowance ?? 0;
  const remaining = creditBalance?.balance ?? 0;
  const percentUsed = allowance > 0 ? (used / allowance) * 100 : 0;
  const isLow = allowance > 0 && remaining / allowance < 0.2;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>OCR Credits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress
            value={percentUsed}
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={allowance}
            aria-label={`OCR credits: ${used} of ${allowance} used`}
          />

          <p
            className={`text-sm ${isLow ? "text-destructive font-medium" : "text-muted-foreground"}`}
          >
            {remaining} of {allowance} credits remaining
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setTopUpOpen(true)}
          >
            Buy credits
          </Button>
        </CardContent>
      </Card>

      <TopUpDialog open={topUpOpen} onOpenChange={setTopUpOpen} />
    </>
  );
}
