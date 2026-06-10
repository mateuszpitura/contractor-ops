import type { EquipmentCreateInput } from '@contractor-ops/validators';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEquipmentForm(options: { onSuccess: () => void }) {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();

  const createMutation = useResourceMutation(
    trpc.equipment.create.mutationOptions({
      onSuccess: () => {
        options.onSuccess();
      },
    }),
    {
      invalidate: [trpc.equipment.list.queryKey()],
      successMessage: t('toast.created'),
      errorMessage: t('error.actionFailed'),
    },
  );

  const updateMutation = useResourceMutation(
    trpc.equipment.update.mutationOptions({
      onSuccess: () => {
        options.onSuccess();
      },
    }),
    {
      invalidate: [trpc.equipment.list.queryKey(), trpc.equipment.getById.queryKey()],
      successMessage: t('toast.updated'),
      errorMessage: t('error.actionFailed'),
    },
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
