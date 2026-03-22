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

// ---------------------------------------------------------------------------
// Slack logo SVG (standard Slack octothorpe/hash icon)
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
            <SlackLogo className="size-8" />
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
