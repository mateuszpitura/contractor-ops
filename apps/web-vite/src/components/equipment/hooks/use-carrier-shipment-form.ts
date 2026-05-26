import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { DpdAddress, ParcelSize } from '../dpd-fieldset.js';
import type { PaczkomatPoint } from '../paczkomat-picker.js';
import type { UpsServiceCode } from '../ups-fieldset.js';

type Carrier = 'inpost' | 'dpd' | 'ups';

export function useCarrierShipmentForm(options: {
  equipmentIds: string[];
  direction: 'OUTBOUND' | 'RETURN';
  onSuccess: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Equipment.carrier');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateQueries = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.equipment.getById.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.equipment.list.queryKey(),
    });
  }, [queryClient, trpc]);

  const onMutationSuccess = useCallback(
    (carrierLabel: string) => {
      toast.success(t('created', { carrier: carrierLabel }));
      invalidateQueries();
      options.onSuccess();
      options.onOpenChange(false);
    },
    [t, invalidateQueries, options],
  );

  const onMutationError = useCallback(() => {
    toast.error(t('createError'));
  }, [t]);

  const inpostMutation = useMutation(
    trpc.equipment.createInPostShipment.mutationOptions({
      onSuccess: () => {
        onMutationSuccess('InPost');
        void queryClient.invalidateQueries(trpc.equipment.pathFilter());
      },
      onError: onMutationError,
    }),
  );

  const dpdMutation = useMutation(
    trpc.equipment.createDpdShipment.mutationOptions({
      onSuccess: () => {
        onMutationSuccess('DPD');
        void queryClient.invalidateQueries(trpc.equipment.pathFilter());
      },
      onError: onMutationError,
    }),
  );

  const upsMutation = useMutation(
    trpc.equipment.createUpsShipment.mutationOptions({
      onSuccess: () => {
        onMutationSuccess('UPS');
        void queryClient.invalidateQueries(trpc.equipment.pathFilter());
      },
      onError: onMutationError,
    }),
  );

  const isPending = inpostMutation.isPending || dpdMutation.isPending || upsMutation.isPending;

  const submitShipment = useCallback(
    (input: {
      carrier: Carrier;
      equipmentIds: string[];
      direction: 'OUTBOUND' | 'RETURN';
      selectedPoint: PaczkomatPoint | null;
      address: DpdAddress;
      parcelSize: ParcelSize;
      serviceCode: UpsServiceCode;
    }) => {
      switch (input.carrier) {
        case 'inpost':
          if (!input.selectedPoint) return;
          inpostMutation.mutate({
            equipmentIds: input.equipmentIds,
            targetPointId: input.selectedPoint.id,
            targetPointName: input.selectedPoint.name,
            targetPointAddress: input.selectedPoint.address,
            parcelSize: input.parcelSize,
            direction: input.direction,
          });
          break;
        case 'dpd':
          dpdMutation.mutate({
            equipmentIds: input.equipmentIds,
            deliveryAddress: input.address,
            parcelSize: input.parcelSize,
            direction: input.direction,
          });
          break;
        case 'ups':
          upsMutation.mutate({
            equipmentIds: input.equipmentIds,
            deliveryAddress: input.address,
            parcelSize: input.parcelSize,
            serviceCode: input.serviceCode,
            direction: input.direction,
          });
          break;
      }
    },
    [inpostMutation, dpdMutation, upsMutation],
  );

  return { isPending, submitShipment } as const;
}
