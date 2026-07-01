import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useTRPC } from '../../../../providers/trpc-provider.js';

/** The four national-identifier kinds the registry stores encrypted. */
export type EmployeePiiField = 'ssn' | 'pesel' | 'iqama' | 'emiratesId';

/**
 * Single tRPC boundary for the masked national-ID reveal.
 *
 * `employee.revealPii` is staff-router-only, RBAC-gated (`employeePii:read`)
 * and audit-logged server-side — the client cannot bypass that gate, so the
 * presentational reveal control stays free of any data access. The decrypted
 * value is held in local state (never persisted to the query cache) so it
 * leaves the DOM the moment the user hides it or the component unmounts.
 */
export function useRevealEmployeePii(workerId: string, field: EmployeePiiField) {
  const trpc = useTRPC();
  const [revealedValue, setRevealedValue] = useState<string | undefined>(undefined);

  const mutation = useMutation(
    trpc.employee.revealPii.mutationOptions({
      onSuccess: (result: { field: string; value: string }) => {
        setRevealedValue(result.value);
      },
    }),
  );

  const reveal = useCallback(() => {
    mutation.mutate({ workerId, field });
  }, [mutation, workerId, field]);

  const reset = useCallback(() => {
    setRevealedValue(undefined);
    mutation.reset();
  }, [mutation]);

  return {
    reveal,
    revealedValue,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset,
  } as const;
}
