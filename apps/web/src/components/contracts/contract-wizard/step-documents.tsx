"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  UploadCloud,
  FileText,
  X,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UploadStatus =
  | "uploading"
  | "confirming"
  | "scanning"
  | "clean"
  | "infected"
  | "failed"
  | "error";

interface UploadingFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  documentId?: string;
}

interface StepDocumentsProps {
  /** Called when user wants to skip document upload */
  onSkip?: () => void;
  /** Callback with uploaded document IDs for linking after contract creation */
  onDocumentsChange: (documentIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Scan status badge
// ---------------------------------------------------------------------------

function ScanStatusBadge({ status }: { status: UploadStatus }) {
  const t = useTranslations("Contracts.wizard");

  switch (status) {
    case "scanning":
    case "confirming":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("scan.scanning")}
        </span>
      );
    case "clean":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <ShieldCheck className="h-3 w-3" />
          {t("scan.clean")}
        </span>
      );
    case "infected":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <ShieldAlert className="h-3 w-3" />
          {t("scan.infected")}
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <ShieldQuestion className="h-3 w-3" />
          {t("scan.failed")}
        </span>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Step 3: Document upload.
 * Drag-and-drop zone using react-dropzone with immediate upload via
 * presigned URLs (requestUpload + PUT to R2 + confirmUpload).
 */
export function StepDocuments({
  onSkip,
  onDocumentsChange,
}: StepDocumentsProps) {
  const t = useTranslations("Contracts.wizard");
  const [files, setFiles] = useState<UploadingFile[]>([]);

  const requestUploadMutation = useMutation(
    trpc.document.requestUpload.mutationOptions({}),
  );

  const confirmUploadMutation = useMutation(
    trpc.document.confirmUpload.mutationOptions({}),
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = `${file.name}-${Date.now()}`;

      setFiles((prev) => [
        ...prev,
        {
          id: fileId,
          file,
          status: "uploading" as const,
          progress: 0,
        },
      ]);

      try {
        // Step 1: Request presigned upload URL
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await requestUploadMutation.mutateAsync({
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        } as Parameters<typeof requestUploadMutation.mutateAsync>[0]);

        const documentId = result.documentId as string;
        const uploadUrl = result.uploadUrl as string;

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, documentId, progress: 10 } : f,
          ),
        );

        // Step 2: Upload directly to R2 via presigned URL with progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round(
                10 + (event.loaded / event.total) * 80,
              );
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === fileId ? { ...f, progress: percent } : f,
                ),
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(file);
        });

        // Step 3: Confirm upload
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: "confirming" as const, progress: 95 }
              : f,
          ),
        );

        await confirmUploadMutation.mutateAsync({
          documentId,
        } as Parameters<typeof confirmUploadMutation.mutateAsync>[0]);

        // Upload confirmed, scan running async
        setFiles((prev) => {
          const updated = prev.map((f) =>
            f.id === fileId
              ? { ...f, status: "scanning" as const, progress: 100 }
              : f,
          );
          // Update parent with all successful document IDs
          onDocumentsChange(
            updated
              .filter((f) => f.documentId && f.status !== "error")
              .map((f) => f.documentId!),
          );
          return updated;
        });
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: "error" as const, progress: 0 }
              : f,
          ),
        );
      }
    },
    [requestUploadMutation, confirmUploadMutation, onDocumentsChange],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        void uploadFile(file);
      }
    },
    [uploadFile],
  );

  const removeFile = (fileId: string) => {
    setFiles((prev) => {
      const updated = prev.filter((f) => f.id !== fileId);
      onDocumentsChange(
        updated
          .filter((f) => f.documentId && f.status !== "error")
          .map((f) => f.documentId!),
      );
      return updated;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`flex min-h-[160px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
          isDragActive
            ? "border-primary bg-primary/[0.03]"
            : "border-border bg-muted/50"
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud
          className={`mb-3 h-8 w-8 text-muted-foreground transition-transform ${
            isDragActive ? "scale-110 text-primary" : ""
          }`}
        />
        <p className="text-sm text-center text-muted-foreground">
          {t("dropZone.body")}{" "}
          <span className="text-primary font-medium cursor-pointer">
            {t("dropZone.browse")}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("dropZone.accepted")}
        </p>
      </div>

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(item.file.size)}
                  </span>
                  {item.status === "uploading" ? (
                    <Progress
                      value={item.progress}
                      className="h-1.5 flex-1 max-w-[120px]"
                    />
                  ) : (
                    <ScanStatusBadge status={item.status} />
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeFile(item.id)}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Skip link */}
      <div className="text-center">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
          onClick={onSkip}
        >
          {t("skipDocuments")}
        </button>
      </div>
    </div>
  );
}
