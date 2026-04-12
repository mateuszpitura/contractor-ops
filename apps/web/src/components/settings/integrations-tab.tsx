"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { SlackBrandIcon } from "@/components/integrations/brand-icons";
import { GoogleWorkspaceProviderSection } from "@/components/integrations/google-workspace-provider-section";
import { JiraLogo } from "@/components/integrations/jira-logo";
import { JiraProviderSection } from "@/components/integrations/jira-provider-section";
import { LinearProviderSection } from "@/components/integrations/linear-provider-section";
import { ConfluenceIcon, NotionIcon } from "@/components/integrations/provider-icons";
import { TeamsProviderSection } from "@/components/integrations/teams-provider-section";
import { PeppolStatusCard } from "@/components/peppol/peppol-status-card";
import { DpdProviderSection } from "@/components/settings/dpd-provider-section";
import { UpsProviderSection } from "@/components/settings/ups-provider-section";
import { Button } from "@/components/ui/button";
import { ZatcaStatusCard } from "@/components/zatca/zatca-status-card";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/trpc/init";
import { KsefSetupDialog } from "./ksef-setup-dialog";
import { KsefSyncHistory } from "./ksef-sync-history";
import { OrgCalendarSection } from "./org-calendar-section";
import { ProviderConnectionCard } from "./provider-connection-card";
import { SlackUserMapping } from "./slack-user-mapping";

// ---------------------------------------------------------------------------
// Provider registry for UI (static for now, will be dynamic in future phases)
// ---------------------------------------------------------------------------

const PROVIDER_CONFIG = [
  {
    provider: "slack",
    displayName: "Slack",
    icon: <SlackBrandIcon className="size-8" />,
    descriptionKey: "slack.descriptionDisconnected" as const,
  },
  {
    provider: "ksef",
    displayName: "KSeF",
    icon: <ShieldCheck className="size-8 text-primary" />,
    descriptionKey: "ksef.descriptionDisconnected" as const,
  },
  {
    provider: "jira",
    displayName: "Jira",
    icon: <JiraLogo className="size-8" />,
    descriptionKey: "jira.descriptionDisconnected" as const,
  },
];

// ---------------------------------------------------------------------------
// KSeF-specific controls (rendered below the provider card when connected)
// ---------------------------------------------------------------------------

function KsefControls() {
  const t = useTranslations("ksef");
  const queryClient = useQueryClient();

  const connectionQuery = useQuery(trpc.ksef.connectionStatus.queryOptions());
  const connection = connectionQuery.data as
    | { id: string; status: string; lastSyncAt?: string | null }
    | null
    | undefined;
  const isConnected = connection?.status === "CONNECTED";

  const syncMutation = useMutation({
    ...trpc.ksef.triggerSync.mutationOptions(),
    onSuccess: () => {
      toast.success(t("syncSuccessToast", { count: 0 }));
      queryClient.invalidateQueries({
        queryKey: trpc.ksef.syncHistory.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.ksef.connectionStatus.queryKey(),
      });
    },
    onError: () => {
      toast.error(t("syncFailedToast"));
    },
  });

  if (!isConnected) return null;

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => (syncMutation.mutate as () => void)()}
        disabled={syncMutation.isPending}
      >
        {syncMutation.isPending && (
          <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
        )}
        {syncMutation.isPending ? t("syncing") : t("syncNow")}
      </Button>

      <KsefSyncHistory connectionId={connection?.id} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KSeF Provider Section (wraps card + custom setup dialog + controls)
// ---------------------------------------------------------------------------

function KsefProviderSection() {
  const tIntegrations = useTranslations("Settings.integrations");
  const tKsef = useTranslations("ksef");
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);

  // Get org NIP from settings
  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  const orgData = settingsQuery.data as { metadata?: Record<string, unknown> } | null | undefined;
  const orgMetadata = orgData?.metadata ?? {};
  const settingsJson = (orgMetadata.settingsJson as Record<string, unknown>) ?? {};
  const orgNip = (settingsJson.taxId as string) ?? null;

  // KSeF connection status
  const connectionQuery = useQuery(trpc.ksef.connectionStatus.queryOptions());
  const ksefConnection = connectionQuery.data as { id: string; status: string } | null | undefined;
  const isConnected = ksefConnection?.status === "CONNECTED";

  return (
    <div className="space-y-4">
      {/* Standard provider card — but KSeF uses custom connect dialog instead of OAuth */}
      <ProviderConnectionCard
        provider="ksef"
        displayName="KSeF"
        icon={<ShieldCheck className="size-8 text-primary" />}
        description={tIntegrations(
          "ksef.descriptionDisconnected" as Parameters<typeof tIntegrations>[0],
        )}
      />

      {/* KSeF-specific controls (sync button + history) */}
      {isConnected && <KsefControls />}

      {/* KSeF setup dialog (triggered by provider card connect) */}
      <KsefSetupDialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen} orgNip={orgNip} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// IntegrationsTab
// ---------------------------------------------------------------------------

export function IntegrationsTab() {
  const t = useTranslations("Settings.integrations");
  const tImport = useTranslations("OnboardingImport");

  // Check Slack connection status for user mapping visibility
  const healthQuery = useQuery(trpc.integration.getHealth.queryOptions({ provider: "slack" }));
  const slackHealth = healthQuery.data as { status: string } | null | undefined;
  const isSlackConnected = slackHealth?.status === "CONNECTED";

  // Non-KSeF/Jira providers (rendered separately for custom behavior)
  const standardProviders = PROVIDER_CONFIG.filter(
    (c) => c.provider !== "ksef" && c.provider !== "jira",
  );

  return (
    <div className="space-y-8">
      {/* Re-import from tools link (D-03) */}
      <div className="flex items-center justify-between">
        <Button variant="outline" render={<Link href="/onboarding/import" />}>
          {tImport("settingsReimport")}
        </Button>
      </div>

      {/* Provider cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {standardProviders.map((config) => (
          <ProviderConnectionCard
            key={config.provider}
            provider={config.provider}
            displayName={config.displayName}
            icon={config.icon}
            description={t(config.descriptionKey)}
          />
        ))}

        {/* KSeF has custom connect dialog + sync controls */}
        <KsefProviderSection />

        {/* ZATCA (Saudi Arabia) has onboarding wizard + status card */}
        <ZatcaStatusCard />

        {/* Peppol (UAE) has custom wizard + status card */}
        <PeppolStatusCard />

        {/* Jira has custom status mapping controls */}
        <JiraProviderSection />

        {/* Linear has custom status mapping controls (D-03, D-11: coexists with Jira) */}
        <LinearProviderSection />

        {/* Google Workspace has directory import wizard */}
        <GoogleWorkspaceProviderSection />

        {/* Microsoft Teams integration with channel mapping */}
        <TeamsProviderSection />

        {/* DPD courier integration */}
        <DpdProviderSection />

        {/* UPS courier integration */}
        <UpsProviderSection />

        {/* Notion provider card */}
        <ProviderConnectionCard
          provider="notion"
          displayName="Notion"
          icon={<NotionIcon className="size-8" />}
          description={t("provider.connectCta" as Parameters<typeof t>[0], { provider: "Notion" })}
        />

        {/* Confluence provider card */}
        <ProviderConnectionCard
          provider="confluence"
          displayName="Confluence"
          icon={<ConfluenceIcon className="size-8" />}
          description={t("provider.connectCta" as Parameters<typeof t>[0], {
            provider: "Confluence",
          })}
        />
      </div>

      {/* Organization shared calendar section */}
      <OrgCalendarSection />

      {/* Slack-specific user mapping (preserved for backward compatibility) */}
      {isSlackConnected && <SlackUserMapping />}
    </div>
  );
}
