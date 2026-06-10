import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { UploadingFile } from '../upload-progress.js';

type UseDocumentDropZoneOptions = {
  entityType?: string;
  entityId?: string;
  documentType?: string;
};

export function useDocumentDropZone({
  entityType,
  entityId,
  documentType = 'OTHER',
}: UseDocumentDropZoneOptions) {
  const trpc = useTRPC();
  const t = useTranslations('Documents.scan');
  const translateError = useTranslatedError();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<UploadingFile[]>([]);

  const mountedRef = useRef(true);
  const activeXhrsRef = useRef<Set<XMLHttpRequest>>(new Set());

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      for (const xhr of activeXhrsRef.current) {
        xhr.abort();
      }
      activeXhrsRef.current.clear();
    };
  }, []);

  const safeSetFiles = useCallback((updater: (prev: UploadingFile[]) => UploadingFile[]) => {
    if (!mountedRef.current) return;
    setFiles(updater);
  }, []);

  const requestUploadMutation = useMutation(
    trpc.document.requestUpload.mutationOptions({
      onError: err => toast.error(translateError(err) || t('uploadError')),
    }),
  );

  const confirmUploadMutation = useMutation(
    trpc.document.confirmUpload.mutationOptions({
      onError: err => toast.error(translateError(err) || t('uploadError')),
    }),
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = crypto.randomUUID();

      safeSetFiles(prev => [
        ...prev,
        {
          id: fileId,
          file,
          status: 'uploading' as const,
          progress: 0,
        },
      ]);

      try {
        const result = await requestUploadMutation.mutateAsync({
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          documentType: documentType as 'OTHER',
          entityType: entityType as 'CONTRACT' | 'CONTRACTOR' | undefined,
          entityId,
        });

        const uploadResult = result as Record<string, unknown>;
        const documentId = uploadResult.documentId as string;
        const uploadUrl = uploadResult.uploadUrl as string;

        safeSetFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, documentId, progress: 10 } : f)),
        );

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          activeXhrsRef.current.add(xhr);
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);

          xhr.upload.onprogress = event => {
            if (event.lengthComputable) {
              const percent = Math.round(10 + (event.loaded / event.total) * 80);
              safeSetFiles(prev =>
                prev.map(f => (f.id === fileId ? { ...f, progress: percent } : f)),
              );
            }
          };

          xhr.onload = () => {
            activeXhrsRef.current.delete(xhr);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };
          xhr.onerror = () => {
            activeXhrsRef.current.delete(xhr);
            reject(new Error('Upload failed'));
          };
          xhr.onabort = () => {
            activeXhrsRef.current.delete(xhr);
            reject(new DOMException('Upload aborted', 'AbortError'));
          };
          xhr.send(file);
        });

        safeSetFiles(prev =>
          prev.map(f =>
            f.id === fileId ? { ...f, status: 'confirming' as const, progress: 95 } : f,
          ),
        );

        await confirmUploadMutation.mutateAsync({ documentId });

        safeSetFiles(prev =>
          prev.map(f =>
            f.id === fileId ? { ...f, status: 'scanning' as const, progress: 100 } : f,
          ),
        );

        queryClient.invalidateQueries({
          queryKey: trpc.document.list.queryKey(),
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        safeSetFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, status: 'error' as const, progress: 0 } : f)),
        );
      }
    },
    [
      requestUploadMutation,
      confirmUploadMutation,
      entityType,
      entityId,
      queryClient,
      trpc.document.list,
      documentType,
      safeSetFiles,
    ],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        void uploadFile(file);
      }
    },
    [uploadFile],
  );

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  return {
    files,
    onDrop,
    removeFile,
  } as const;
}
