import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useOtherClientAttestation(engagementId: string) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const existingQuery = useQuery(
    trpc.ir35Attestation.getForEngagement.queryOptions({ contractorAssignmentId: engagementId }),
  );

  const mutation = useResourceMutation(trpc.ir35Attestation.upsert.mutationOptions(), {
    invalidate: [['ir35Attestation']],
    successMessage: toasts.done(),
  });

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
