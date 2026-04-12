"use client";

import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Image,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/trpc/init";
import { PdfPreview } from "./pdf-preview";
import { VersionHistory } from "./version-history";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentCardProps = {
  document: {
    id: string;
    originalFileName: string;
    mimeType: string;
    fileSizeBytes: number;
    virusScanStatus: string;
    createdAt: string | Date;
    uploadedByUserId: string | null;
    status: string;
  };
  /** version number to display (1-indexed from query position) */
  versionNumber?: number;
  onUploadNewVersion?: (documentId: string) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("spreadsheet") || mimeType.includes("xlsx")) return FileSpreadsheet;
  return FileText;
}

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Scan status inline badge
// ---------------------------------------------------------------------------

function ScanStatusBadge({ status }: { status: string }) {
  const t = useTranslations("Documents.scan");

  switch (status) {
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {t("scanning")}
        </span>
      );
    case "CLEAN":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <ShieldCheck className="size-3" />
          {t("clean")}
        </span>
      );
    case "INFECTED":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <ShieldAlert className="size-3" />
          {t("infected")}
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <ShieldQuestion className="size-3" />
          {t("failed")}
        </span>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentCard({
  document: doc,
  versionNumber,
  onUploadNewVersion,
}: DocumentCardProps) {
  const t = useTranslations("Documents");
  const [previewOpen, setPreviewOpen] = useState(false);

  const FileIcon = getFileIcon(doc.mimeType);
  const isPdf = doc.mimeType === "application/pdf";
  const isInfected = doc.virusScanStatus === "INFECTED";

  async function handleDownload() {
    try {
      // Use fetch to call the download URL query
      const result = await fetch(
        `/api/trpc/document.getDownloadUrl?input=${encodeURIComponent(
          JSON.stringify({ documentId: doc.id }),
        )}`,
      );
      const data = await result.json();
      const url = data?.result?.data?.url;
      if (url) {
        window.open(url, "_blank");
      }
    } catch {
      // Silently fail for download
    }
  }

  return (
    <div className="flex items-start gap-4 rounded-lg border bg-card p-4">
      {/* File type icon */}
      <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
        <FileIcon className="size-6 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{doc.originalFileName}</p>
          {versionNumber != null && (
            <Badge variant="secondary" className="shrink-0">
              {t("version", { n: versionNumber })}
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
          <span className="text-xs text-muted-foreground">{formatFileSize(doc.fileSizeBytes)}</span>
          <ScanStatusBadge status={doc.virusScanStatus} />
        </div>

        {/* Version history */}
        <VersionHistory documentId={doc.id} />
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {isPdf && !isInfected && (
          <Button variant="ghost" size="icon-sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="size-3.5" />
            <span className="sr-only">{t("preview")}</span>
          </Button>
        )}

        {isInfected ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <Button {...props} variant="ghost" size="icon-sm" disabled>
                    <Download className="size-3.5" />
                    <span className="sr-only">{t("download")}</span>
                  </Button>
                )}
              />
              <TooltipContent>{t("threatDetected")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={handleDownload}>
            <Download className="size-3.5" />
            <span className="sr-only">{t("download")}</span>
          </Button>
        )}

        {onUploadNewVersion && doc.status === "ACTIVE" && (
          <Button variant="ghost" size="icon-sm" onClick={() => onUploadNewVersion(doc.id)}>
            <Upload className="size-3.5" />
            <span className="sr-only">{t("uploadNewVersion")}</span>
          </Button>
        )}
      </div>

      {/* PDF Preview dialog */}
      {isPdf && (
        <PdfPreview
          documentId={doc.id}
          filename={doc.originalFileName}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
    </div>
  );
}
