"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FeatureGate } from "@/components/billing/feature-gate";
import { ProviderConnectionCard } from "@/components/settings/provider-connection-card";
import { trpc } from "@/trpc/init";
import { TeamsChannelMappingCard } from "./teams-channel-mapping-card";
import { TeamsLogo } from "./teams-logo";

// ---------------------------------------------------------------------------
// TeamsProviderSection
// ---------------------------------------------------------------------------

export function TeamsProviderSection() {
  const t = useTranslations("Settings.integrations.teams");

  const healthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider: "microsoft_teams" }),
  );
  const health = healthQuery.data as { status: string; connectionId?: string } | null | undefined;
  const isConnected = health?.status === "CONNECTED";

  return (
    <FeatureGate requiredTier="Pro" featureName="Microsoft Teams integration">
      <div className="space-y-4">
        <ProviderConnectionCard
          provider="microsoft_teams"
          displayName="Microsoft Teams"
          icon={<TeamsLogo className="size-8" />}
          description={isConnected ? t("descriptionConnected") : t("descriptionDisconnected")}
        />

        {isConnected && <TeamsChannelMappingCard />}
      </div>
    </FeatureGate>
  );
}
