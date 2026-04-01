"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { trpc } from "@/trpc/init";
import { TrialBanner } from "./trial-banner";
import { SoftBlockModal } from "./soft-block-modal";

// ---------------------------------------------------------------------------
// BillingOverlay
// ---------------------------------------------------------------------------
// Client component rendered inside the dashboard layout (server component).
// Queries the subscription status and conditionally renders:
// 1. TrialBanner (last 7 days of trial)
// 2. SoftBlockModal (trial expired)
// ---------------------------------------------------------------------------

export function BillingOverlay() {
  const router = useRouter();

  const { data: subscription } = useQuery(
    trpc.billing.getSubscription.queryOptions(),
  );

  const checkoutMutation = useMutation({
    ...trpc.billing.createCheckoutSession.mutationOptions(),
    onSuccess(data) {
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    },
  });

  // No subscription data yet or no subscription at all -- don't render
  if (!subscription) return null;

  const isTrialing = subscription.status === "TRIALING";
  const trialEnd = subscription.trialEnd
    ? new Date(subscription.trialEnd)
    : null;

  // Trial expired: show soft-block modal
  const isTrialExpired =
    isTrialing && trialEnd !== null && trialEnd.getTime() < Date.now();

  // Trial ending soon: show banner (last 7 days)
  const showBanner =
    isTrialing &&
    trialEnd !== null &&
    !isTrialExpired;

  function handleUpgrade() {
    router.push("/settings?tab=billing");
  }

  function handleSelectPlan(priceId: string) {
    checkoutMutation.mutate({ priceId });
  }

  return (
    <>
      {showBanner && trialEnd && (
        <TrialBanner trialEnd={trialEnd} onUpgrade={handleUpgrade} />
      )}
      <SoftBlockModal
        isOpen={isTrialExpired}
        onSelectPlan={handleSelectPlan}
      />
    </>
  );
}
