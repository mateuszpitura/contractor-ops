import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTRPC } from '../../../../providers/trpc-provider.js';

type Outcome = 'PENDING' | 'SELBSTANDIG' | 'ABHANGIG' | 'WITHDRAWN';

export function useDrvClearanceList(engagementId: string) {
  const trpc = useTRPC();

  const listQuery = useQuery(
    trpc.statusfeststellungsverfahren?.listByEngagement.queryOptions({
      contractorAssignmentId: engagementId,
    }),
  );

  return {
    listQuery,
    rows: listQuery.data ?? [],
  } as const;
}

export function useDrvClearanceFormMutations(onClose: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [['statusfeststellungsverfahren', 'listByEngagement']],
    });
  }, [queryClient]);

  const createMutation = useMutation(
    trpc.statusfeststellungsverfahren?.create.mutationOptions({
      onSuccess: () => {
        invalidateList();
        onClose();
        toast.success('Done.');
      },
      onError: err => toast.error(err.message),
    }),
  );

  const updateMutation = useMutation(
    trpc.statusfeststellungsverfahren?.update.mutationOptions({
      onSuccess: () => {
        invalidateList();
        onClose();
        toast.success('Done.');
      },
      onError: err => toast.error(err.message),
    }),
  );

  return { createMutation, updateMutation } as const;
}

export function useDrvDecisionLetterUpload(classificationAssessmentId: string | undefined) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation(
    trpc.classificationDocument?.uploadDrvDecisionLetter.mutationOptions({
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.classificationDocument?.pathFilter());
      },
      onError: err => toast.error(err.message),
    }),
  );

  const upload = useCallback(
    (params: {
      fileBase64: string;
      fileName: string;
      mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
      fileSizeBytes: number;
    }) => {
      if (!classificationAssessmentId) return;
      uploadMutation.mutate({
        classificationAssessmentId,
        ...params,
      });
    },
    [classificationAssessmentId, uploadMutation],
  );

  return { uploadMutation, upload, isPending: uploadMutation.isPending } as const;
}

export type { Outcome };
