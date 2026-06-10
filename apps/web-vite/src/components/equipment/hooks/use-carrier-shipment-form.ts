import { useCallback } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
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

  const shipmentInvalidate = [
    trpc.equipment.getById.queryKey(),
    trpc.equipment.list.queryKey(),
    trpc.equipment.pathFilter(),
  ];

  const inpostMutation = useResourceMutation(
    trpc.equipment.createInPostShipment.mutationOptions({
      onSuccess: () => {
        options.onSuccess();
      },
    }),
    {
      invalidate: shipmentInvalidate,
      successMessage: t('created', { carrier: 'InPost' }),
      errorMessage: t('createError'),
      onClose: () => options.onOpenChange(false),
    },
  );

  const dpdMutation = useResourceMutation(
    trpc.equipment.createDpdShipment.mutationOptions({
      onSuccess: () => {
        options.onSuccess();
      },
    }),
    {
      invalidate: shipmentInvalidate,
      successMessage: t('created', { carrier: 'DPD' }),
      errorMessage: t('createError'),
      onClose: () => options.onOpenChange(false),
    },
  );

  const upsMutation = useResourceMutation(
    trpc.equipment.createUpsShipment.mutationOptions({
      onSuccess: () => {
        options.onSuccess();
      },
    }),
    {
      invalidate: shipmentInvalidate,
      successMessage: t('created', { carrier: 'UPS' }),
      errorMessage: t('createError'),
      onClose: () => options.onOpenChange(false),
    },
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
