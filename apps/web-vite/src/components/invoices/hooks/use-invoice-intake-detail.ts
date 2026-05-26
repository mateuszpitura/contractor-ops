import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useInvoiceIntakeDetail(intakeId: string) {
  const trpc = useTRPC();
  const intakeQuery = useQuery(trpc.invoiceIntake.getById.queryOptions({ intakeId }));

  const handleRetry = useCallback(() => {
    void intakeQuery.refetch();
  }, [intakeQuery]);

  const errorCode = (intakeQuery.error as { data?: { code?: string } } | null | undefined)?.data
    ?.code;
  const isNotFound = errorCode === 'NOT_FOUND';

  return {
    intakeQuery,
    intake: intakeQuery.data,
    isLoading: intakeQuery.isLoading,
    isError: intakeQuery.isError,
    isNotFound,
    hasIntake: Boolean(intakeQuery.data),
    handleRetry,
  } as const;
}
