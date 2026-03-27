"use client";

import { useTranslations } from "next-intl";
import {
  FileText,
  FileSpreadsheet,
  Image,
  X,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadStatus =
  | "uploading"
  | "confirming"
  | "scanning"
  | "clean"
  | "infected"
  | "failed"
  | "error";

export interface UploadingFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  documentId?: string;
}

type UploadProgressProps = {
  file: UploadingFile;
  onRemove: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSizeData(bytes: number): { key: string; size: string } {
  if (bytes < 1024) return { key: "bytes", size: String(bytes) };
  if (bytes < 1024 * 1024) return { key: "kilobytes", size: (bytes / 1024).toFixed(1) };
  return { key: "megabytes", size: (bytes / (1024 * 1024)).toFixed(1) };
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("spreadsheet") || mimeType.includes("xlsx"))
    return FileSpreadsheet;
  return FileText;
}

// ---------------------------------------------------------------------------
// Scan status badge
// ---------------------------------------------------------------------------

function ScanStatusBadge({ status }: { status: UploadStatus }) {
  const t = useTranslations("Documents.scan");

  switch (status) {
    case "scanning":
    case "confirming":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {t("scanning")}
        </span>
      );
    case "clean":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <ShieldCheck className="size-3" />
          {t("clean")}
        </span>
      );
    case "infected":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <ShieldAlert className="size-3" />
          {t("infected")}
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <ShieldQuestion className="size-3" />
          {t("failed")}
        </span>
      );
    case "error":
      return (
        <span className="text-xs text-destructive">{t("uploadError")}</span>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UploadProgress({ file, onRemove }: UploadProgressProps) {
  const tCommon = useTranslations("Common");
  const FileIcon = getFileIcon(file.file.type);

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <FileIcon className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{file.file.name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {(() => { const { key, size } = formatFileSizeData(file.file.size); return tCommon(`fileSize.${key}` as Parameters<typeof tCommon>[0], { size }); })()}
          </span>
          {file.status === "uploading" ? (
            <Progress
              value={file.progress}
              className="h-1.5 max-w-[120px] flex-1"
            />
          ) : (
            <ScanStatusBadge status={file.status} />
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        onClick={onRemove}
      >
        <X className="size-3.5" />
        <span className="sr-only">{tCommon("srOnly.remove")}</span>
      </Button>
    </div>
  );
}
