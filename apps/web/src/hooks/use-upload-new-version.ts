'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// File picker MIME allowlist
//
// Kept narrow on purpose — must stay aligned with `ACCEPTED_TYPES` in
// drop-zone.tsx so a user uploading a "new version" cannot widen the type
// surface relative to the original upload flow.
// ---------------------------------------------------------------------------

const ACCEPT_ATTR =
  '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,application/pdf,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'image/png,image/jpeg';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB — matches drop-zone.tsx

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

/**
 * Hook that returns a callback ready to be passed to `<DocumentCard onUploadNewVersion>`.
 *
 * The callback receives the existing document's id and:
 *   1. opens a transient `<input type="file">` picker,
 *   2. requests a presigned PUT URL via `document.uploadNewVersion` (which
 *      atomically marks the existing document SUPERSEDED and copies all
 *      entity links),
 *   3. uploads the file bytes directly to R2,
 *   4. confirms the upload via `document.confirmUpload` so the synchronous
 *      MIME sniff + async virus scan pipeline kicks in,
 *   5. invalidates the document query cache so the list re-fetches.
 *
 * All transitions emit `sonner` toasts; failure paths attempt no automatic
 * retry — version uploads are rare enough that a human re-try is the right
 * cost/benefit trade-off vs. silent exponential backoff.
 */
export function useUploadNewVersion() {
  const t = useTranslations('Documents');
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const requestUploadMutation = useMutation(
    trpc.document.uploadNewVersion.mutationOptions({
      onError: err => toast.error(err.message),
    }),
  );

  const confirmUploadMutation = useMutation(
    trpc.document.confirmUpload.mutationOptions({
      onError: err => toast.error(err.message),
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
        // Step 1 — atomic supersede + presigned PUT URL.
        const result = await requestUploadMutation.mutateAsync({
          existingDocumentId,
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        });

        const uploadResult = result as { documentId: string; uploadUrl: string };
        const { documentId, uploadUrl } = uploadResult;

        // Step 2 — direct-to-R2 PUT. Same Content-Type as declared above so
        // the presigned URL's signed header matches.
        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!putResponse.ok) {
          throw new Error(`R2 PUT failed: ${putResponse.status}`);
        }

        // Step 3 — backend-side guards (MIME sniff, size cap) + async scan.
        await confirmUploadMutation.mutateAsync({ documentId });

        toast.success(t('upload.success', { filename: file.name }), { id: toastId });

        // Step 4 — re-fetch lists, version history, etc.
        queryClient.invalidateQueries(trpc.document.pathFilter());
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t('upload.error', { filename: file.name });
        toast.error(message, { id: toastId });
      }
    },
    [t, queryClient, requestUploadMutation, confirmUploadMutation],
  );

  /**
   * Returned to the consumer. Internally creates a one-shot `<input>` per
   * call so multiple cards can each kick off their own pickers without
   * clobbering shared state.
   */
  const onUploadNewVersion = useCallback(
    (existingDocumentId: string) => {
      // Reuse a single hidden input element to play nicely with React's render
      // cycle — the browser dispatches change events asynchronously, so we
      // keep the ref stable across calls and just re-bind the handler.
      if (typeof window === 'undefined') return;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ACCEPT_ATTR;
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        // Always detach so we never leak between picker invocations.
        input.remove();
        if (!file) return;
        void performUpload(existingDocumentId, file);
      });
      // Some browsers (notably Safari) require the input to live in the DOM
      // for `.click()` to open the picker reliably.
      document.body.appendChild(input);
      inputRef.current = input;
      input.click();
    },
    [performUpload],
  );

  return onUploadNewVersion;
}
