import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useRouter } from '../../../../i18n/navigation.js';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../../providers/trpc-provider.js';

export interface SubmitUploadReplacementArgs {
  itemId: string;
  file: File;
  suggestedExpiresAt?: string;
}

/**
 * Phase 73 COMPL-04 / D-06 — orchestrates the portal upload-replacement flow:
 *   portal.getUploadUrl -> R2 PUT -> portal.submitUploadReplacement.
 * On success, toasts and navigates back to /portal/compliance. The only tRPC
 * boundary for the upload-replacement form.
 */
export function usePortalUploadReplacement() {
  const trpc = usePortalTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations('Portal.compliance');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getUploadUrl = useMutation(trpc.portal.getComplianceUploadUrl.mutationOptions());
  const submitReplacement = useMutation(trpc.portal.submitUploadReplacement.mutationOptions());

  const submit = useCallback(
    async ({ itemId, file, suggestedExpiresAt }: SubmitUploadReplacementArgs) => {
      setIsSubmitting(true);
      try {
        const contentType = file.type || 'application/pdf';
        const { uploadUrl, documentId } = await getUploadUrl.mutateAsync({
          filename: file.name,
          contentType,
        });

        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: file,
        });
        if (!putResponse.ok) {
          throw new Error(`R2 PUT failed: ${putResponse.status}`);
        }

        await submitReplacement.mutateAsync({
          itemId,
          documentId,
          originalFileName: file.name,
          fileSizeBytes: file.size,
          suggestedExpiresAt,
        });

        await queryClient.invalidateQueries(trpc.portal.complianceItems.pathFilter());
        toast.success(t('upload.success'));
        router.push('/portal/compliance');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('upload.error'));
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [getUploadUrl, submitReplacement, queryClient, trpc, t, router],
  );

  return { submit, isSubmitting } as const;
}
