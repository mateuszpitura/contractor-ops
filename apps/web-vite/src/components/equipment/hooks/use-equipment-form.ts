import type { EquipmentCreateInput } from '@contractor-ops/validators';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEquipmentForm(options: { onSuccess: () => void }) {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    trpc.equipment.create.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.created'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        options.onSuccess();
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.equipment.update.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.updated'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
        options.onSuccess();
      },
      onError: () => {
        toast.error(t('error.actionFailed'));
      },
    }),
  );

  const submit = (isEdit: boolean, equipmentId: string | undefined, data: EquipmentCreateInput) => {
    if (isEdit && equipmentId) {
      updateMutation.mutate({ id: equipmentId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  return {
    createMutation,
    updateMutation,
    submit,
    isPending: createMutation.isPending || updateMutation.isPending,
  } as const;
}
