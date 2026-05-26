import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEngagementDetail(engagementId: string) {
  const trpc = useTRPC();

  const latestQuery = useQuery({
    ...trpc.classification?.getDraft.queryOptions({
      contractorAssignmentId: engagementId,
    }),
    enabled: Boolean(engagementId),
    retry: false,
  });

  const attestationQuery = useQuery({
    ...trpc.ir35Attestation?.getForEngagement.queryOptions({
      contractorAssignmentId: engagementId,
    }),
    enabled: Boolean(engagementId),
    retry: false,
  });

  const draftError = (latestQuery.error as { data?: { code?: string } } | null | undefined)?.data
    ?.code;
  const isNotFound = draftError === 'NOT_FOUND';

  const draft = latestQuery.data;
  const countryCode = draft?.countryCode ?? null;
  const completedAssessmentId = draft && draft.status === 'completed' ? draft.id : null;
  const attestationSigned = Boolean(attestationQuery.data?.signedAt);

  return {
    latestQuery,
    isNotFound,
    isLoading: latestQuery.isLoading,
    countryCode,
    completedAssessmentId,
    attestationSigned,
    engagementId,
  } as const;
}
