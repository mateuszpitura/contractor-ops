import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEquipmentShipmentForm(options: { equipmentId: string; onSuccess: () => void }) {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    trpc.equipment.createShipment.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.shipmentCreated'));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getById.queryKey(),
        });
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

  return { createMutation, isPending: createMutation.isPending } as const;
}
