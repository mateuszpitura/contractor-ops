"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// SyncStatusSection
// ---------------------------------------------------------------------------

interface SyncStatusSectionProps {
  onImportClick: () => void;
}

export function SyncStatusSection({ onImportClick }: SyncStatusSectionProps) {
  const t = useTranslations("GoogleWorkspace.sync");
  const queryClient = useQueryClient();

  const syncStatusQuery = useQuery(trpc.googleWorkspace.syncStatus.queryOptions());
  const syncStatus = syncStatusQuery.data;

  const triggerSyncMutation = useMutation({
    ...trpc.googleWorkspace.triggerSync.mutationOptions(),
    onSuccess: () => {
      toast.success(t("syncStarted"));
      void queryClient.invalidateQueries({
        queryKey: trpc.googleWorkspace.syncStatus.queryKey(),
      });
    },
    onError: () => {
      toast.error(t("syncError"));
    },
  });

  // Loading state
  if (syncStatusQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </CardContent>
      </Card>
    );
  }

  // Not connected or no data
  if (!syncStatus?.connected) return null;

  const lastSyncLabel = syncStatus.lastSyncAt
    ? t("lastSynced", {
        time: formatDistanceToNow(new Date(syncStatus.lastSyncAt), {
          addSuffix: true,
        }),
      })
    : null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-3">
        <div className="flex-1 space-y-0.5 text-sm">
          {lastSyncLabel && <p className="text-muted-foreground">{lastSyncLabel}</p>}
          <p className="text-muted-foreground">{t("nextSync")}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (triggerSyncMutation.mutate as () => void)()}
            disabled={triggerSyncMutation.isPending}
          >
            {triggerSyncMutation.isPending && (
              <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
            )}
            {triggerSyncMutation.isPending ? t("syncing") : t("syncNow")}
          </Button>

          <Button variant="outline" size="sm" onClick={onImportClick}>
            {t("importUsers")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
