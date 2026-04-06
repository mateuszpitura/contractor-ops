// NOTE: This component is now used internally by CarrierShipmentForm for
// InPost-specific fields. The primary entry point for creating shipments is
// CarrierShipmentForm which provides a unified carrier selection experience.
// This component is kept functional for backward compatibility.
"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
} from "./paczkomat-picker";
import { PaczkomatDisplay } from "./paczkomat-display";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParcelSize = "small" | "medium" | "large";

interface InPostShipmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentIds: string[];
  contractorName: string;
  preferredPaczkomat?: PaczkomatPoint | null;
  onSuccess: () => void;
}

const PARCEL_SIZES: { value: ParcelSize; label: string }[] = [
  { value: "small", label: "Small (A)" },
  { value: "medium", label: "Medium (B)" },
  { value: "large", label: "Large (C)" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dialog form for creating an InPost shipment via the ShipX API.
 * Includes Paczkomat picker integration and parcel size selection.
 */
export function InPostShipmentForm({
  open,
  onOpenChange,
  equipmentIds,
  contractorName,
  preferredPaczkomat,
  onSuccess,
}: InPostShipmentFormProps) {
  const t = useTranslations("Equipment.inpost");
  const tCommon = useTranslations("Equipment");
  const queryClient = useQueryClient();

  const [selectedPoint, setSelectedPoint] = useState<PaczkomatPoint | null>(
    preferredPaczkomat ?? null,
  );
  const [parcelSize, setParcelSize] = useState<ParcelSize>("medium");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reset form when dialog opens
  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (v) {
        setSelectedPoint(preferredPaczkomat ?? null);
        setParcelSize("medium");
      }
      onOpenChange(v);
    },
    [onOpenChange, preferredPaczkomat],
  );

  const createMutation = useMutation(
    trpc.equipment.createInPostShipment.mutationOptions({
      onSuccess: () => {
        toast.success(t("shipmentCreated"));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        onSuccess();
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t("shipmentError"));
      },
    }),
  );

  const handleSubmit = useCallback(() => {
    if (!selectedPoint) return;
    createMutation.mutate({
      equipmentIds,
      targetPointId: selectedPoint.id,
      targetPointName: selectedPoint.name,
      targetPointAddress: selectedPoint.address,
      parcelSize,
      direction: "OUTBOUND",
    });
  }, [selectedPoint, equipmentIds, parcelSize, createMutation]);

  const geowidgetToken =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_INPOST_GEOWIDGET_TOKEN ?? "")
      : "";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createShipment")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Contractor name (read-only) */}
            <div className="space-y-2">
              <Label>{t("recipient")}</Label>
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                {contractorName}
              </div>
            </div>

            {/* Paczkomat destination */}
            <div className="space-y-2">
              <Label>{t("destinationPaczkomat")}</Label>
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
                  <Package className="mr-2 h-4 w-4" />
                  {t("selectPaczkomat")}
                </Button>
              )}
            </div>

            {/* Parcel size */}
            <div className="space-y-2">
              <Label>{t("parcelSize")}</Label>
              <RadioGroup
                value={parcelSize}
                onValueChange={(val) => val && setParcelSize(val as ParcelSize)}
                className="flex gap-4"
              >
                {PARCEL_SIZES.map((size) => (
                  <label
                    key={size.value}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <RadioGroupItem value={size.value} />
                    <span className="text-sm">{size.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              {tCommon("form.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedPoint || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("createShipment")}
            </Button>
          </DialogFooter>
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
