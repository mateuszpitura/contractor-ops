import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export type ContractorTabWorkflowRunRow = {
  id: string;
  status: string;
  startedAt: string | null;
  workflowTemplate: {
    name: string;
    type: string;
  } | null;
  progress: {
    done: number;
    total: number;
    percent: number;
  };
};

export function useContractorTabWorkflows(contractorId: string) {
  const trpc = useTRPC();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const runsQuery = useQuery(
    trpc.workflow.listRuns.queryOptions({
      contractorId,
      page,
      pageSize,
      sortBy: 'startedAt',
      sortOrder: 'desc',
    }),
  );

  const items: ContractorTabWorkflowRunRow[] = useMemo(
    () => (runsQuery.data?.items ?? []) as unknown as ContractorTabWorkflowRunRow[],
    [runsQuery.data],
  );
  const totalCount = runsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    pickerOpen,
    setPickerOpen,
    page,
    setPage,
    items,
    totalPages,
    isLoading: runsQuery.isLoading,
    contractorId,
  } as const;
}
