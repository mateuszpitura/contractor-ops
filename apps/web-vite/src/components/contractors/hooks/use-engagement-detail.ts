import { useQuery } from '@tanstack/react-query';

import { useEntityDetailQuery } from '../../../hooks/use-entity-detail-query.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEngagementDetail(engagementId: string) {
  const trpc = useTRPC();

  const {
    query: latestQuery,
    data: draft,
    isNotFound,
    isLoading,
  } = useEntityDetailQuery({
    ...trpc.classification.getDraft.queryOptions({
      contractorAssignmentId: engagementId,
    }),
    enabled: Boolean(engagementId),
    retry: false,
  });

  const attestationQuery = useQuery({
    ...trpc.ir35Attestation.getForEngagement.queryOptions({
      contractorAssignmentId: engagementId,
    }),
    enabled: Boolean(engagementId),
    retry: false,
  });

  const countryCode = draft?.countryCode ?? null;
  const completedAssessmentId = draft && draft.status === 'COMPLETED' ? draft.id : null;
  const attestationSigned = Boolean(attestationQuery.data?.signedAt);

  return {
    latestQuery,
    isNotFound,
    isLoading,
    countryCode,
    completedAssessmentId,
    attestationSigned,
    engagementId,
  } as const;
}
