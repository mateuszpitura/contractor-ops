import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';

export function useEquipmentDetail(equipmentId: string) {
  const trpc = useTRPC();
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [shipmentOpen, setShipmentOpen] = useState(false);

  const equipmentQuery = useQuery({
    ...trpc.equipment.getById.queryOptions({ id: equipmentId }),
    enabled: Boolean(equipmentId),
  });

  const equipment = equipmentQuery.data;

  const returnRequestsQuery = useQuery({
    ...trpc.equipment.listReturnRequests.queryOptions({
      status: 'PENDING_APPROVAL',
    }),
    enabled: !!equipment?.currentAssignment,
  });

  const courierConfigsQuery = useQuery(trpc.equipment.getCourierConfigs.queryOptions());
  const configuredCarriers = ((courierConfigsQuery.data ?? []) as Array<{ carrier: string }>).map(
    c => c.carrier,
  );

  const returnRequests = (returnRequestsQuery.data ?? []) as unknown as Array<{
    id: string;
    contractorId: string;
    status: string;
    targetPointName: string | null;
    itemCount: number;
    createdAt: string;
    contractor?: { displayName?: string; legalName?: string };
  }>;

  const pendingReturn = equipment?.currentAssignment
    ? returnRequests.find(r => r.contractorId === equipment.currentAssignment?.contractorId)
    : null;

  const pendingReturnData = useMemo(
    () =>
      pendingReturn
        ? {
            id: pendingReturn.id,
            contractorName:
              pendingReturn.contractor?.displayName ??
              pendingReturn.contractor?.legalName ??
              equipment?.currentAssignment?.contractor?.displayName ??
              equipment?.currentAssignment?.contractor?.legalName ??
              '',
            itemCount: pendingReturn.itemCount ?? 1,
            targetPointName: pendingReturn.targetPointName ?? '',
            createdAt: pendingReturn.createdAt,
          }
        : null,
    [pendingReturn, equipment],
  );

  useBreadcrumbOverride(equipmentId, equipment?.name);

  const handleRetry = useCallback(() => {
    void equipmentQuery.refetch();
  }, [equipmentQuery]);

  const isNotFound =
    equipmentQuery.isError &&
    (equipmentQuery.error?.message?.includes('NOT_FOUND') ||
      (equipmentQuery.error as { data?: { code?: string } })?.data?.code === 'NOT_FOUND');

  return {
    equipment,
    equipmentQuery,
    pendingReturnData,
    formOpen,
    setFormOpen,
    assignOpen,
    setAssignOpen,
    shipmentOpen,
    setShipmentOpen,
    handleRetry,
    isNotFound,
    isLoading: equipmentQuery.isLoading,
    isError: equipmentQuery.isError,
    configuredCarriers,
  } as const;
}
