import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

interface LeitwegIdOption {
  id: string;
  value: string;
}

export function useLeitwegIdInlineSelector(
  mode: 'contractor' | 'contract',
  contractorId?: string | null,
  contractId?: string | null,
) {
  const trpc = useTRPC();

  const query = useQuery({
    ...(mode === 'contractor' && contractorId
      ? trpc.leitwegId.listByContractor.queryOptions({ contractorId })
      : mode === 'contract' && contractId
        ? trpc.leitwegId.listByContract.queryOptions({ contractId })
        : trpc.leitwegId.list.queryOptions()),
    enabled: mode === 'contractor' ? !!contractorId : mode === 'contract' ? !!contractId : true,
  });

  const options = useMemo(
    () => (Array.isArray(query.data) ? (query.data as LeitwegIdOption[]) : []),
    [query.data],
  );

  return { query, options } as const;
}
