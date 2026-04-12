"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/trpc/init";
import { ProrationPreview } from "./proration-preview";
import { UsageDashboard } from "./usage-dashboard";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingTab() {
  const searchParams = useSearchParams();
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

  // Fetch current subscription
  const { data: subscription } = useQuery(trpc.billing.getSubscription.queryOptions());

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
      if (data.url) {
        window.location.href = data.url;
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
  function _handleSelectPlan(priceId: string) {
    if (subscription?.tier) {
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

  return (
    <div className="space-y-8">
      {/* Usage Dashboard with KPI cards + plan comparison */}
      <UsageDashboard />

      {/* Proration preview (shown when upgrading/downgrading) */}
      {selectedPriceId && (
        <>
          <Separator />
          <ProrationPreview
            newPriceId={selectedPriceId}
            onConfirm={handleConfirmChange}
            onCancel={handleCancelChange}
          />
        </>
      )}

      <Separator />

      {/* Manage Billing Portal */}
      {subscription && (
        <Button variant="outline" onClick={handlePortal} disabled={portalMutation.isPending}>
          {portalMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Manage billing
        </Button>
      )}
    </div>
  );
}
