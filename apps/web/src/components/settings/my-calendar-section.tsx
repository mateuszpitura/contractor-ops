"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { FeatureGate } from "@/components/billing/feature-gate";
import { GoogleCalendarIcon, OutlookCalendarIcon } from "@/components/integrations/provider-icons";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarConnection {
  id: string;
  provider: string;
  status: string;
  displayName: string | null;
  connectedAt: string | Date | null;
  userId: string | null;
  tokenExpiresAt: string | Date | null;
}

// ---------------------------------------------------------------------------
// CalendarProviderCard
// ---------------------------------------------------------------------------

interface CalendarProviderCardProps {
  provider: "GOOGLE_CALENDAR" | "OUTLOOK_CALENDAR";
  displayName: string;
  icon: React.ReactNode;
  connection: CalendarConnection | undefined;
  onConnect: () => void;
  onDisconnect: (connectionId: string) => void;
  isDisconnecting: boolean;
}

function CalendarProviderCard({
  provider,
  displayName,
  icon,
  connection,
  onConnect,
  onDisconnect,
  isDisconnecting,
}: CalendarProviderCardProps) {
  const t = useTranslations("CalendarSettings");
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const isConnected = connection?.status === "CONNECTED";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center">{icon}</span>
            <h4 className="text-base font-semibold">{displayName}</h4>
            <Badge
              variant="secondary"
              className={
                isConnected
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              }
            >
              {isConnected ? t("statusConnected") : t("statusNotConnected")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-3">
              <div className="space-y-1 text-sm">
                {connection.displayName && (
                  <p>
                    <span className="text-muted-foreground">{t("connectedAccount")}:</span>{" "}
                    <span className="font-medium">{connection.displayName}</span>
                  </p>
                )}
                {connection.connectedAt && (
                  <p>
                    <span className="text-muted-foreground">{t("connectedOn")}:</span>{" "}
                    <span className="font-medium">
                      {new Date(connection.connectedAt).toLocaleDateString()}
                    </span>
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setDisconnectDialogOpen(true)}
              >
                {t("disconnectCalendar")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("connectDescription")}</p>
              <Button onClick={onConnect}>{t("connectCalendar")}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect confirmation dialog */}
      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("disconnectTitle", { provider: displayName })}</AlertDialogTitle>
            <AlertDialogDescription>{t("disconnectBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepConnection")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDisconnecting}
              onClick={() => {
                if (connection) {
                  onDisconnect(connection.id);
                  setDisconnectDialogOpen(false);
                }
              }}
            >
              {isDisconnecting && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
              {t("disconnectCalendar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// MyCalendarSection
// ---------------------------------------------------------------------------

export function MyCalendarSection() {
  const t = useTranslations("CalendarSettings");
  const queryClient = useQueryClient();

  // Fetch personal calendar connections
  const connectionsQuery = useQuery(trpc.calendar.listPersonalConnections.queryOptions());
  const connections = (connectionsQuery.data ?? []) as CalendarConnection[];

  // Fetch synced events count
  const eventsQuery = useQuery(trpc.calendar.listEvents.queryOptions());
  const eventCount = (eventsQuery.data as { count: number } | undefined)?.count ?? 0;

  // Disconnect mutation
  const disconnectMutation = useMutation(
    trpc.calendar.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success(t("disconnectedToast"));
        queryClient.invalidateQueries({
          queryKey: trpc.calendar.listPersonalConnections.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.calendar.listEvents.queryKey(),
        });
      },
      onError: () => {
        toast.error(t("disconnectFailedToast"));
      },
    }),
  );

  // Find connections for each provider
  const googleConnection = connections.find((c) => c.provider === "GOOGLE_CALENDAR");
  const outlookConnection = connections.find((c) => c.provider === "OUTLOOK_CALENDAR");

  // OAuth connect handlers — fetch authorization URL via tRPC and redirect
  const googleOAuthQuery = trpc.integration.getOAuthUrlGeneric.queryOptions({
    provider: "google-calendar",
  });
  const outlookOAuthQuery = trpc.integration.getOAuthUrlGeneric.queryOptions({
    provider: "outlook-calendar",
  });

  async function handleGoogleConnect() {
    try {
      const result = await queryClient.fetchQuery(googleOAuthQuery);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      toast.error(t("connectFailedToast"));
    }
  }

  async function handleOutlookConnect() {
    try {
      const result = await queryClient.fetchQuery(outlookOAuthQuery);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      toast.error(t("connectFailedToast"));
    }
  }

  function handleDisconnect(connectionId: string) {
    disconnectMutation.mutate({ connectionId });
  }

  // Loading state
  if (connectionsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-64" />
            <Skeleton className="mt-2 h-8 w-32" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded" />
              <Skeleton className="h-5 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-64" />
            <Skeleton className="mt-2 h-8 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <FeatureGate requiredTier="Pro" featureName="Calendar integration">
      <div className="space-y-6">
        {/* Calendar provider cards */}
        <div className="space-y-4">
          <CalendarProviderCard
            provider="GOOGLE_CALENDAR"
            displayName={t("googleCalendar")}
            icon={<GoogleCalendarIcon className="h-8 w-8" />}
            connection={googleConnection}
            onConnect={handleGoogleConnect}
            onDisconnect={handleDisconnect}
            isDisconnecting={disconnectMutation.isPending}
          />
          <CalendarProviderCard
            provider="OUTLOOK_CALENDAR"
            displayName={t("outlookCalendar")}
            icon={<OutlookCalendarIcon className="h-8 w-8 text-[#0078D4]" />}
            connection={outlookConnection}
            onConnect={handleOutlookConnect}
            onDisconnect={handleDisconnect}
            isDisconnecting={disconnectMutation.isPending}
          />
        </div>

        {/* Active Synced Events section */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("activeSyncedEvents")}</h3>
          <Badge variant="secondary">{t("eventsSynced", { count: eventCount })}</Badge>
          <p className="text-xs text-muted-foreground">{t("syncedEventsHelper")}</p>
        </div>
      </div>
    </FeatureGate>
  );
}
