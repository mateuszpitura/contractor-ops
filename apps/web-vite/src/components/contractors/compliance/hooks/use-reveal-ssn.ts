import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useTRPC } from '../../../../providers/trpc-provider.js';

/**
 * The single tRPC boundary for the SSN reveal control (UI-SPEC §B).
 *
 * `contractor.revealSsn` is staff-router-only, RBAC-gated (`contractorPii:read`)
 * and audit-logged server-side — the client cannot bypass that gate, so the
 * presentational `SsnMaskedReveal` stays free of any data access. The revealed
 * value is held in local state (never persisted to the query cache) so it leaves
 * the DOM the moment the user hides it or the component unmounts.
 */
export function useRevealSsn(contractorId: string) {
  const trpc = useTRPC();
  const [revealedSsn, setRevealedSsn] = useState<string | undefined>(undefined);

  const mutation = useMutation(
    trpc.contractor.revealSsn.mutationOptions({
      onSuccess: (result: { ssn: string }) => {
        setRevealedSsn(result.ssn);
      },
    }),
  );

  const reveal = useCallback(() => {
    mutation.mutate({ contractorId });
  }, [mutation, contractorId]);

  const reset = useCallback(() => {
    setRevealedSsn(undefined);
    mutation.reset();
  }, [mutation]);

  return {
    reveal,
    revealedSsn,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset,
  } as const;
}
