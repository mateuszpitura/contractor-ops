"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaczkomatPoint {
  id: string;
  name: string;
  address: string;
}

interface PaczkomatPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (point: PaczkomatPoint) => void;
  geowidgetToken: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEOWIDGET_ORIGIN = "https://geowidget.inpost.pl";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal overlay embedding the InPost Geowidget iframe for Paczkomat selection.
 * Communicates via postMessage with strict origin validation.
 */
export function PaczkomatPicker({
  open,
  onOpenChange,
  onSelect,
  geowidgetToken,
}: PaczkomatPickerProps) {
  const t = useTranslations("Equipment.paczkomat");
  const [selectedPoint, setSelectedPoint] = useState<PaczkomatPoint | null>(
    null,
  );
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedPoint(null);
      setIframeLoaded(false);
      setIframeError(false);
    }
  }, [open]);

  // Listen for postMessage from Geowidget iframe
  useEffect(() => {
    if (!open) return;

    const handler = (event: MessageEvent) => {
      // Security: only accept messages from the Geowidget origin
      if (event.origin !== GEOWIDGET_ORIGIN) return;

      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data?.name && data?.address?.line1) {
          setSelectedPoint({
            id: data.name,
            name: data.name,
            address: [data.address.line1, data.address.line2]
              .filter(Boolean)
              .join(", "),
          });
        } else if (data?.name) {
          setSelectedPoint({
            id: data.name,
            name: data.name,
            address: data.address ?? "",
          });
        }
      } catch {
        // Silently ignore unparseable messages
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [open]);

  const handleConfirm = useCallback(() => {
    if (!selectedPoint) return;
    onSelect(selectedPoint);
    onOpenChange(false);
  }, [selectedPoint, onSelect, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const iframeSrc = `${GEOWIDGET_ORIGIN}?token=${encodeURIComponent(geowidgetToken)}&language=pl&config=parcelcollect`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{t("selectPaczkomat")}</DialogTitle>
        </DialogHeader>

        <div className="px-4">
          {/* Iframe container */}
          {!iframeError ? (
            <div className="relative">
              {!iframeLoaded && (
                <Skeleton className="absolute inset-0 h-[400px] w-full rounded-md" />
              )}
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                sandbox="allow-scripts allow-same-origin allow-popups"
                title="InPost Paczkomat locker map"
                className="h-[400px] w-full rounded-md"
                allow=""
                onLoad={() => setIframeLoaded(true)}
                onError={() => setIframeError(true)}
              />
            </div>
          ) : (
            <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed text-center">
              <div className="space-y-2">
                <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t("loadError")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIframeError(false);
                    setIframeLoaded(false);
                  }}
                >
                  {t("retry")}
                </Button>
              </div>
            </div>
          )}

          {/* Selected locker info */}
          {selectedPoint && (
            <div
              className="mt-3 rounded-md border bg-card p-3"
              aria-live="polite"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">{selectedPoint.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPoint.address}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-4 pb-4">
          <Button variant="outline" onClick={handleCancel}>
            {t("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedPoint}>
            {t("confirmLocker")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
