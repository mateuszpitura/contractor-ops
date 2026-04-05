"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

import { trpc } from "@/trpc/init";
import { FeatureGate } from "@/components/billing/feature-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// tRPC teams proxy (workaround: API dist types are stale until next build)
// The teams router IS registered in root.ts but dist/index.d.ts predates it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const teamsProxy = (trpc as any).teams as {
  getTeams: { queryOptions: () => any; queryKey: () => any[] };
  getChannels: {
    queryOptions: (input: { teamId: string }) => any;
    queryKey: (input: { teamId: string }) => any[];
  };
  getChannelMapping: { queryOptions: () => any; queryKey: () => any[] };
  saveChannelMapping: { mutationOptions: () => any };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTIFICATION_CATEGORIES = [
  "approvals",
  "invoices",
  "contracts",
  "tasks",
  "equipment",
] as const;

type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

const CATEGORY_LABEL_KEYS: Record<NotificationCategory, string> = {
  approvals: "categoryApprovals",
  invoices: "categoryInvoices",
  contracts: "categoryContracts",
  tasks: "categoryTasks",
  equipment: "categoryEquipment",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamsTeam {
  id: string;
  displayName: string;
}

interface TeamsChannel {
  id: string;
  displayName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamsChannelMappingCard() {
  const t = useTranslations("Settings.integrations.teams");
  const queryClient = useQueryClient();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [localMapping, setLocalMapping] = useState<
    Record<string, string>
  >({});

  // ---- Fetch joined teams ----
  const teamsQuery = useQuery(teamsProxy.getTeams.queryOptions());
  const teams = (teamsQuery.data ?? []) as TeamsTeam[];

  // ---- Auto-select single team ----
  useEffect(() => {
    if (teams.length === 1 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  // ---- Fetch channels for selected team ----
  const channelsQuery = useQuery({
    ...teamsProxy.getChannels.queryOptions({ teamId: selectedTeamId ?? "" }),
    enabled: !!selectedTeamId,
  });
  const channels = (channelsQuery.data ?? []) as TeamsChannel[];

  // ---- Fetch existing mapping ----
  const mappingQuery = useQuery(teamsProxy.getChannelMapping.queryOptions());

  // ---- Populate local mapping from server ----
  useEffect(() => {
    if (mappingQuery.data) {
      setLocalMapping(mappingQuery.data as Record<string, string>);
    }
  }, [mappingQuery.data]);

  // ---- Save mutation ----
  const saveMutation = useMutation({
    ...teamsProxy.saveChannelMapping.mutationOptions(),
    onSuccess: () => {
      toast.success(t("mappingSaved"));
      queryClient.invalidateQueries({
        queryKey: teamsProxy.getChannelMapping.queryKey(),
      });
    },
    onError: () => {
      toast.error(t("mappingSaveFailed"));
    },
  });

  // ---- Handlers ----
  function handleChannelSelect(category: string, channelId: string) {
    setLocalMapping((prev) => ({ ...prev, [category]: channelId }));
  }

  function handleSave() {
    (saveMutation.mutate as unknown as (input: { mapping: Record<string, string> }) => void)({ mapping: localMapping });
  }

  function handleRefresh() {
    if (selectedTeamId) {
      queryClient.invalidateQueries({
        queryKey: teamsProxy.getChannels.queryKey({
          teamId: selectedTeamId,
        }),
      });
    }
    queryClient.invalidateQueries({
      queryKey: teamsProxy.getTeams.queryKey(),
    });
  }

  const isLoadingChannels =
    channelsQuery.isLoading || channelsQuery.isFetching;
  const isChannelError = channelsQuery.isError;

  return (
    <FeatureGate requiredTier="Pro" featureName="Teams channel mapping">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-lg font-semibold">
              {t("channelMappingHeading")}
            </h4>
            <p className="text-sm text-muted-foreground">
              {t("channelMappingDescription")}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger render={<div className="inline-flex" />}>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoadingChannels}
                aria-label={t("refreshChannels")}
              >
                {isLoadingChannels ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("refreshChannels")}</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Team selector (only if multiple teams) */}
        {teams.length > 1 && (
          <Select
            value={selectedTeamId ?? undefined}
            onValueChange={(v) => v && setSelectedTeamId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectChannel")} />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Error state */}
        {isChannelError && (
          <p className="text-sm text-destructive">{t("channelFetchError")}</p>
        )}

        {/* Loading state */}
        {isLoadingChannels && !isChannelError && (
          <div className="space-y-3">
            {NOTIFICATION_CATEGORIES.map((cat) => (
              <div
                key={cat}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full sm:w-64" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoadingChannels &&
          !isChannelError &&
          selectedTeamId &&
          channels.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noChannels")}</p>
          )}

        {/* Channel mapping rows */}
        {!isLoadingChannels &&
          !isChannelError &&
          channels.length > 0 &&
          NOTIFICATION_CATEGORIES.map((category) => (
            <div
              key={category}
              className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-semibold">
                {t(
                  CATEGORY_LABEL_KEYS[category] as Parameters<typeof t>[0],
                )}
              </span>
              <Select
                value={localMapping[category] ?? undefined}
                onValueChange={(v) => v && handleChannelSelect(category, v)}
              >
                <SelectTrigger
                  className="w-full sm:w-64"
                  aria-label={`${t(CATEGORY_LABEL_KEYS[category] as Parameters<typeof t>[0])} notification channel`}
                >
                  <SelectValue placeholder={t("selectChannel")} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

        {/* Save button */}
        {!isLoadingChannels && !isChannelError && channels.length > 0 && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              {t("saveMapping")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
    </FeatureGate>
  );
}
