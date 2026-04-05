"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/trpc/init";
import { UpgradeInlineBanner } from "./upgrade-inline-banner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeatureGateProps {
  requiredTier: "Pro" | "Enterprise";
  featureName: string;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Tier ranking
// ---------------------------------------------------------------------------

const TIER_RANK: Record<string, number> = {
  STARTER: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

const PROP_TO_KEY: Record<string, string> = {
  Pro: "PRO",
  Enterprise: "ENTERPRISE",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeatureGate({
  requiredTier,
  featureName,
  children,
}: FeatureGateProps) {
  const { data: subscription, isLoading } = useQuery(
    trpc.billing.getSubscription.queryOptions(),
  );

  // Don't flash upgrade banner while loading
  if (isLoading) {
    return <>{children}</>;
  }

  const requiredTierKey = PROP_TO_KEY[requiredTier] ?? "PRO";
  const currentRank = subscription?.tier
    ? (TIER_RANK[subscription.tier as string] ?? 0)
    : 0;
  const requiredRank = TIER_RANK[requiredTierKey] ?? 0;

  if (!subscription || currentRank < requiredRank) {
    return (
      <UpgradeInlineBanner
        featureName={featureName}
        requiredTier={requiredTier}
      />
    );
  }

  return <>{children}</>;
}
