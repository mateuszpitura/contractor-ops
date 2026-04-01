"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/trpc/init";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CurrentPlanSummary } from "./current-plan-summary";
import { CreditUsageCard } from "./credit-usage-card";
import { PlanComparisonGrid } from "./plan-comparison-grid";
import { ProrationPreview } from "./proration-preview";
import type { TierId } from "./plan-comparison-grid";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingTab() {
  const searchParams = useSearchParams();
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

  // Fetch current subscription
  const { data: subscription } = useQuery(
    trpc.billing.getSubscription.queryOptions(),
  );

  // Checkout mutation
  const checkoutMutation = useMutation({
    ...trpc.billing.createCheckoutSession.mutationOptions(),
    onSuccess(data) {
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    },
    onError() {
      toast.error("Failed to start checkout. Please try again.");
    },
  });

  // Portal mutation
  const portalMutation = useMutation({
    ...trpc.billing.createPortalSession.mutationOptions(),
    onSuccess(data) {
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    },
    onError() {
      toast.error("Failed to open billing portal. Please try again.");
    },
  });

  // Handle success return from Stripe Checkout
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      toast.success("Subscription updated successfully!");
      // Clean the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  // Plan selection handler
  function handleSelectPlan(priceId: string) {
    if (subscription && subscription.tier) {
      // Existing subscription: show proration preview first
      setSelectedPriceId(priceId);
    } else {
      // No subscription: go straight to checkout
      checkoutMutation.mutate({ priceId });
    }
  }

  function handleConfirmChange() {
    if (selectedPriceId) {
      checkoutMutation.mutate({ priceId: selectedPriceId });
      setSelectedPriceId(null);
    }
  }

  function handleCancelChange() {
    setSelectedPriceId(null);
  }

  function handlePortal() {
    portalMutation.mutate();
  }

  const currentTier = subscription?.tier as TierId | undefined;

  return (
    <div className="space-y-8">
      {/* Top row: Current Plan + Credit Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <CurrentPlanSummary />
        <CreditUsageCard />
      </div>

      <Separator />

      {/* Proration preview (shown when upgrading/downgrading) */}
      {selectedPriceId && (
        <ProrationPreview
          newPriceId={selectedPriceId}
          onConfirm={handleConfirmChange}
          onCancel={handleCancelChange}
        />
      )}

      {/* Plan Comparison Grid */}
      <PlanComparisonGrid
        currentTier={currentTier}
        onSelectPlan={handleSelectPlan}
      />

      <Separator />

      {/* Manage Billing Portal */}
      {subscription && (
        <Button
          variant="outline"
          onClick={handlePortal}
          disabled={portalMutation.isPending}
        >
          {portalMutation.isPending && (
            <Loader2 className="animate-spin" aria-hidden="true" />
          )}
          Manage billing
        </Button>
      )}
    </div>
  );
}
