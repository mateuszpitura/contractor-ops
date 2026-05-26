import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEquipmentRetire(options?: { onSuccess?: () => void }) {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.equipment.retire.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.retired'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        options?.onSuccess?.();
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const retire = useCallback((id: string) => mutation.mutate({ id }), [mutation]);

  return { mutation, retire, isPending: mutation.isPending } as const;
}

export function useEquipmentUnassign(options?: { onSuccess?: () => void }) {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.equipment.unassign.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.unassigned'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        options?.onSuccess?.();
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const unassign = useCallback(
    (equipmentId: string) => mutation.mutate({ equipmentId }),
    [mutation],
  );

  return { mutation, unassign, isPending: mutation.isPending } as const;
}

export function useEquipmentReturnApproval() {
  const t = useTranslations('Equipment.return');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const approveMutation = useMutation(
    trpc.equipment.approveReturnRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('approvedToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.listReturnRequests.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('actionFailed'));
      },
    }),
  );

  const rejectMutation = useMutation(
    trpc.equipment.rejectReturnRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t('rejectedToast'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.listReturnRequests.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('actionFailed'));
      },
    }),
  );

  return { approveMutation, rejectMutation } as const;
}

export function useEquipmentShipmentEvent(options?: { onSuccess?: () => void }) {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.equipment.addShipmentEvent.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.statusUpdated'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        options?.onSuccess?.();
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  return { mutation, isPending: mutation.isPending } as const;
}
