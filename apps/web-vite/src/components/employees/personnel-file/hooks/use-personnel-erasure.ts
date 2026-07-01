import type { AppRouter } from '@contractor-ops/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export type ErasureResult = inferRouterOutputs<AppRouter>['personnelFile']['requestErasure'];
export type ErasureDisposition = ErasureResult['sections'][number];

export interface PersonnelErasure {
  request: (workerId: string) => void;
  reset: () => void;
  result: ErasureResult | null;
  isPending: boolean;
  isError: boolean;
}

/**
 * Sole tRPC boundary for the RODO erasure flow. Wraps `requestErasure` and,
 * on success, invalidates the personnel-file namespace so the sections whose
 * documents were soft-deleted refresh. The result is returned as-is — the honest
 * per-section disposition contract (`fullErasureClaimed` + retained citations)
 * is decided on the server and rendered verbatim; the client never recomputes
 * whether erasure was "full".
 */
export function usePersonnelErasure(): PersonnelErasure {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('PersonnelFile.erasure');

  const mutation = useMutation(
    trpc.personnelFile.requestErasure.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.personnelFile.pathFilter());
      },
      onError: () => toast.error(t('toast.error')),
    }),
  );

  const request = useCallback((workerId: string) => mutation.mutate({ workerId }), [mutation]);

  return {
    request,
    reset: mutation.reset,
    result: mutation.data ?? null,
    isPending: mutation.isPending,
    isError: mutation.isError,
  };
}
