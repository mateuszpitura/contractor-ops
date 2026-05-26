import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useResourceMutation } from '../../../../hooks/use-resource-mutation.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

type Outcome = 'PENDING' | 'SELBSTANDIG' | 'ABHANGIG' | 'WITHDRAWN';

export function useDrvClearanceList(engagementId: string) {
  const trpc = useTRPC();

  const listQuery = useQuery(
    trpc.statusfeststellungsverfahren.listByEngagement.queryOptions({
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

  const createMutation = useResourceMutation(
    trpc.statusfeststellungsverfahren.create.mutationOptions(),
    {
      invalidate: [[['statusfeststellungsverfahren', 'listByEngagement']]],
      successMessage: 'Done.',
      onClose,
    },
  );

  const updateMutation = useResourceMutation(
    trpc.statusfeststellungsverfahren.update.mutationOptions(),
    {
      invalidate: [[['statusfeststellungsverfahren', 'listByEngagement']]],
      successMessage: 'Done.',
      onClose,
    },
  );

  return { createMutation, updateMutation } as const;
}

export function useDrvDecisionLetterUpload(classificationAssessmentId: string | undefined) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const uploadMutation = useResourceMutation(
    trpc.classificationDocument.uploadDrvDecisionLetter.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.classificationDocument.pathFilter());
      },
    }),
    {
      successMessage: 'Done.',
    },
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
