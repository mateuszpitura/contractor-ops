// Sole tRPC boundary for the US worker-classification result section.
//
// Reads the latest completed assessment for the engagement (the routers are
// multi-country; the US profile returns a US_CLASSIFICATION outcome) and
// exposes the reason-required, audit-logged override mutation. The scored
// outcome stays server-derived — the client can never assert the verdict.

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useResourceMutation } from '../../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export type UsOverrideVerdict = 'employee' | 'independent-contractor' | 'indeterminate';

export interface UsOverrideInput {
  overrideVerdict: UsOverrideVerdict;
  reason: string;
}

export function useUsClassification(contractorAssignmentId: string) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const latestQuery = useQuery({
    ...trpc.classification.getLatest.queryOptions({ contractorAssignmentId }),
    retry: false,
  });

  const overrideMutation = useResourceMutation(trpc.classification.override.mutationOptions(), {
    invalidate: [trpc.classification.pathFilter()],
    successMessage: toasts.done(),
  });

  const override = useCallback(
    (input: UsOverrideInput) =>
      overrideMutation.mutateAsync({
        contractorAssignmentId,
        overrideVerdict: input.overrideVerdict,
        reason: input.reason.trim(),
      }),
    [overrideMutation, contractorAssignmentId],
  );

  return {
    latestQuery,
    latest: latestQuery.data,
    isPending: latestQuery.isPending,
    isError: latestQuery.isError,
    refetch: latestQuery.refetch,
    overrideMutation,
    override,
  } as const;
}
