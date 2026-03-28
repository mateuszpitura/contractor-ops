"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { ProviderConnectionCard } from "./provider-connection-card";
import { SlackUserMapping } from "./slack-user-mapping";
import { KsefSetupDialog } from "./ksef-setup-dialog";
import { KsefSyncHistory } from "./ksef-sync-history";
import { JiraProviderSection } from "@/components/integrations/jira-provider-section";
import { JiraLogo } from "@/components/integrations/jira-logo";

// ---------------------------------------------------------------------------
// Slack logo SVG (extracted from slack-connection-card.tsx for reuse)
// ---------------------------------------------------------------------------

function SlackLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 54 54"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g fill="none" fillRule="evenodd">
        <path
          d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386"
          fill="#36C5F0"
        />
        <path
          d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387"
          fill="#2EB67D"
        />
        <path
          d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386"
          fill="#ECB22E"
        />
        <path
          d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.25a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387"
          fill="#E01E5A"
        />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Provider registry for UI (static for now, will be dynamic in future phases)
// ---------------------------------------------------------------------------

const PROVIDER_CONFIG = [
  {
    provider: "slack",
    displayName: "Slack",
    icon: <SlackLogo className="size-8" />,
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

  const connectionQuery = useQuery(
    trpc.ksef.connectionStatus.queryOptions(),
  );
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
          <Loader2
            className="mr-1.5 size-3.5 animate-spin"
            aria-hidden="true"
          />
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
  const orgData = settingsQuery.data as
    | { metadata?: Record<string, unknown> }
    | null
    | undefined;
  const orgMetadata = orgData?.metadata ?? {};
  const settingsJson =
    (orgMetadata.settingsJson as Record<string, unknown>) ?? {};
  const orgNip = (settingsJson.taxId as string) ?? null;

  // KSeF connection status
  const connectionQuery = useQuery(
    trpc.ksef.connectionStatus.queryOptions(),
  );
  const ksefConnection = connectionQuery.data as
    | { id: string; status: string }
    | null
    | undefined;
  const isConnected = ksefConnection?.status === "CONNECTED";

  return (
    <div className="space-y-4">
      {/* Standard provider card — but KSeF uses custom connect dialog instead of OAuth */}
      <ProviderConnectionCard
        provider="ksef"
        displayName="KSeF"
        icon={<ShieldCheck className="size-8 text-primary" />}
        description={tIntegrations("ksef.descriptionDisconnected" as Parameters<typeof tIntegrations>[0])}
      />

      {/* KSeF-specific controls (sync button + history) */}
      {isConnected && <KsefControls />}

      {/* KSeF setup dialog (triggered by provider card connect) */}
      <KsefSetupDialog
        open={setupDialogOpen}
        onOpenChange={setSetupDialogOpen}
        orgNip={orgNip}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// IntegrationsTab
// ---------------------------------------------------------------------------

export function IntegrationsTab() {
  const t = useTranslations("Settings.integrations");

  // Check Slack connection status for user mapping visibility
  const healthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider: "slack" }),
  );
  const slackHealth = healthQuery.data as
    | { status: string }
    | null
    | undefined;
  const isSlackConnected = slackHealth?.status === "CONNECTED";

  // Non-KSeF/Jira providers (rendered separately for custom behavior)
  const standardProviders = PROVIDER_CONFIG.filter(
    (c) => c.provider !== "ksef" && c.provider !== "jira",
  );

  return (
    <div className="space-y-8">
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

        {/* Jira has custom status mapping controls */}
        <JiraProviderSection />
      </div>

      {/* Slack-specific user mapping (preserved for backward compatibility) */}
      {isSlackConnected && <SlackUserMapping />}
    </div>
  );
}
