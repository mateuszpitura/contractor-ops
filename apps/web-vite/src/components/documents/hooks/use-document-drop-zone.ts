import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<UploadingFile[]>([]);

  const requestUploadMutation = useMutation(
    trpc.document.requestUpload.mutationOptions({
      onError: err => toast.error(err.message),
    }),
  );

  const confirmUploadMutation = useMutation(
    trpc.document.confirmUpload.mutationOptions({
      onError: err => toast.error(err.message),
    }),
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = `${file.name}-${Date.now()}`;

      setFiles(prev => [
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

        setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, documentId, progress: 10 } : f)));

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);

          xhr.upload.onprogress = event => {
            if (event.lengthComputable) {
              const percent = Math.round(10 + (event.loaded / event.total) * 80);
              setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, progress: percent } : f)));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(file);
        });

        setFiles(prev =>
          prev.map(f =>
            f.id === fileId ? { ...f, status: 'confirming' as const, progress: 95 } : f,
          ),
        );

        await confirmUploadMutation.mutateAsync({ documentId });

        setFiles(prev =>
          prev.map(f =>
            f.id === fileId ? { ...f, status: 'scanning' as const, progress: 100 } : f,
          ),
        );

        queryClient.invalidateQueries({
          queryKey: trpc.document.list.queryKey(),
        });
      } catch {
        setFiles(prev =>
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
