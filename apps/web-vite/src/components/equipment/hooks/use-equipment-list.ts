import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEquipmentList() {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const countQuery = useQuery(trpc.equipment.list.queryOptions({ page: 1, pageSize: 10 }));
  const totalCount = (countQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = countQuery.isLoading || countQuery.isFetching;

  const retireMutation = useMutation(
    trpc.equipment.retire.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.retired'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const unassignMutation = useMutation(
    trpc.equipment.unassign.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.unassigned'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const retire = useCallback(
    (id: string) => {
      retireMutation.mutate({ id });
    },
    [retireMutation],
  );

  const unassign = useCallback(
    (equipmentId: string) => {
      unassignMutation.mutate({ equipmentId });
    },
    [unassignMutation],
  );

  return {
    totalCount,
    isCountLoading,
    isCountError: countQuery.isError,
    refetchCount: countQuery.refetch,
    showEmptyState: !(isCountLoading || countQuery.isError) && totalCount === 0,
    retire,
    unassign,
    isRetiring: retireMutation.isPending,
    isUnassigning: unassignMutation.isPending,
  } as const;
}
