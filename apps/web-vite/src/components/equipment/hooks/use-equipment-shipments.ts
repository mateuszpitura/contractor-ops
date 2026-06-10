import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useEquipmentShipments(equipmentId: string, selectedShipmentId: string | null) {
  const t = useTranslations('Equipment');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery(trpc.equipment.listShipments.queryOptions({ equipmentId }));

  const detailQuery = useQuery({
    ...trpc.equipment.getShipment.queryOptions({ id: selectedShipmentId ?? '' }),
    enabled: !!selectedShipmentId,
  });

  const deleteMutation = useResourceMutation(trpc.equipment.deleteShipment.mutationOptions(), {
    successMessage: t('toast.shipmentDeleted'),
    invalidate: [trpc.equipment.pathFilter()],
  });

  const fetchLabel = useCallback(
    async (shipmentId: string) => {
      const result = await queryClient.fetchQuery(
        trpc.equipment.getShipmentLabel.queryOptions({ shipmentId }),
      );
      const dataUrl = `data:${result.contentType};base64,${result.data}`;
      const newWindow = window.open(dataUrl, '_blank', 'noopener,noreferrer');
      if (!newWindow) {
        toast.error(t('shipmentsTable.labelPopupBlocked'));
      }
    },
    [queryClient, t, trpc.equipment.getShipmentLabel],
  );

  return {
    listQuery,
    shipments: listQuery.data ?? [],
    detailQuery,
    deleteMutation,
    fetchLabel,
  } as const;
}
