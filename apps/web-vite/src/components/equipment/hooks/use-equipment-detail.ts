import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useEntityDetailQuery } from '../../../hooks/use-entity-detail-query.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useBreadcrumbOverride } from '../../layout/breadcrumb-context.js';

export function useEquipmentDetail(equipmentId: string) {
  const trpc = useTRPC();
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [shipmentOpen, setShipmentOpen] = useState(false);

  const {
    query: equipmentQuery,
    data: equipment,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
  } = useEntityDetailQuery({
    ...trpc.equipment.getById.queryOptions({ id: equipmentId }),
    enabled: Boolean(equipmentId),
  });

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
    isLoading,
    isError,
    configuredCarriers,
  } as const;
}
