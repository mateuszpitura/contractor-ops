/**
 * Document new-version upload flow.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

import { useTranslatedError } from '../i18n/use-translated-error.js';
import { useTranslations } from '../i18n/useTranslations.js';
import { useTRPC } from '../providers/trpc-provider.js';

const ACCEPT_ATTR =
  '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,application/pdf,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'image/png,image/jpeg';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function useUploadNewVersion() {
  const trpc = useTRPC();
  const t = useTranslations('Documents');
  const translateError = useTranslatedError();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const requestUploadMutation = useMutation(
    trpc.document.uploadNewVersion.mutationOptions({
      onError: err => toast.error(translateError(err) || t('scan.uploadError')),
    }),
  );

  const confirmUploadMutation = useMutation(
    trpc.document.confirmUpload.mutationOptions({
      onError: err => toast.error(translateError(err) || t('scan.uploadError')),
    }),
  );

  const performUpload = useCallback(
    async (existingDocumentId: string, file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t('upload.tooLarge', { filename: file.name }));
        return;
      }

      const toastId = toast.loading(t('upload.uploading', { filename: file.name }));

      try {
        const result = await requestUploadMutation.mutateAsync({
          existingDocumentId,
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        });

        const { documentId, uploadUrl } = result;

        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!putResponse.ok) {
          throw new Error(`R2 PUT failed: ${putResponse.status}`);
        }

        await confirmUploadMutation.mutateAsync({ documentId });

        toast.success(t('upload.success', { filename: file.name }), { id: toastId });
        queryClient.invalidateQueries(trpc.document.pathFilter());
      } catch (err) {
        toast.error(translateError(err) || t('upload.error', { filename: file.name }), {
          id: toastId,
        });
      }
    },
    [t, translateError, queryClient, trpc, requestUploadMutation, confirmUploadMutation],
  );

  const onUploadNewVersion = useCallback(
    (existingDocumentId: string) => {
      if (typeof window === 'undefined') return;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ACCEPT_ATTR;
      input.style.display = 'none';

      try {
        input.addEventListener('change', () => {
          try {
            const file = input.files?.[0];
            if (!file) return;
            void performUpload(existingDocumentId, file);
          } finally {
            input.remove();
          }
        });
        input.addEventListener('cancel', () => input.remove());
        document.body.appendChild(input);
        inputRef.current = input;
        input.click();
      } catch (err) {
        input.remove();
        throw err;
      }
    },
    [performUpload],
  );

  return onUploadNewVersion;
}
