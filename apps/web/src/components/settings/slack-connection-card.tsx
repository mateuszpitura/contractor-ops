"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

import { SlackBrandIcon } from "@/components/integrations/brand-icons";

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

const STATUS_BADGE_CLASSES: Record<string, string> = {
  CONNECTED: "bg-emerald-500/10 text-emerald-500",
  DISCONNECTED: "bg-muted text-muted-foreground",
  ERROR: "bg-destructive/10 text-destructive",
  REAUTH_REQUIRED: "bg-amber-500/10 text-amber-500",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlackConnectionCard() {
  const t = useTranslations("Settings");
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  // ---- Data fetching ----
  const statusQuery = useQuery(trpc.integration.getSlackStatus.queryOptions());
  const status = statusQuery.data;

  // ---- Handle OAuth callback result ----
  useEffect(() => {
    const slackParam = searchParams.get("slack");
    if (slackParam === "connected") {
      toast.success(t("integrations.toasts.connected"));
      queryClient.invalidateQueries({
        queryKey: trpc.integration.getSlackStatus.queryKey(),
      });
      // Clear the param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("slack");
      window.history.replaceState({}, "", url.toString());
    } else if (slackParam === "error") {
      toast.error(t("integrations.toasts.connectFailed"));
      const url = new URL(window.location.href);
      url.searchParams.delete("slack");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, t, queryClient]);

  // ---- Disconnect mutation ----
  const disconnectMutation = useMutation(
    trpc.integration.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(t("integrations.toasts.disconnected"));
        queryClient.invalidateQueries({
          queryKey: trpc.integration.getSlackStatus.queryKey(),
        });
        setDisconnectDialogOpen(false);
      },
      onError: () => {
        toast.error(t("integrations.toasts.disconnectFailed"));
      },
    }),
  );

  // ---- Connect handler ----
  const oauthUrlQuery = useQuery({
    ...trpc.integration.getOAuthUrl.queryOptions(),
    enabled: false, // only fetch on demand
  });

  async function handleConnect() {
    const result = await oauthUrlQuery.refetch();
    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  }

  // ---- Loading state ----
  if (statusQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded" />
            <Skeleton className="h-5 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-2 h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  // Determine connection state
  const isConnected = status?.connected === true;
  const connectionStatus = status?.status ?? "DISCONNECTED";
  const isReauthRequired = connectionStatus === "REAUTH_REQUIRED";

  const statusBadgeClass =
    STATUS_BADGE_CLASSES[connectionStatus] ??
    STATUS_BADGE_CLASSES.DISCONNECTED;

  const statusLabelKey =
    connectionStatus === "CONNECTED"
      ? "statusConnected"
      : connectionStatus === "ERROR"
        ? "statusError"
        : connectionStatus === "REAUTH_REQUIRED"
          ? "statusReauth"
          : "statusDisconnected";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <SlackBrandIcon className="size-8" />
            <h4 className="text-base font-semibold">
              {t("integrations.slack.heading")}
            </h4>
            <Badge variant="secondary" className={statusBadgeClass}>
              {t(
                `integrations.slack.${statusLabelKey}` as Parameters<typeof t>[0],
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isConnected && !isReauthRequired && (
            <div className="space-y-3">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    {t("integrations.slack.connectedTo")}:
                  </span>{" "}
                  <span className="font-medium">{status?.displayName}</span>
                </p>
                {status?.connectedByUser && (
                  <p>
                    <span className="text-muted-foreground">
                      {t("integrations.slack.connectedBy")}:
                    </span>{" "}
                    <span className="font-medium">
                      {status.connectedByUser.name}
                    </span>
                  </p>
                )}
                {status?.connectedAt && (
                  <p>
                    <span className="text-muted-foreground">
                      {t("integrations.slack.connectedOn")}:
                    </span>{" "}
                    <span className="font-medium">
                      {new Date(status.connectedAt).toLocaleDateString()}
                    </span>
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setDisconnectDialogOpen(true)}
              >
                {t("integrations.slack.disconnectCta")}
              </Button>
            </div>
          )}

          {isReauthRequired && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("integrations.slack.statusReauth")}
              </p>
              <Button variant="outline" onClick={handleConnect}>
                {t("integrations.slack.reconnectCta")}
              </Button>
            </div>
          )}

          {!isConnected && !isReauthRequired && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("integrations.slack.descriptionDisconnected")}
              </p>
              <Button onClick={handleConnect}>
                {t("integrations.slack.connectCta")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect confirmation */}
      <AlertDialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("integrations.disconnectConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("integrations.disconnectConfirm.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("integrations.disconnectConfirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}
            >
              {disconnectMutation.isPending && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              {t("integrations.disconnectConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
