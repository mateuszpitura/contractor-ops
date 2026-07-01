import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

/**
 * Sole tRPC boundary for the employee registration surface.
 *
 * Wraps the read-only reference lists (NFZ branches, statutory enums) and the
 * `employee.register` write. The presentational market components stay free of
 * any data access — they receive the reference data and the register callback
 * as props. National-ID plaintext is passed straight to `register`, which
 * encrypts it server-side; it is never held in the query cache here.
 */
export function useEmployeeCompliance() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Employees.compliance');

  const referenceListsQuery = useQuery(trpc.employee.listReferenceLists.queryOptions());

  const registerMutation = useMutation(
    trpc.employee.register.mutationOptions({
      onSuccess: () => {
        toast.success(t('registeredToast'));
        void queryClient.invalidateQueries(trpc.employee.pathFilter());
      },
      onError: () => {
        toast.error(t('registerErrorToast'));
      },
    }),
  );

  type RegisterInput = Parameters<typeof registerMutation.mutate>[0];

  const register = useCallback(
    (input: RegisterInput) => registerMutation.mutate(input),
    [registerMutation],
  );

  return {
    referenceListsQuery,
    referenceLists: referenceListsQuery.data,
    registerMutation,
    register,
    isLoading: referenceListsQuery.isLoading,
    isError: referenceListsQuery.isError,
    error: referenceListsQuery.error,
  } as const;
}

export type UseEmployeeComplianceResult = ReturnType<typeof useEmployeeCompliance>;
