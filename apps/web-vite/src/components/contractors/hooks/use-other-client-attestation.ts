import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useOtherClientAttestation(engagementId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const existingQuery = useQuery(
    trpc.ir35Attestation.getForEngagement.queryOptions({ contractorAssignmentId: engagementId }),
  );

  const mutation = useMutation(
    trpc.ir35Attestation.upsert.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [['ir35Attestation', 'getForEngagement']],
        });
        toast.success('Done.');
      },
      onError: err => toast.error(err.message),
    }),
  );

  const submit = useCallback(
    (statementText: string, signedName: string) => {
      mutation.mutate({
        contractorAssignmentId: engagementId,
        statementText,
        signedName,
      });
    },
    [mutation, engagementId],
  );

  return {
    existingQuery,
    existing: existingQuery.data,
    mutation,
    submit,
    isPending: mutation.isPending,
  } as const;
}
