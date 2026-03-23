"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Unplug } from "lucide-react";

import { trpc } from "@/trpc/init";
import { ProviderConnectionCard } from "./provider-connection-card";
import { SlackUserMapping } from "./slack-user-mapping";

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
];

// ---------------------------------------------------------------------------
// IntegrationsTab
// ---------------------------------------------------------------------------

export function IntegrationsTab() {
  const t = useTranslations("Settings.integrations");

  // Check Slack connection status for user mapping visibility
  const healthQuery = useQuery(
    trpc.integration.getHealth.queryOptions({ provider: "slack" }),
  );
  const isSlackConnected = healthQuery.data?.status === "CONNECTED";

  return (
    <div className="space-y-8">
      {/* Provider cards grid */}
      {PROVIDER_CONFIG.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Unplug className="size-12 text-muted-foreground" />
          <h3 className="mt-4 text-base font-semibold">
            {t("emptyState.heading")}
          </h3>
          <p className="mt-1 max-w-[400px] text-sm text-muted-foreground">
            {t("emptyState.body")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {PROVIDER_CONFIG.map((config) => (
            <ProviderConnectionCard
              key={config.provider}
              provider={config.provider}
              displayName={config.displayName}
              icon={config.icon}
              description={t(config.descriptionKey)}
            />
          ))}
        </div>
      )}

      {/* Slack-specific user mapping (preserved for backward compatibility) */}
      {isSlackConnected && <SlackUserMapping />}
    </div>
  );
}
