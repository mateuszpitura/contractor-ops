import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useDocumentHistoryList(engagementId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery(
    trpc.classificationDocument?.listByEngagement.queryOptions({
      contractorAssignmentId: engagementId,
    }),
  );

  const downloadDocument = useCallback(
    async (classificationDocumentId: string): Promise<void> => {
      const options = trpc.classificationDocument?.getDownloadUrl.queryOptions({
        classificationDocumentId,
      });
      const data = await queryClient.fetchQuery(options);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    },
    [queryClient, trpc.classificationDocument],
  );

  return {
    listQuery,
    docs: listQuery.data ?? [],
    downloadDocument,
  } as const;
}

export function useGenerateDrvBundle(classificationAssessmentId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.classificationDocument?.generateDrvDefenseBundle.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [['classificationDocument', 'listByEngagement']],
        });
        toast.success('Done.');
      },
      onError: err => {
        toast.error(err.message);
      },
    }),
  );

  const generate = useCallback(
    () => mutation.mutate({ classificationAssessmentId }),
    [mutation, classificationAssessmentId],
  );

  return { mutation, generate, isPending: mutation.isPending } as const;
}

export function useGenerateSds(classificationAssessmentId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const approveSdsMutation = useMutation(
    trpc.classification?.approveSds.mutationOptions({
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.classification?.pathFilter());
      },
      onError: err => {
        toast.error(err.message);
      },
    }),
  );

  const generateMutation = useMutation(
    trpc.classificationDocument?.generateSds.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [['classificationDocument', 'listByEngagement']],
        });
        toast.success('Done.');
      },
      onError: err => {
        toast.error(err.message);
      },
    }),
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
