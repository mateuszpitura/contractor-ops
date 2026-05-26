/**
 * Standardized resource mutation hook with built-in i18n translation of
 * success / error feedback.
 *
 * Lifecycle of a message value (per goals/i18n-system-messages/facts.md):
 *   1. Caller passes `successMessage` / `errorMessage` as either:
 *      a) a `TranslationKey` (or a string literal that matches the union)
 *         — resolved through `t(...)` against the live locale.
 *      b) `{ key, params }` — same resolution with ICU values.
 *      c) (transitional, Phase 1 only) a raw `string` — passed through to
 *         `toast.*` verbatim so unmigrated call sites keep working. Phase 2
 *         sweep migrates each domain to (a) / (b); Phase 3 narrows the type
 *         to drop the raw `string` arm.
 *   2. When `errorMessage` is omitted, the API `shape.data.errorKey` from
 *      the tRPC error is resolved automatically through `useTranslatedError`.
 *   3. The previous `error.message?.length ? error.message : ''` fallback is
 *      removed so a raw camelCase key (or empty string) can never reach the
 *      toast.
 */

import type { QueryKey, UseMutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import type { TranslationKey } from '../generated/i18n/keys.js';
import { useTranslatedError } from '../i18n/use-translated-error.js';
import type { TranslateValues } from '../i18n/useTranslations.js';
import { useTranslations } from '../i18n/useTranslations.js';

/**
 * `TranslationKey` is branded by the codegen, so a string literal that
 * happens to match one of the dotted leaf paths is automatically a valid
 * `TranslationKey`. The raw `string` arm exists only for transitional
 * Phase 1 compatibility with un-migrated callers and is removed in
 * Phase 3 (the i18n-system-messages flip).
 */
export type ResourceMessage =
  | TranslationKey
  | { key: TranslationKey; params?: TranslateValues }
  | string;

export interface UseResourceMutationConfig {
  invalidate?: QueryKey[];
  successMessage: ResourceMessage;
  errorMessage?: ResourceMessage;
  onClose?: () => void;
}

function isStructuredMessage(
  value: ResourceMessage,
): value is { key: TranslationKey; params?: TranslateValues } {
  return typeof value === 'object' && value !== null && 'key' in value;
}

function resolveMessage(
  value: ResourceMessage,
  t: (key: string, values?: TranslateValues) => string,
): string {
  if (isStructuredMessage(value)) {
    return t(value.key, value.params ?? {});
  }
  if (typeof value === 'string') {
    // A branded TranslationKey is also `typeof === 'string'`. Try translating
    // it first; i18next echoes the key back when the lookup fails, in which
    // case we fall through and treat the value as a pre-translated literal
    // (the transitional Phase 1 path).
    const translated = t(value);
    if (translated !== value && translated.length > 0) return translated;
    return value;
  }
  return '';
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
  const t = useTranslations();
  const translateError = useTranslatedError();
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
      toast.success(resolveMessage(successMessage, t));
      onClose?.();
    },
    onError: (error, variables, onMutateResult, context) => {
      mutationOptions.onError?.(error, variables, onMutateResult, context);
      // Caller-supplied override wins; otherwise auto-translate the API key.
      const text =
        errorMessage === undefined ? translateError(error) : resolveMessage(errorMessage, t);
      toast.error(text);
    },
  });
}
