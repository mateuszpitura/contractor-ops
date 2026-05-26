import { useCallback } from 'react';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEquipmentRetire(options?: { onSuccess?: () => void }) {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();

  const mutation = useResourceMutation(
    trpc.equipment.retire.mutationOptions({
      onSuccess: () => {
        options?.onSuccess?.();
      },
    }),
    {
      invalidate: [trpc.equipment.getById.queryKey(), trpc.equipment.list.queryKey()],
      successMessage: t('toast.retired'),
      errorMessage: t('error.actionFailed'),
    },
  );

  const retire = useCallback((id: string) => mutation.mutate({ id }), [mutation]);

  return { mutation, retire, isPending: mutation.isPending } as const;
}

export function useEquipmentUnassign(options?: { onSuccess?: () => void }) {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();

  const mutation = useResourceMutation(
    trpc.equipment.unassign.mutationOptions({
      onSuccess: () => {
        options?.onSuccess?.();
      },
    }),
    {
      invalidate: [trpc.equipment.getById.queryKey(), trpc.equipment.list.queryKey()],
      successMessage: t('toast.unassigned'),
      errorMessage: t('error.actionFailed'),
    },
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

  const approveMutation = useResourceMutation(
    trpc.equipment.approveReturnRequest.mutationOptions(),
    {
      invalidate: [trpc.equipment.getById.queryKey(), trpc.equipment.listReturnRequests.queryKey()],
      successMessage: t('approvedToast'),
      errorMessage: t('actionFailed'),
    },
  );

  const rejectMutation = useResourceMutation(trpc.equipment.rejectReturnRequest.mutationOptions(), {
    invalidate: [trpc.equipment.getById.queryKey(), trpc.equipment.listReturnRequests.queryKey()],
    successMessage: t('rejectedToast'),
    errorMessage: t('actionFailed'),
  });

  return { approveMutation, rejectMutation } as const;
}

export function useEquipmentShipmentEvent(options?: { onSuccess?: () => void }) {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();

  const mutation = useResourceMutation(
    trpc.equipment.addShipmentEvent.mutationOptions({
      onSuccess: () => {
        options?.onSuccess?.();
      },
    }),
    {
      invalidate: [trpc.equipment.getById.queryKey()],
      successMessage: t('toast.statusUpdated'),
      errorMessage: t('error.actionFailed'),
    },
  );

  return { mutation, isPending: mutation.isPending } as const;
}
