import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../../providers/trpc-provider.js';

export type AssessmentRow = {
  id: string;
  status: string;
  countryCode: string;
  ruleSetVersion: string;
  completedAt: Date | string | null;
  contractorAssignmentId: string;
  outcome: unknown;
};

export function useClassificationAssessmentList(contractorId: string) {
  const trpc = useTRPC();

  const listQuery = useQuery({
    ...trpc.classification.listByContractor.queryOptions({ contractorId }),
    retry: false,
  });

  return {
    listQuery,
    rows: (listQuery.data ?? []) as AssessmentRow[],
    isPending: listQuery.isPending,
  } as const;
}
