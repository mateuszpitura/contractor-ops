import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useDocumentHistoryList(engagementId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const translateError = useTranslatedError();

  const listQuery = useQuery(
    trpc.classificationDocument.listByEngagement.queryOptions({
      contractorAssignmentId: engagementId,
    }),
  );

  const downloadDocument = useCallback(
    async (classificationDocumentId: string): Promise<void> => {
      const options = trpc.classificationDocument.getDownloadUrl.queryOptions({
        classificationDocumentId,
      });
      try {
        const data = await queryClient.fetchQuery(options);
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        toast.error(translateError(err));
      }
    },
    [queryClient, trpc.classificationDocument, translateError],
  );

  return {
    listQuery,
    docs: listQuery.data ?? [],
    downloadDocument,
  } as const;
}

export function useGenerateDrvBundle(classificationAssessmentId: string) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const mutation = useResourceMutation(
    trpc.classificationDocument.generateDrvDefenseBundle.mutationOptions(),
    {
      invalidate: [trpc.classificationDocument.pathFilter()],
      successMessage: toasts.done(),
    },
  );

  const generate = useCallback(
    () => mutation.mutate({ classificationAssessmentId }),
    [mutation, classificationAssessmentId],
  );

  return { mutation, generate, isPending: mutation.isPending } as const;
}

export function useGenerateSds(classificationAssessmentId: string) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const approveSdsMutation = useResourceMutation(trpc.classification.approveSds.mutationOptions(), {
    invalidate: [trpc.classification.pathFilter()],
    successMessage: toasts.done(),
  });

  const generateMutation = useResourceMutation(
    trpc.classificationDocument.generateSds.mutationOptions(),
    {
      invalidate: [trpc.classificationDocument.pathFilter()],
      successMessage: toasts.done(),
    },
  );

  const approveSds = useCallback(
    (clientName: string) =>
      approveSdsMutation.mutate({
        assessmentId: classificationAssessmentId,
        clientName: clientName.trim(),
      }),
    [approveSdsMutation, classificationAssessmentId],
  );

  const generateSds = useCallback(
    () => generateMutation.mutate({ classificationAssessmentId }),
    [generateMutation, classificationAssessmentId],
  );

  return {
    approveSdsMutation,
    generateMutation,
    approveSds,
    generateSds,
  } as const;
}
