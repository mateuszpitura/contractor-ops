"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, Tag } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// tRPC equipment proxy (workaround: API dist types are stale until next build)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const equipmentProxy = (trpc as any).equipment as {
  getShipmentLabel: { queryOptions: (input: { shipmentId: string }) => any };
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShipmentLabelViewProps {
  shipmentId: string;
  trackingNumber?: string | null;
  paczkomatName?: string | null;
}

interface LabelViewProps {
  labelData: string;
  contentType: string;
  trackingNumber?: string | null;
  paczkomatName?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64ToBlob(base64: string, contentType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteNumbers], { type: contentType });
}

// ---------------------------------------------------------------------------
// Label Display (shared between admin and portal)
// ---------------------------------------------------------------------------

export function LabelDisplay({
  labelData,
  contentType,
  trackingNumber,
  paczkomatName,
}: LabelViewProps) {
  const t = useTranslations("Equipment.label");

  const blobUrl = useMemo(() => {
    const blob = base64ToBlob(labelData, contentType);
    return URL.createObjectURL(blob);
  }, [labelData, contentType]);

  const handleDownload = useCallback(() => {
    const ext = contentType.includes("pdf") ? "pdf" : "png";
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `shipping-label${trackingNumber ? `-${trackingNumber}` : ""}.${ext}`;
    link.click();
  }, [blobUrl, contentType, trackingNumber]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open(blobUrl, "_blank");
    if (printWindow) {
      printWindow.addEventListener("load", () => {
        printWindow.print();
      });
    }
  }, [blobUrl]);

  return (
    <div className="space-y-3">
      {/* Label image/PDF */}
      <div className="flex justify-center rounded-md border bg-card p-4">
        {contentType.includes("pdf") ? (
          <iframe
            src={blobUrl}
            className="h-[300px] w-full max-w-[240px]"
            title="Shipping label"
          />
        ) : (
          <img
            src={`data:${contentType};base64,${labelData}`}
            alt="Shipping label"
            className="h-auto w-full max-w-[240px]"
          />
        )}
      </div>

      {/* Tracking number */}
      {trackingNumber && (
        <p className="text-center font-mono text-xs text-muted-foreground">
          {trackingNumber}
        </p>
      )}

      {/* Paczkomat name */}
      {paczkomatName && (
        <p className="text-center text-sm text-muted-foreground">
          {paczkomatName}
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-3">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t("download")}
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          {t("print")}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fetching wrapper
// ---------------------------------------------------------------------------

/**
 * Fetches and displays a shipment label with download and print actions.
 * Uses the equipment.getShipmentLabel tRPC query.
 */
export function ShipmentLabelView({
  shipmentId,
  trackingNumber,
  paczkomatName,
}: ShipmentLabelViewProps) {
  const t = useTranslations("Equipment.label");

  const labelQuery = useQuery(
    equipmentProxy.getShipmentLabel.queryOptions({ shipmentId }),
  );

  if (labelQuery.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="mx-auto h-[240px] w-[240px] rounded-md" />
        <Skeleton className="mx-auto h-4 w-32" />
        <div className="flex justify-center gap-3">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    );
  }

  const labelData = labelQuery.data as { data: string; contentType: string } | undefined;

  if (labelQuery.isError || !labelData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Tag className="h-8 w-8 text-muted-foreground/50" />
        <h4 className="mt-3 text-sm font-medium">{t("notAvailable")}</h4>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          {t("notAvailableDescription")}
        </p>
      </div>
    );
  }

  return (
    <LabelDisplay
      labelData={labelData.data}
      contentType={labelData.contentType}
      trackingNumber={trackingNumber}
      paczkomatName={paczkomatName}
    />
  );
}
