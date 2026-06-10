import { useEntityDetailQuery } from '../../../hooks/use-entity-detail-query.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useInvoiceIntakeDetail(intakeId: string) {
  const trpc = useTRPC();
  const {
    query: intakeQuery,
    data: intake,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
    hasData: hasIntake,
  } = useEntityDetailQuery(trpc.invoiceIntake.getById.queryOptions({ intakeId }));

  return {
    intakeQuery,
    intake,
    isLoading,
    isError,
    isNotFound,
    hasIntake,
    handleRetry,
  } as const;
}
