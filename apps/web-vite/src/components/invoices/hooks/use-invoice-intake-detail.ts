import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

/**
 * Map a TanStack Query error into the "not found" flag the container
 * branches on. The intake.getById tRPC procedure throws TRPCError with
 * `code: 'NOT_FOUND'` both when the intake id genuinely does not exist
 * AND when the row exists but belongs to a different organization (the
 * procedure pre-filters by `(id, organizationId)` so cross-org reads
 * return null → NOT_FOUND, never FORBIDDEN). The container relies on
 * the same UI rendering for both branches so the response never reveals
 * which case applies.
 */
export function deriveIsNotFound(error: unknown): boolean {
  const code = (error as { data?: { code?: string } } | null | undefined)?.data?.code;
  return code === 'NOT_FOUND';
}

export function useInvoiceIntakeDetail(intakeId: string) {
  const trpc = useTRPC();
  const intakeQuery = useQuery(trpc.invoiceIntake.getById.queryOptions({ intakeId }));

  const handleRetry = useCallback(() => {
    void intakeQuery.refetch();
  }, [intakeQuery]);

  const isNotFound = deriveIsNotFound(intakeQuery.error);

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
