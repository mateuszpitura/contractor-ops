"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { FeatureGate } from "@/components/billing/feature-gate";
import { ProviderConnectionCard } from "@/components/settings/provider-connection-card";
import { trpc } from "@/trpc/init";
import { DirectoryImportWizard } from "./google-workspace/directory-import-wizard";
import { SyncStatusSection } from "./google-workspace/sync-status-section";
import { GoogleWorkspaceLogo } from "./google-workspace-logo";

// ---------------------------------------------------------------------------
// GoogleWorkspaceProviderSection
// ---------------------------------------------------------------------------

export function GoogleWorkspaceProviderSection() {
  const t = useTranslations("Settings.integrations.googleWorkspace");
  const [wizardOpen, setWizardOpen] = useState(false);
  const searchParams = useSearchParams();

  // Check connection health
  const healthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider: "google_workspace" }),
  );
  const health = healthQuery.data as { status: string; connectionId?: string } | null | undefined;
  const isConnected = health?.status === "CONNECTED";

  // D-04: After OAuth redirect, auto-open import wizard
  useEffect(() => {
    if (searchParams.get("google_workspace") === "connected") {
      setWizardOpen(true);
    }
  }, [searchParams]);

  return (
    <FeatureGate requiredTier="Pro" featureName="Google Workspace integration">
      <div className="space-y-4">
        <ProviderConnectionCard
          provider="google_workspace"
          displayName="Google Workspace"
          icon={<GoogleWorkspaceLogo className="size-8" />}
          description={isConnected ? t("descriptionConnected") : t("descriptionDisconnected")}
        />

        {isConnected && <SyncStatusSection onImportClick={() => setWizardOpen(true)} />}

        <DirectoryImportWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    </FeatureGate>
  );
}
