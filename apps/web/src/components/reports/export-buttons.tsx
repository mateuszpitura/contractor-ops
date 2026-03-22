"use client";

import { Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

interface ExportButtonsProps {
  onExportPage: () => void;
  onExportAll: () => void;
  isExporting: boolean;
}

/**
 * Triggers a browser download from a base64-encoded data string.
 * Used across all report exports for CSV file delivery.
 */
export function downloadBase64File(
  base64Data: string,
  filename: string,
  mimeType: string,
): void {
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({
  onExportPage,
  onExportAll,
  isExporting,
}: ExportButtonsProps) {
  const t = useTranslations("Reports");

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onExportPage}
        disabled={isExporting}
        className="h-8 gap-1.5"
      >
        {isExporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {t("exportPage")}
      </Button>
      <Button
        size="sm"
        onClick={onExportAll}
        disabled={isExporting}
        className="h-8 gap-1.5"
      >
        {isExporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {t("exportAll")}
      </Button>
    </div>
  );
}
