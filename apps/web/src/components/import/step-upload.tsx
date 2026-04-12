"use client";

import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { EntityType } from "./import-wizard-dialog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES: Record<string, string[]> = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (data:...;base64,)
      const base64 = result.split(",")[1];
      if (base64) {
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StepUploadProps {
  entityType: EntityType;
  onEntityTypeChange: (type: EntityType) => void;
  onFileSelected: (base64: string, fileName: string) => void;
  fileName: string | null;
  onFileRemoved: () => void;
}

export function StepUpload({
  entityType,
  onEntityTypeChange,
  onFileSelected,
  fileName,
  onFileRemoved,
}: StepUploadProps) {
  const t = useTranslations("Import");

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      try {
        const base64 = await fileToBase64(file);
        onFileSelected(base64, file.name);
      } catch {
        toast.error(t("upload.conversionError"));
      }
    },
    [onFileSelected, t],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    onDropRejected: (rejections) => {
      const rejection = rejections[0];
      if (!rejection) return;
      const error = rejection.errors[0];
      if (error?.code === "file-too-large") {
        toast.error(t("upload.tooLarge"));
      } else if (error?.code === "file-invalid-type") {
        toast.error(t("upload.invalidType"));
      } else {
        toast.error(t("upload.genericError"));
      }
    },
  });

  return (
    <div className="space-y-6">
      {/* Entity type selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium">{t("upload.entityType")}</label>
        <RadioGroup
          value={entityType}
          onValueChange={(val) => onEntityTypeChange(val as EntityType)}
          aria-label={t("upload.entityType")}
          className="flex gap-4"
        >
          <label className="flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="contractor" />
            <span className="text-sm">{t("upload.contractors")}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <RadioGroupItem value="contract" />
            <span className="text-sm">{t("upload.contracts")}</span>
          </label>
        </RadioGroup>
      </div>

      {/* File drop zone */}
      {!fileName ? (
        <div
          {...getRootProps()}
          role="button"
          tabIndex={0}
          aria-label={t("upload.dropHeading")}
          className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${
            isDragActive
              ? "border-primary bg-primary/[0.03]"
              : "border-border bg-muted/50 hover:border-muted-foreground/30"
          }`}
        >
          <input {...getInputProps()} />
          <Upload
            className={`mb-3 size-12 text-muted-foreground transition-transform ${
              isDragActive ? "scale-110 text-primary" : ""
            }`}
          />
          <p className="text-sm font-medium">{t("upload.dropHeading")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("upload.dropBody")}</p>
          <Button variant="secondary" size="sm" className="mt-4" type="button">
            {t("upload.browse")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
          <FileSpreadsheet className="size-8 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{fileName}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onFileRemoved();
            }}
            type="button"
            aria-label={t("upload.remove")}
          >
            <X className="size-4" />
            <span className="sr-only">{t("upload.remove")}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
