/**
 * Standardized resource mutation hook. Lifted from
 * apps/web/src/hooks/use-resource-mutation.ts unchanged — uses only
 * @tanstack/react-query + sonner, no Next-specific imports.
 */

import type { QueryKey, UseMutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

export interface UseResourceMutationConfig {
  invalidate?: QueryKey[];
  successMessage: string;
  errorMessage?: string;
  onClose?: () => void;
}

export function useResourceMutation<
  TData,
  TError extends { message?: string } = Error,
  TVariables = void,
  TContext = unknown,
>(
  mutationOptions: UseMutationOptions<TData, TError, TVariables, TContext>,
  config: UseResourceMutationConfig,
) {
  const queryClient = useQueryClient();
  const { invalidate, successMessage, errorMessage, onClose } = config;

  const invalidateAll = useCallback(async () => {
    if (!invalidate || invalidate.length === 0) return;
    await Promise.all(invalidate.map(queryKey => queryClient.invalidateQueries({ queryKey })));
  }, [invalidate, queryClient]);

  return useMutation<TData, TError, TVariables, TContext>({
    ...mutationOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await mutationOptions.onSuccess?.(data, variables, onMutateResult, context);
      await invalidateAll();
      toast.success(successMessage);
      onClose?.();
    },
    onError: (error, variables, onMutateResult, context) => {
      mutationOptions.onError?.(error, variables, onMutateResult, context);
      const fallback = error.message?.length ? error.message : '';
      toast.error(errorMessage ?? fallback);
    },
  });
}
