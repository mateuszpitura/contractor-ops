"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { format } from "date-fns";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { EquipmentTypeIcon } from "@/components/equipment/equipment-type-icon";
import { EquipmentStatusBadge } from "@/components/equipment/equipment-status-badge";
import { PortalReturnFlow } from "./portal-return-flow";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Contractor portal Equipment tab.
 * Shows assigned equipment with status badges and return button.
 * Displays return request status banner when applicable.
 */
export function PortalEquipmentTab() {
  const t = useTranslations("Portal.equipment");
  const tReturn = useTranslations("Portal.return");
  const queryClient = useQueryClient();
  const [returnFlowOpen, setReturnFlowOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const equipmentQuery = useQuery(trpc.portal.listEquipment.queryOptions());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const equipment = (equipmentQuery.data ?? []) as Array<{
    assignmentId: string;
    assignedAt: string;
    equipment: {
      id: string;
      name: string;
      serialNumber: string | null;
      type: string;
      status: string;
    };
    latestShipment: {
      currentStatus: string;
      deliveredAt: string | null;
    } | null;
  }>;

  const returnStatusQuery = useQuery(
    trpc.portal.getReturnStatus.queryOptions(),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const returnRequest = returnStatusQuery.data as {
    id: string;
    status: string;
    shipmentId: string | null;
    targetPointName: string | null;
  } | null;

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cancelMutation = useMutation<any, Error, Record<string, unknown>>(
    trpc.portal.cancelReturn.mutationOptions({
      onSuccess: () => {
        toast.success(tReturn("cancelledToast"));
        setCancelDialogOpen(false);
        queryClient.invalidateQueries({
          queryKey: trpc.portal.getReturnStatus.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.portal.listEquipment.queryKey(),
        });
      },
      onError: () => {
        toast.error(tReturn("cancelledToast"));
      },
    }),
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (equipmentQuery.isPending) {
    return (
      <div className="space-y-8">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  if (equipment.length === 0) {
    return (
      <div className="space-y-8">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <Package className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 font-display text-[20px] font-semibold">
            {t("emptyTitle")}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Can return check
  // -------------------------------------------------------------------------

  const canReturn = equipment.some(
    (item) =>
      item.equipment.status === "ASSIGNED" ||
      item.equipment.status === "DELIVERED",
  );

  const returnableItems = equipment
    .filter(
      (item) =>
        item.equipment.status === "ASSIGNED" ||
        item.equipment.status === "DELIVERED",
    )
    .map((item) => ({
      name: item.equipment.name,
      serialNumber: item.equipment.serialNumber,
    }));

  const hasActiveReturn =
    returnRequest &&
    (returnRequest.status === "PENDING_APPROVAL" ||
      returnRequest.status === "SHIPMENT_CREATED");

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        {canReturn && !hasActiveReturn && (
          <Button onClick={() => setReturnFlowOpen(true)}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t("returnAll")}
          </Button>
        )}
      </div>

      {/* Return status banner */}
      {returnRequest?.status === "PENDING_APPROVAL" && (
        <div className="rounded-md border-l-4 border-warning bg-warning/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("pendingApproval")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelDialogOpen(true)}
            >
              {t("cancelReturn")}
            </Button>
          </div>
        </div>
      )}

      {returnRequest?.status === "SHIPMENT_CREATED" && (
        <div className="rounded-md border-l-4 border-primary bg-primary/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("returnApproved")}</p>
            <Button
              size="sm"
              onClick={() => setReturnFlowOpen(true)}
            >
              {t("viewLabel")}
            </Button>
          </div>
        </div>
      )}

      {/* Equipment cards */}
      <div className="space-y-3">
        {equipment.map((item) => (
          <Card key={item.assignmentId}>
            <CardContent className="flex items-center gap-4 p-4">
              <EquipmentTypeIcon
                type={item.equipment.type}
                className="h-6 w-6"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {item.equipment.name}
                  </span>
                  <EquipmentStatusBadge status={item.equipment.status} />
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {item.equipment.serialNumber && (
                    <span className="font-mono">
                      {item.equipment.serialNumber}
                    </span>
                  )}
                  {item.latestShipment?.deliveredAt && (
                    <span>
                      {t("deliveredOn", {
                        date: format(
                          new Date(item.latestShipment.deliveredAt),
                          "MMM d, yyyy",
                        ),
                      })}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Return flow dialog */}
      <PortalReturnFlow
        open={returnFlowOpen}
        onOpenChange={setReturnFlowOpen}
        equipmentItems={returnableItems}
        returnRequest={returnRequest}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: trpc.portal.getReturnStatus.queryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.portal.listEquipment.queryKey(),
          });
        }}
      />

      {/* Cancel return confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tReturn("cancelConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tReturn("cancelConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              {tReturn("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (returnRequest) {
                  cancelMutation.mutate({ id: returnRequest.id });
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {tReturn("cancelConfirmTitle")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
