/**
 * Standardized resource mutation hook with built-in i18n translation of
 * success / error feedback.
 *
 * Lifecycle of a message value (per goals/i18n-system-messages/facts.md):
 *   1. Caller passes `successMessage` / `errorMessage` as either:
 *      a) a `TranslationKey` literal (preferred — typed dotted leaf path
 *         from the codegen), looked up through `t(...)`.
 *      b) `{ key, params }` — same resolution with ICU values.
 *      c) a pre-rendered `string` (from a namespace-bound `t(...)` call) —
 *         rendered directly into the toast. The plugin allows this because
 *         the argument is a function-call expression, not a literal.
 *   2. When `errorMessage` is omitted, the API `shape.data.errorKey` from
 *      the tRPC error is resolved automatically through `useTranslatedError`.
 *   3. The previous `error.message?.length ? error.message : ''` fallback
 *      is removed so a raw camelCase key (or empty string) can never reach
 *      the toast.
 *
 * Preferred new-code form: `successMessage: COMMON_TOAST.done`. Old
 * `successMessage: tc('foo')` call sites continue to compile via the
 * `string` arm.
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
 * Preferred forms are `TranslationKey` literals and `{ key, params }`
 * structures resolved by the hook's internal `t(...)`. The `string` arm
 * accommodates namespace-bound `tc('foo')` results that callers already
 * render at the call site — the hook re-runs them through `t(...)` and
 * i18next echoes the value back if it is not a known key, so rendering
 * stays correct either way.
 */
export type ResourceMessage =
  | TranslationKey
  | { key: TranslationKey; params?: TranslateValues }
  | string;

export interface UseResourceMutationConfig<TError = unknown> {
  invalidate?: QueryKey[];
  successMessage: ResourceMessage;
  errorMessage?: ResourceMessage;
  onClose?: () => void;
  /**
   * When provided and returns `true` for a given error, the hook's built-in
   * `toast.error(...)` is suppressed. Use this when the caller handles the
   * error via its own rich UI (e.g. a modal) and the generic toast would
   * double-surface the same failure.
   */
  suppressErrorToast?: (error: TError) => boolean;
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
  // For a `TranslationKey` literal `t(value)` resolves to the locale
  // string; for a pre-rendered `tc('foo')` result i18next does not find
  // the rendered text as a key and echoes it back unchanged.
  const translated = t(value);
  if (translated !== value && translated.length > 0) return translated;
  return value;
}

export function useResourceMutation<
  TData,
  TError extends { message?: string } = Error,
  TVariables = void,
  TContext = unknown,
>(
  mutationOptions: UseMutationOptions<TData, TError, TVariables, TContext>,
  config: UseResourceMutationConfig<TError>,
) {
  const queryClient = useQueryClient();
  const t = useTranslations();
  const translateError = useTranslatedError();
  const { invalidate, successMessage, errorMessage, onClose, suppressErrorToast } = config;

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
      if (suppressErrorToast?.(error)) return;
      // Caller-supplied override wins; otherwise auto-translate the API key.
      const text =
        errorMessage === undefined ? translateError(error) : resolveMessage(errorMessage, t);
      toast.error(text);
    },
  });
}
