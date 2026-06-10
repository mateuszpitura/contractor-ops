import type { PortalAppRouter } from '@contractor-ops/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { usePortalTRPC } from '../../../providers/trpc-provider.js';

type PortalRouterOutputs = inferRouterOutputs<PortalAppRouter>;

export type PortalEquipmentItem = PortalRouterOutputs['portal']['listEquipment'][number];

export type PortalReturnRequest = PortalRouterOutputs['portal']['getReturnStatus'];

export function usePortalEquipment() {
  const tReturn = useTranslations('Portal.return');
  const trpc = usePortalTRPC();
  const queryClient = useQueryClient();

  const [returnFlowOpen, setReturnFlowOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const equipmentQuery = useQuery(trpc.portal.listEquipment.queryOptions());
  const returnStatusQuery = useQuery(trpc.portal.getReturnStatus.queryOptions());

  const equipment: PortalEquipmentItem[] = equipmentQuery.data ?? [];
  const returnRequest: PortalReturnRequest = returnStatusQuery.data ?? null;

  const cancelMutation = useMutation(
    trpc.portal.cancelReturn.mutationOptions({
      onSuccess: () => {
        toast.success(tReturn('cancelledToast'));
        setCancelDialogOpen(false);
        void queryClient.invalidateQueries({
          queryKey: trpc.portal.getReturnStatus.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.portal.listEquipment.queryKey(),
        });
      },
      onError: () => {
        toast.error(tReturn('cancelledToast'));
      },
    }),
  );

  const invalidateReturnQueries = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.portal.getReturnStatus.queryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: trpc.portal.listEquipment.queryKey(),
    });
  }, [queryClient, trpc.portal]);

  const canReturn = useMemo(
    () =>
      equipment.some(
        item => item.equipment.status === 'ASSIGNED' || item.equipment.status === 'DELIVERED',
      ),
    [equipment],
  );

  const returnableItems = useMemo(
    () =>
      equipment
        .filter(
          item => item.equipment.status === 'ASSIGNED' || item.equipment.status === 'DELIVERED',
        )
        .map(item => ({
          name: item.equipment.name,
          serialNumber: item.equipment.serialNumber,
        })),
    [equipment],
  );

  const hasActiveReturn = Boolean(
    returnRequest &&
      (returnRequest.status === 'PENDING_APPROVAL' || returnRequest.status === 'SHIPMENT_CREATED'),
  );

  const confirmCancelReturn = useCallback(() => {
    if (returnRequest) {
      cancelMutation.mutate({ id: returnRequest.id });
    }
  }, [returnRequest, cancelMutation]);

  return {
    isPending: equipmentQuery.isPending,
    isError: equipmentQuery.isError,
    equipment,
    returnRequest,
    returnFlowOpen,
    setReturnFlowOpen,
    cancelDialogOpen,
    setCancelDialogOpen,
    isCancelling: cancelMutation.isPending,
    confirmCancelReturn,
    invalidateReturnQueries,
    canReturn,
    returnableItems,
    hasActiveReturn,
  } as const;
}
