"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { UploadCloud } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { UploadProgress, type UploadingFile } from "./upload-progress";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ACCEPTED_TYPES: Record<string, string[]> = {
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

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DropZoneProps = {
  onFilesAccepted?: (files: File[]) => void;
  onFileRejected?: (files: File[]) => void;
  disabled?: boolean;
  entityType?: string;
  entityId?: string;
  documentType?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DropZone({
  onFilesAccepted,
  onFileRejected,
  disabled,
  entityType,
  entityId,
  documentType = "OTHER",
}: DropZoneProps) {
  const t = useTranslations("Documents");
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<UploadingFile[]>([]);

  const requestUploadMutation = useMutation(
    trpc.document.requestUpload.mutationOptions({})
  );

  const confirmUploadMutation = useMutation(
    trpc.document.confirmUpload.mutationOptions({})
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
          documentType,
          entityType: entityType as "CONTRACT" | "CONTRACTOR" | undefined,
          entityId,
        } as Parameters<typeof requestUploadMutation.mutateAsync>[0]);

        const documentId = result.documentId as string;
        const uploadUrl = result.uploadUrl as string;

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, documentId, progress: 10 } : f
          )
        );

        // Step 2: Upload directly to R2 via presigned URL with progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round(
                10 + (event.loaded / event.total) * 80
              );
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === fileId ? { ...f, progress: percent } : f
                )
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
              : f
          )
        );

        await confirmUploadMutation.mutateAsync({
          documentId,
        } as Parameters<typeof confirmUploadMutation.mutateAsync>[0]);

        // Upload confirmed, scan running async
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: "scanning" as const, progress: 100 }
              : f
          )
        );

        // Refresh document list
        queryClient.invalidateQueries({
          queryKey: trpc.document.list.queryKey(),
        });
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: "error" as const, progress: 0 }
              : f
          )
        );
      }
    },
    [
      requestUploadMutation,
      confirmUploadMutation,
      entityType,
      entityId,
      queryClient,
    ]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      onFilesAccepted?.(acceptedFiles);
      if (rejectedFiles.length > 0) {
        onFileRejected?.(acceptedFiles);
      }
      for (const file of acceptedFiles) {
        void uploadFile(file);
      }
    },
    [uploadFile, onFilesAccepted, onFileRejected]
  );

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled,
  });

  return (
    <div className="space-y-4">
      {/* Drop zone area */}
      <div
        {...getRootProps()}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
          disabled
            ? "pointer-events-none opacity-50"
            : isDragActive
              ? "border-primary bg-primary/[0.03]"
              : "border-border bg-muted/50 hover:border-muted-foreground/30"
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud
          className={`mb-3 size-8 text-muted-foreground transition-transform ${
            isDragActive ? "scale-110 text-primary" : ""
          }`}
        />
        <p className="text-center text-sm text-muted-foreground">
          {t("dropZone.body")}{" "}
          <span className="cursor-pointer font-medium text-primary">
            {t("dropZone.browse")}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("dropZone.accepted")}
        </p>
      </div>

      {/* Upload progress list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((item) => (
            <UploadProgress
              key={item.id}
              file={item}
              onRemove={() => removeFile(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
