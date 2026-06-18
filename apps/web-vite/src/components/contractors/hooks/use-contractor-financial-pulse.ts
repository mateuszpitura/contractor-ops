import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../../../providers/trpc-provider.js';

/** tRPC boundary for the detail overview financial-pulse widget. */
export function useContractorFinancialPulse(contractorId: string) {
  const trpc = useTRPC();
  const query = useQuery(trpc.contractor.financialPulse.queryOptions({ id: contractorId }));
  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    onRetry: () => void query.refetch(),
  };
}
