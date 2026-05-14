import type { QueryKey, UseMutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Configuration for `useResourceMutation`.
 *
 * The hook does not call `t()` itself — pass already-translated strings so
 * the caller controls namespace + interpolation. Keeps typing simple and
 * keeps i18n locality at the call site.
 */
export interface UseResourceMutationConfig {
  /**
   * Query keys to invalidate on success. Each key is invalidated in
   * parallel via `queryClient.invalidateQueries({ queryKey })`. Pass tRPC
   * query keys produced by `trpc.foo.bar.queryKey()` (or
   * `trpc.foo.bar.pathKey()` / `trpc.foo.queryFilter()`).
   */
  invalidate?: QueryKey[];
  /** Toast shown on success. Required so the user always gets feedback. */
  successMessage: string;
  /**
   * Toast shown on error. If omitted, the hook shows the server-supplied
   * `error.message` (or a neutral fallback if absent).
   */
  errorMessage?: string;
  /**
   * Optional cleanup hook fired after success + invalidation (e.g. close
   * dialog / reset form). Runs before any caller-supplied `onSuccess`.
   */
  onClose?: () => void;
}

/**
 * Standardized resource mutation hook — wraps a tRPC `mutationOptions(...)`
 * output and enforces the canonical post-mutation contract:
 *
 *   1. invalidate the resource's queries so the UI re-fetches
 *   2. show a success toast
 *   3. fire an optional `onClose` (close modal / reset form / etc.)
 *
 * On error it shows a toast (caller-provided message or server `error.message`)
 * and preserves any `onError` handler passed via `mutationOptions`.
 *
 * @example
 * ```tsx
 * const createContractor = useResourceMutation(
 *   trpc.contractor.create.mutationOptions(),
 *   {
 *     invalidate: [trpc.contractor.list.queryKey()],
 *     successMessage: t('toast.contractorCreated'),
 *     errorMessage: t('errors.failedToCreate'),
 *     onClose: () => setDialogOpen(false),
 *   },
 * );
 *
 * createContractor.mutate({ name: '...' });
 * ```
 */
export function useResourceMutation<TData, TError extends Error, TVariables, TContext = unknown>(
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
