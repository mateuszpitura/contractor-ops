/**
 * Translate an unknown error (tRPC or otherwise) into a user-facing string
 * resolved through the `Errors` namespace.
 *
 * Contract:
 *   - A tRPC error surfaces `shape.data.errorKey` (and optional
 *     `shape.data.errorParams`) via the extended `errorFormatter` in
 *     packages/api/src/init.ts. The hook looks the key up in the `Errors`
 *     namespace, interpolating params through the active i18next ICU
 *     formatter when present.
 *   - Unknown keys (or non-tRPC errors) fall back to `Errors.generic`. This
 *     hook never returns an empty string — the caller can render the result
 *     directly into a toast, alert, or banner without a null check.
 *
 * The hook intentionally accepts `unknown` so containers can pass anything
 * `query.error` returns (or a caught `try { ... } catch (e)` value) without
 * narrowing first.
 */

import type { TRPCClientErrorLike } from '@trpc/client';
import { useCallback } from 'react';
import { useTranslations } from './useTranslations.js';

type ErrorParams = Record<string, string | number | Date | null | undefined>;

interface TRPCDataShape {
  errorKey?: string;
  errorParams?: ErrorParams;
}

/**
 * Minimal structural guard — matches tRPC v11 client errors regardless of the
 * specific router type. We only need `data.errorKey` / `data.errorParams`.
 */
function extractErrorShape(err: unknown): TRPCDataShape | undefined {
  if (err === null || typeof err !== 'object') return;
  const data = (err as TRPCClientErrorLike<never>).data as unknown;
  if (data === null || typeof data !== 'object') return;
  return data as TRPCDataShape;
}

export function useTranslatedError(): (err: unknown) => string {
  const t = useTranslations('Errors');
  return useCallback(
    (err: unknown) => {
      const shape = extractErrorShape(err);
      const key = shape?.errorKey;
      if (!key) return t('generic');
      const translated = t(key, shape?.errorParams ?? {});
      // i18next returns the raw key when it cannot resolve it. Detect that
      // and fall back to `generic` so an unrecognised server key never
      // surfaces a camelCase identifier in the UI.
      if (translated === key || translated === `Errors.${key}`) {
        return t('generic');
      }
      return translated;
    },
    [t],
  );
}
