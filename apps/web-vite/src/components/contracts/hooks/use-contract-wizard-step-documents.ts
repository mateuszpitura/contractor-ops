import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

type UploadStatus =
  | 'uploading'
  | 'confirming'
  | 'scanning'
  | 'clean'
  | 'infected'
  | 'failed'
  | 'error';

export interface UploadingFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  documentId?: string;
}

export function useContractWizardStepDocuments(onDocumentsChange: (documentIds: string[]) => void) {
  const trpc = useTRPC();
  const t = useTranslations('Documents.scan');
  const translateError = useTranslatedError();
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const queryClient = useQueryClient();

  const requestUploadMutation = useMutation(
    trpc.document.requestUpload.mutationOptions({
      onError: err => toast.error(translateError(err) || t('uploadError')),
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.document.pathFilter());
      },
    }),
  );

  const confirmUploadMutation = useMutation(
    trpc.document.confirmUpload.mutationOptions({
      onError: err => toast.error(translateError(err) || t('uploadError')),
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.document.pathFilter());
      },
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
          documentType: 'MASTER_CONTRACT',
        } as Parameters<typeof requestUploadMutation.mutateAsync>[0]);

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

        await confirmUploadMutation.mutateAsync({
          documentId,
        } as Parameters<typeof confirmUploadMutation.mutateAsync>[0]);

        setFiles(prev => {
          const updated = prev.map(f =>
            f.id === fileId ? { ...f, status: 'scanning' as const, progress: 100 } : f,
          );
          onDocumentsChange(
            updated
              .filter(f => f.documentId && f.status !== 'error')
              .map(f => f.documentId as string),
          );
          return updated;
        });
      } catch {
        setFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, status: 'error' as const, progress: 0 } : f)),
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

  const removeFile = useCallback(
    (fileId: string) => {
      setFiles(prev => {
        const updated = prev.filter(f => f.id !== fileId);
        onDocumentsChange(
          updated
            .filter(f => f.documentId && f.status !== 'error')
            .map(f => f.documentId as string),
        );
        return updated;
      });
    },
    [onDocumentsChange],
  );

  const resetFiles = useCallback(() => {
    setFiles([]);
  }, []);

  return {
    files,
    onDrop,
    removeFile,
    resetFiles,
  } as const;
}
