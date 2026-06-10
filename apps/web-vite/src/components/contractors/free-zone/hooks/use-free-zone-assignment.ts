import type { AppRouter } from '@contractor-ops/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

/** The upsert input, minus the contractorId the hook injects. */
export type FreeZoneAssignmentInput = Omit<
  RouterInputs['gulf']['freeZone']['upsertAssignment'],
  'contractorId'
>;
export type FreeZoneAssignment = RouterOutputs['gulf']['freeZone']['getAssignment'];

/**
 * The single tRPC boundary for the free-zone assignment surface.
 * Reads the contractor's one FreeZoneAssignment and exposes a save handler
 * that upserts it through the tenant-scoped, Zod-validated `gulf.freeZone` router.
 * Server-side validation is authoritative — client validation is UX only.
 */
export function useFreeZoneAssignment(contractorId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tToast = useTranslations('Contractors.freeZone.toast');

  const assignmentQuery = useQuery(trpc.gulf.freeZone.getAssignment.queryOptions({ contractorId }));

  const upsertMutation = useMutation(
    trpc.gulf.freeZone.upsertAssignment.mutationOptions({
      onSuccess: () => {
        toast.success(tToast('saved'));
        queryClient.invalidateQueries({
          queryKey: trpc.gulf.freeZone.getAssignment.queryKey({ contractorId }),
        });
      },
      onError: () => {
        toast.error(tToast('saveFailed'));
      },
    }),
  );

  const save = useCallback(
    (input: FreeZoneAssignmentInput) => {
      upsertMutation.mutate({ contractorId, ...input });
    },
    [contractorId, upsertMutation],
  );

  return {
    isLoading: assignmentQuery.isLoading,
    isError: assignmentQuery.isError,
    onRetry: () => void assignmentQuery.refetch(),
    data: assignmentQuery.data ?? null,
    save,
    isSaving: upsertMutation.isPending,
  } as const;
}
