"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatMinorUnits(minor: number): string {
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepConfirmationProps {
  runNumber: string;
  fileBase64: string;
  fileName: string;
  invoiceCount: number;
  totalMinor: number;
  currency: string;
  exportFormat: string;
  onViewRun: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepConfirmation({
  runNumber,
  fileBase64,
  fileName,
  invoiceCount,
  totalMinor,
  currency,
  exportFormat,
  onViewRun,
  onClose,
}: StepConfirmationProps) {
  const t = useTranslations("Payments");

  const handleDownload = useCallback(() => {
    try {
      // Decode base64 to binary
      const byteCharacters = atob(fileBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/octet-stream" });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch {
      // Silent fail -- user can try again
    }
  }, [fileBase64, fileName]);

  const formatLabel =
    exportFormat === "CSV"
      ? "CSV"
      : exportFormat === "BANK_FILE"
        ? "Elixir"
        : "SEPA XML";

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Success icon */}
      <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />

      {/* Heading */}
      <h3 className="text-[20px] font-semibold text-center">
        {t("step3.successHeading", { runNumber })}
      </h3>

      {/* Summary stats */}
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          {invoiceCount} {t("step3.invoices")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("step3.total")}: {formatMinorUnits(totalMinor)} {currency}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("step3.format")}: {formatLabel}
        </p>
      </div>

      {/* Download button */}
      <Button variant="outline" onClick={handleDownload}>
        {t("step3.downloadExport")}
      </Button>

      {/* View run link */}
      <button
        type="button"
        className="text-sm text-primary hover:underline"
        onClick={onViewRun}
      >
        {t("step3.viewPaymentRun")}
      </button>

      {/* Close */}
      <div className="w-full border-t pt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          {t("step3.close")}
        </Button>
      </div>
    </div>
  );
}
