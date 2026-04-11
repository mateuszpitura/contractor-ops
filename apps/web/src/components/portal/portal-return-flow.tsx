"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PaczkomatPicker,
  type PaczkomatPoint,
} from "@/components/equipment/paczkomat-picker";
import { PaczkomatDisplay } from "@/components/equipment/paczkomat-display";
import { LabelDisplay } from "@/components/equipment/shipment-label-view";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortalReturnFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentItems: Array<{
    name: string;
    serialNumber: string | null;
  }>;
  returnRequest?: {
    id: string;
    status: string;
    shipmentId: string | null;
    targetPointName: string | null;
  } | null;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            i + 1 === currentStep ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Multi-step return flow modal for the contractor portal.
 * Step 1: Select drop-off Paczkomat
 * Step 2: Confirm return request
 * Step 3: View label after approval
 */
export function PortalReturnFlow({
  open,
  onOpenChange,
  equipmentItems,
  returnRequest,
  onSuccess,
}: PortalReturnFlowProps) {
  const t = useTranslations("Portal.return");
  const queryClient = useQueryClient();

  // Determine initial step based on existing return request
  const getInitialStep = () => {
    if (returnRequest?.status === "SHIPMENT_CREATED") return 3;
    if (returnRequest?.status === "PENDING_APPROVAL") return 2;
    return 1;
  };

  const [step, setStep] = useState(getInitialStep);
  const [selectedPoint, setSelectedPoint] = useState<PaczkomatPoint | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reset on open
  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (v) {
        setStep(getInitialStep());
        setSelectedPoint(null);
      }
      onOpenChange(v);
    },
    [onOpenChange, returnRequest],
  );

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const requestMutation = useMutation(
    trpc.portal.requestReturn.mutationOptions({
      onSuccess: () => {
        toast.success(t("returnRequested"));
        queryClient.invalidateQueries({
          queryKey: trpc.portal.getReturnStatus.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.portal.listEquipment.queryKey(),
        });
        onSuccess();
        // Stay on step 2 to show pending state
      },
      onError: () => {
        toast.error(t("returnRequested"));
      },
    }),
  );

  const handleRequestReturn = useCallback(() => {
    if (!selectedPoint) return;
    requestMutation.mutate({
      targetPointId: selectedPoint.id,
      targetPointName: selectedPoint.name,
      targetPointAddress: selectedPoint.address,
    });
  }, [selectedPoint, requestMutation]);

  // -------------------------------------------------------------------------
  // Label query (Step 3)
  // -------------------------------------------------------------------------

  const labelQuery = useQuery({
    ...trpc.portal.getReturnLabel.queryOptions({
      returnRequestId: returnRequest?.id ?? "",
    }),
    enabled: step === 3 && !!returnRequest?.id,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelData = labelQuery.data as
    | { data: string; contentType: string }
    | undefined;

  // -------------------------------------------------------------------------
  // Geowidget token
  // -------------------------------------------------------------------------

  const geowidgetToken =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN ?? "")
      : "";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>

          <StepIndicator currentStep={step} totalSteps={3} />

          {/* Step 1: Select drop-off Paczkomat */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("itemsToReturn", { count: equipmentItems.length })}
              </p>
              <ul className="space-y-1 text-sm">
                {equipmentItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      {item.name}
                      {item.serialNumber && (
                        <span className="ms-1 font-mono text-xs text-muted-foreground">
                          ({item.serialNumber})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <p className="text-sm font-medium">{t("selectDropOff")}</p>
                {selectedPoint ? (
                  <PaczkomatDisplay
                    pointId={selectedPoint.id}
                    pointName={selectedPoint.name}
                    pointAddress={selectedPoint.address}
                    onChangeClick={() => setPickerOpen(true)}
                  />
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Package className="me-2 h-4 w-4" />
                    {t("selectDropOff")}
                  </Button>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedPoint}
                >
                  {t("next")}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2: Confirm return */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">{t("itemsToReturn", { count: equipmentItems.length })}</span>
                </p>
                <ul className="space-y-1 ps-4">
                  {equipmentItems.map((item, i) => (
                    <li key={i}>
                      {item.name}
                      {item.serialNumber && (
                        <span className="ms-1 font-mono text-xs text-muted-foreground">
                          ({item.serialNumber})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {selectedPoint && (
                  <p className="text-muted-foreground">
                    {t("dropOffAt", { name: selectedPoint.name })}
                    <br />
                    <span className="text-xs">{selectedPoint.address}</span>
                  </p>
                )}
              </div>

              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  {t("approvalNotice")}
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep(1)}>
                  {t("back")}
                </Button>
                <Button
                  onClick={handleRequestReturn}
                  disabled={requestMutation.isPending || requestMutation.isSuccess}
                >
                  {requestMutation.isPending && (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  )}
                  {t("requestReturn")}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: Label view (after approval) */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-center text-lg font-semibold">
                {t("step3Title")}
              </p>

              {labelQuery.isPending ? (
                <div className="space-y-3">
                  <Skeleton className="mx-auto h-[240px] w-[240px] rounded-md" />
                  <Skeleton className="mx-auto h-4 w-32" />
                </div>
              ) : labelData ? (
                <LabelDisplay
                  labelData={labelData.data}
                  contentType={labelData.contentType}
                />
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t("approvalNotice")}
                </div>
              )}

              {returnRequest?.targetPointName && (
                <p className="text-center text-sm text-muted-foreground">
                  {t("dropOffAt", { name: returnRequest.targetPointName })}
                </p>
              )}

              <DialogFooter>
                <Button onClick={() => onOpenChange(false)}>
                  {t("cancel")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nested Paczkomat picker */}
      <PaczkomatPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={setSelectedPoint}
        geowidgetToken={geowidgetToken}
      />
    </>
  );
}
